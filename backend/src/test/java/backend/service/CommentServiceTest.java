package backend.service;

import backend.dto.CommentRequest;
import backend.dto.CommentResponse;
import backend.entity.Comment;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.CommentRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Comments and replies: a reply must stay in its own task's discussion, and
// every comment leaves an activity entry.
@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    @Mock
    private CommentRepository commentRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private UpdateNotificationService updateNotificationService;
    @Mock
    private backend.repository.ProjectMemberRepository projectMemberRepository;

    private CommentService service;
    private User caller;
    private Task task;
    private Task otherTask;

    @BeforeEach
    void setUp() {
        service = new CommentService(commentRepository, taskRepository, userRepository, projectAccessGuard,
                activityLogService, updateNotificationService, projectMemberRepository);
        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("dev.chen");
        caller.setFullName("Chen");
        lenient().when(userRepository.findByUsername("dev.chen")).thenReturn(Optional.of(caller));

        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        task = task(5L, project);
        otherTask = task(6L, project);
        lenient().when(commentRepository.save(any(Comment.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Task task(Long id, Project project) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", id);
        t.setProject(project);
        lenient().when(taskRepository.findById(id)).thenReturn(Optional.of(t));
        return t;
    }

    private CommentRequest request(Long taskId, String message, Long parentId) {
        CommentRequest r = new CommentRequest();
        r.setTaskId(taskId);
        r.setMessage(message);
        r.setParentCommentId(parentId);
        return r;
    }

    private Comment comment(Long id, Task on) {
        Comment c = new Comment();
        ReflectionTestUtils.setField(c, "id", id);
        c.setTask(on);
        c.setUser(caller);
        c.setMessage("first");
        lenient().when(commentRepository.findById(id)).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void aComment_isLoggedInTheActivityFeed() {
        service.createComment(request(5L, "Looks good to me", null), "dev.chen");

        verify(projectAccessGuard).assertCan(caller, 10L, Resource.COMMENT, Action.CREATE);
        verify(activityLogService).record(eq(caller), eq(task), eq("COMMENT_ADDED"), contains("Comment added: \"Looks good to me\""));
    }

    @Test
    void aComment_tellsThePeopleAroundTheTask() {
        service.createComment(request(5L, "Looks good to me", null), "dev.chen");

        verify(updateNotificationService).notifyCommentAdded(any(Comment.class), eq(caller), any());
    }

    @Test
    void aRefusedComment_notifiesNobody() {
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("no"))
                .when(projectAccessGuard).assertCan(caller, 10L, Resource.COMMENT, Action.CREATE);

        assertThatThrownBy(() -> service.createComment(request(5L, "hi", null), "dev.chen"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

        verify(updateNotificationService, never()).notifyCommentAdded(any(), any(), any());
    }

    @Test
    void aLongComment_isShortenedInTheFeed() {
        service.createComment(request(5L, "word ".repeat(60), null), "dev.chen");

        verify(activityLogService).record(eq(caller), eq(task), eq("COMMENT_ADDED"), contains("…"));
    }

    @Test
    void aReply_staysInItsOwnTasksDiscussion() {
        Comment parent = comment(40L, task);

        CommentResponse response = service.createComment(request(5L, "Agreed", 40L), "dev.chen");

        assertThat(response.getParentCommentId()).isEqualTo(parent.getId());
        verify(activityLogService).record(eq(caller), eq(task), eq("COMMENT_ADDED"), contains("Reply added"));
    }

    @Test
    void aReplyToACommentOnAnotherTask_isRefused() {
        comment(41L, otherTask);

        assertThatThrownBy(() -> service.createComment(request(5L, "Agreed", 41L), "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("another task");
        verify(commentRepository, never()).save(any());
        verify(activityLogService, never()).record(any(), any(), any(), any());
    }

    @Test
    void aReplyToAMissingComment_isNotFound() {
        when(commentRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createComment(request(5L, "Agreed", 99L), "dev.chen"))
                .isInstanceOf(NotFoundException.class);
    }

    // ---- @mentions (G-14, D-21) -----------------------------------------------------------

    private User member(Long id, String username, String status) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        u.setFullName(username + " full");
        u.setAccountStatus(status);
        return u;
    }

    private void membersOfTheProject(User... users) {
        java.util.List<backend.entity.ProjectMember> rows = new java.util.ArrayList<>();
        for (User u : users) {
            backend.entity.ProjectMember m = new backend.entity.ProjectMember();
            m.setUser(u);
            m.setStatus("ACTIVE");
            rows.add(m);
        }
        when(projectMemberRepository.findByProjectIdAndStatus(10L, "ACTIVE")).thenReturn(rows);
    }

    @Test
    void aMentionedMember_isTold_andNotATimeAgainByTheGenericNotice() {
        User mia = member(2L, "dev.mia", "ACTIVE");
        membersOfTheProject(caller, mia);

        CommentResponse response = service.createComment(request(5L, "Can you look, @dev.mia?", null), "dev.chen");

        org.mockito.ArgumentCaptor<java.util.Collection<User>> told = org.mockito.ArgumentCaptor.forClass(java.util.Collection.class);
        verify(updateNotificationService).notifyMentioned(any(Comment.class), eq(caller), told.capture());
        assertThat(told.getValue()).containsExactly(mia);
        verify(updateNotificationService).notifyCommentAdded(any(Comment.class), eq(caller), eq(java.util.Set.of(2L)));
        assertThat(response.getMentions()).extracting(CommentResponse.Mention::username).containsExactly("dev.mia");
    }

    @Test
    void youCannotMentionYourself_aNonMember_orAnInactiveAccount_toNotifyThem() {
        User gone = member(3L, "contractor.felix", "INACTIVE");
        membersOfTheProject(caller, gone);

        CommentResponse response = service.createComment(
                request(5L, "@dev.chen @contractor.felix @someone.else hello", null), "dev.chen");

        org.mockito.ArgumentCaptor<java.util.Collection<User>> told = org.mockito.ArgumentCaptor.forClass(java.util.Collection.class);
        verify(updateNotificationService).notifyMentioned(any(Comment.class), eq(caller), told.capture());
        assertThat(told.getValue()).isEmpty();
        // the author's own @name is still a highlighted mention in the response, but nobody is told
        assertThat(response.getMentions()).extracting(CommentResponse.Mention::username).containsExactly("dev.chen");
    }

    @Test
    void editingAComment_tellsOnlyThePeopleItNewlyMentions() {
        User mia = member(2L, "dev.mia", "ACTIVE");
        User raj = member(4L, "dev.raj", "ACTIVE");
        membersOfTheProject(caller, mia, raj);
        Comment existing = comment(50L, task);
        existing.setMessage("Please check @dev.mia");

        service.updateComment(50L, request(5L, "Please check @dev.mia and @dev.raj", null), "dev.chen");

        org.mockito.ArgumentCaptor<java.util.Collection<User>> told = org.mockito.ArgumentCaptor.forClass(java.util.Collection.class);
        verify(updateNotificationService).notifyMentioned(any(Comment.class), eq(caller), told.capture());
        assertThat(told.getValue()).containsExactly(raj);
        verify(updateNotificationService, never()).notifyCommentAdded(any(), any(), any());
    }

    @Test
    void theCommentList_namesTheMembersEachCommentMentions() {
        User mia = member(2L, "dev.mia", "ACTIVE");
        membersOfTheProject(caller, mia);
        Comment c = comment(60L, task);
        c.setMessage("ping @dev.mia");
        when(commentRepository.findByTaskIdOrderByCreatedAtAsc(5L)).thenReturn(java.util.List.of(c));

        java.util.List<CommentResponse> list = service.getCommentsByTaskId(5L, "dev.chen");

        assertThat(list.get(0).getMentions()).extracting(CommentResponse.Mention::fullName).containsExactly("dev.mia full");
    }
}
