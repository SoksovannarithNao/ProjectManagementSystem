package backend.service;

import backend.entity.Comment;
import backend.entity.Milestone;
import backend.entity.Notification;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.repository.NotificationRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

// Comment, project and milestone notifications (checklist #45): who is told, who is not.
@ExtendWith(MockitoExtension.class)
class UpdateNotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private TaskAssigneeRepository taskAssigneeRepository;
    @Mock
    private TaskRepository taskRepository;

    private UpdateNotificationService service;
    private Project project;
    private Task task;
    private User actor;
    private User assignee;
    private User owner;
    private User leader;
    private User bystander;

    @BeforeEach
    void setUp() {
        service = new UpdateNotificationService(notificationRepository, projectMemberRepository, taskAssigneeRepository,
                taskRepository);
        project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        project.setName("Website Redesign");
        task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setTitle("Draft the homepage");
        task.setProject(project);

        actor = user(1L, "Chen Wu");
        assignee = user(2L, "Mia Park");
        owner = user(3L, "Olivia Bennett");
        leader = user(4L, "Owen Lead");
        bystander = user(5L, "Zoe Viewer");

        lenient().when(projectMemberRepository.findByProjectIdAndStatus(10L, "ACTIVE")).thenReturn(List.of(
                member(owner, "OWNER"), member(leader, "ADMIN"), member(assignee, "MEMBER"), member(actor, "MEMBER"),
                member(bystander, "VIEWER")));
    }

    private User user(Long id, String fullName) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setFullName(fullName);
        u.setAccountStatus("ACTIVE");
        return u;
    }

    private ProjectMember member(User user, String role) {
        ProjectMember m = new ProjectMember();
        m.setProject(project);
        m.setUser(user);
        m.setProjectRole(role);
        m.setStatus("ACTIVE");
        return m;
    }

    private TaskAssignee assigned(User user) {
        TaskAssignee a = new TaskAssignee();
        a.setTask(task);
        a.setUser(user);
        return a;
    }

    private Comment comment(String message, Comment parent) {
        Comment c = new Comment();
        c.setTask(task);
        c.setUser(actor);
        c.setMessage(message);
        c.setParentComment(parent);
        return c;
    }

    private List<Notification> saved() {
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, atLeast(0)).save(captor.capture());
        return captor.getAllValues();
    }

    private List<String> recipients() {
        return saved().stream().map(n -> n.getUser().getFullName()).toList();
    }

    // ---- comments -----------------------------------------------------------

    @Test
    void aComment_reachesTheAssigneesTheOwnerAndTheLeaders_butNotTheAuthorOrAnOutsider() {
        lenient().when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(List.of(assigned(assignee), assigned(actor)));

        int created = service.notifyCommentAdded(comment("Looks good to me", null), actor);

        assertThat(created).isEqualTo(3);
        assertThat(recipients()).containsExactlyInAnyOrder("Mia Park", "Olivia Bennett", "Owen Lead");
        Notification first = saved().get(0);
        assertThat(first.getType()).isEqualTo("COMMENT_ADDED");
        assertThat(first.getTitle()).isEqualTo("New comment");
        assertThat(first.getMessage()).contains("Chen Wu commented on").contains("Draft the homepage")
                .contains("Website Redesign").contains("Looks good to me");
        assertThat(first.getTask()).isSameAs(task);
        assertThat(first.getProject()).isSameAs(project);
    }

    @Test
    void aPerson_whoIsAssignedAndOwner_isToldOnce() {
        lenient().when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(List.of(assigned(owner)));

        service.notifyCommentAdded(comment("hi", null), actor);

        assertThat(recipients()).containsExactlyInAnyOrder("Olivia Bennett", "Owen Lead");
    }

    @Test
    void aReply_alsoReachesTheAuthorOfTheCommentItAnswers() {
        lenient().when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(List.of());
        Comment parent = comment("Question?", null);
        parent.setUser(bystander);

        service.notifyCommentAdded(comment("Answer", parent), actor);

        assertThat(recipients()).containsExactlyInAnyOrder("Zoe Viewer", "Olivia Bennett", "Owen Lead");
        assertThat(saved().get(0).getTitle()).isEqualTo("New reply");
        assertThat(saved().get(0).getMessage()).contains("replied on");
    }

    @Test
    void peopleWhoSwitchedNotificationsOff_orAreNotActive_areSkipped() {
        lenient().when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(List.of(assigned(assignee)));
        assignee.setTaskNotificationsEnabled(false);
        leader.setAccountStatus("SUSPENDED");

        service.notifyCommentAdded(comment("hi", null), actor);

        assertThat(recipients()).containsExactly("Olivia Bennett");
    }

    @Test
    void aLongComment_isShortenedInTheNotification() {
        lenient().when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(List.of());

        service.notifyCommentAdded(comment("word ".repeat(200), null), actor);

        String message = saved().get(0).getMessage();
        assertThat(message).endsWith("…").hasSizeLessThanOrEqualTo(500);
    }

    // ---- projects -----------------------------------------------------------

    @Test
    void anEditedProject_reachesTheAssigneesOfItsTasksAndTheLeaders_namingTheChangedFields() {
        lenient().when(taskAssigneeRepository.findByTask_ProjectIdIn(List.of(10L))).thenReturn(List.of(assigned(assignee)));

        int created = service.notifyProjectUpdated(project, actor, false, List.of("status", "end date"));

        assertThat(created).isEqualTo(3);
        assertThat(recipients()).containsExactlyInAnyOrder("Mia Park", "Olivia Bennett", "Owen Lead");
        Notification n = saved().get(0);
        assertThat(n.getType()).isEqualTo("PROJECT_UPDATED");
        assertThat(n.getTitle()).isEqualTo("Project updated");
        assertThat(n.getMessage()).contains("Chen Wu updated").contains("Website Redesign").contains("status, end date");
        assertThat(n.getTask()).isNull();
    }

    @Test
    void aCompletedProject_isAnnouncedAsCompleted() {
        lenient().when(taskAssigneeRepository.findByTask_ProjectIdIn(List.of(10L))).thenReturn(List.of());

        service.notifyProjectUpdated(project, actor, true, List.of("status"));

        Notification n = saved().get(0);
        assertThat(n.getTitle()).isEqualTo("Project completed");
        assertThat(n.getMessage()).contains("marked \"Website Redesign\" as completed");
    }

    // ---- milestones ---------------------------------------------------------

    @Test
    void anEditedMilestone_reachesTheAssigneesOfItsLinkedTasksAndTheLeaders() {
        Milestone milestone = new Milestone();
        ReflectionTestUtils.setField(milestone, "id", 3L);
        milestone.setProject(project);
        milestone.setTitle("Beta");
        lenient().when(taskRepository.findByMilestoneId(3L)).thenReturn(List.of(task));
        lenient().when(taskAssigneeRepository.findByTaskIdIn(List.of(5L))).thenReturn(List.of(assigned(assignee)));

        service.notifyMilestoneUpdated(milestone, actor, false, List.of("due date"));

        assertThat(recipients()).containsExactlyInAnyOrder("Mia Park", "Olivia Bennett", "Owen Lead");
        Notification n = saved().get(0);
        assertThat(n.getType()).isEqualTo("MILESTONE_UPDATED");
        assertThat(n.getTitle()).isEqualTo("Milestone updated");
        assertThat(n.getMessage()).contains("milestone \"Beta\"").contains("(due date)");
    }

    @Test
    void aMilestoneWithNoLinkedTasks_stillReachesTheLeaders() {
        Milestone milestone = new Milestone();
        ReflectionTestUtils.setField(milestone, "id", 3L);
        milestone.setProject(project);
        milestone.setTitle("Beta");
        lenient().when(taskRepository.findByMilestoneId(3L)).thenReturn(List.of());

        service.notifyMilestoneUpdated(milestone, actor, true, List.of("status"));

        assertThat(recipients()).containsExactlyInAnyOrder("Olivia Bennett", "Owen Lead");
        assertThat(saved().get(0).getTitle()).isEqualTo("Milestone completed");
        verify(taskAssigneeRepository, never()).findByTaskIdIn(any());
    }

    // ---- @mentions (G-14, D-21) -----------------------------------------------------------

    @Test
    void aMentionedPerson_getsATypeOfTheirOwn_naming_theAuthorTheTaskAndTheText() {
        service.notifyMentioned(comment("Can you check this, @mia?", null), actor, List.of(assignee, actor));

        assertThat(recipients()).containsExactly("Mia Park");
        Notification n = saved().get(0);
        assertThat(n.getType()).isEqualTo("MENTION");
        assertThat(n.getTitle()).isEqualTo("You were mentioned");
        assertThat(n.getMessage()).contains("Chen Wu mentioned you on").contains("Draft the homepage")
                .contains("Website Redesign").contains("Can you check this");
        assertThat(n.getTask()).isSameAs(task);
    }

    @Test
    void nobodyMentioned_createsNothing() {
        assertThat(service.notifyMentioned(comment("hi", null), actor, List.of())).isZero();
    }

    @Test
    void thePeopleAlreadyToldOfAMention_arePassedOverByTheGenericCommentNotice() {
        lenient().when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(List.of(assigned(assignee)));

        service.notifyCommentAdded(comment("Looks good @mia", null), actor, java.util.Set.of(assignee.getId()));

        assertThat(recipients()).containsExactlyInAnyOrder("Olivia Bennett", "Owen Lead");
    }
}
