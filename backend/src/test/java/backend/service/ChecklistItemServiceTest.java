package backend.service;

import backend.dto.ChecklistItemRequest;
import backend.dto.ChecklistItemResponse;
import backend.entity.ChecklistItem;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ChecklistItemRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Checklist items (assignment-brief.md B1.6, B3.4, D-07): who adds, ticks and deletes.
@ExtendWith(MockitoExtension.class)
class ChecklistItemServiceTest {

    @Mock
    private ChecklistItemRepository checklistItemRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TaskAssigneeRepository taskAssigneeRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private ChecklistItemService service;
    private User member;
    private User leader;
    private Task task;

    @BeforeEach
    void setUp() {
        service = new ChecklistItemService(checklistItemRepository, taskRepository, userRepository,
                taskAssigneeRepository, projectAccessGuard);
        member = user(1L, "dev.chen");
        leader = user(2L, "lead.owen");
        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setProject(project);
        lenient().when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        lenient().when(checklistItemRepository.save(any(ChecklistItem.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private User user(Long id, String username) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        u.setFullName(username);
        lenient().when(userRepository.findByUsername(username)).thenReturn(Optional.of(u));
        return u;
    }

    private ChecklistItemRequest request(Long taskId, String content, Boolean completed) {
        ChecklistItemRequest r = new ChecklistItemRequest();
        r.setTaskId(taskId);
        r.setContent(content);
        r.setCompleted(completed);
        return r;
    }

    private ChecklistItem item(User author) {
        ChecklistItem i = new ChecklistItem();
        ReflectionTestUtils.setField(i, "id", 9L);
        i.setTask(task);
        i.setContent("Write the tests");
        i.setCreatedBy(author);
        lenient().when(checklistItemRepository.findById(9L)).thenReturn(Optional.of(i));
        return i;
    }

    @Test
    void aMember_addsAnItem_itIsLastInTheList_andRemembersWhoAddedIt() {
        when(checklistItemRepository.maxSortOrder(5L)).thenReturn(3);

        ChecklistItemResponse response = service.create(request(5L, "  Write the tests  ", null), "dev.chen");

        assertThat(response.getContent()).isEqualTo("Write the tests");
        assertThat(response.isCompleted()).isFalse();
        assertThat(response.getSortOrder()).isEqualTo(4);
        assertThat(response.getCreatedById()).isEqualTo(1L);
        verify(projectAccessGuard).assertCan(member, 10L, Resource.CHECKLIST_ITEM, Action.CREATE);
    }

    @Test
    void aViewer_cannotAddAnItem() {
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard)
                .assertCan(member, 10L, Resource.CHECKLIST_ITEM, Action.CREATE);

        assertThatThrownBy(() -> service.create(request(5L, "x", null), "dev.chen"))
                .isInstanceOf(AccessDeniedException.class);
        verify(checklistItemRepository, never()).save(any());
    }

    @Test
    void anItemNeedsATask() {
        assertThatThrownBy(() -> service.create(request(null, "x", null), "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(request(404L, "x", null), "dev.chen"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void aMember_ticksAnItemOnATaskAssignedToThem() {
        ChecklistItem i = item(leader);
        when(projectAccessGuard.can(member, 10L, Resource.TASK, Action.EDIT)).thenReturn(false);
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(true);

        ChecklistItemResponse response = service.update(9L, request(null, "Write the tests", true), "dev.chen");

        assertThat(response.isCompleted()).isTrue();
        assertThat(i.isCompleted()).isTrue();
    }

    @Test
    void aMember_cannotChangeTheChecklistOfATaskNotAssignedToThem() {
        item(leader);
        when(projectAccessGuard.can(member, 10L, Resource.TASK, Action.EDIT)).thenReturn(false);
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(false);

        assertThatThrownBy(() -> service.update(9L, request(null, "x", true), "dev.chen"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("assigned to you");
        verify(checklistItemRepository, never()).save(any());
    }

    @Test
    void aTeamLeader_changesAnyItem() {
        ChecklistItem i = item(member);
        when(projectAccessGuard.can(leader, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.update(9L, request(null, "Renamed", false), "lead.owen");

        assertThat(i.getContent()).isEqualTo("Renamed");
    }

    @Test
    void leavingCompletedOut_keepsTheCurrentState() {
        ChecklistItem i = item(member);
        i.setCompleted(true);
        when(projectAccessGuard.can(leader, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.update(9L, request(null, "Same", null), "lead.owen");

        assertThat(i.isCompleted()).isTrue();
    }

    @Test
    void theAuthor_deletesTheirOwnItem_evenWithoutDeleteRights() {
        ChecklistItem i = item(member);

        service.delete(9L, "dev.chen");

        verify(checklistItemRepository).delete(i);
    }

    @Test
    void aMember_cannotDeleteSomeoneElsesItem_butALeaderCan() {
        ChecklistItem i = item(user(3L, "design.luna"));
        when(projectAccessGuard.can(member, 10L, Resource.CHECKLIST_ITEM, Action.DELETE)).thenReturn(false);
        when(projectAccessGuard.can(leader, 10L, Resource.CHECKLIST_ITEM, Action.DELETE)).thenReturn(true);

        assertThatThrownBy(() -> service.delete(9L, "dev.chen")).isInstanceOf(AccessDeniedException.class);
        verify(checklistItemRepository, never()).delete(any());

        service.delete(9L, "lead.owen");
        verify(checklistItemRepository).delete(i);
    }

    @Test
    void listsTheItemsOfATask_forAMember() {
        ChecklistItem i = item(leader);
        when(checklistItemRepository.findByTaskIdOrderBySortOrderAscIdAsc(5L)).thenReturn(List.of(i));

        assertThat(service.getByTask(5L, "dev.chen")).hasSize(1);
        verify(projectAccessGuard).assertAccess(member, 10L);
    }
}
