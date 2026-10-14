package backend.service;

import backend.dto.TaskRequest;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.SubtaskRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskDependencyRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.repository.WorkLogRepository;
import backend.security.Action;
import backend.security.Resource;
import backend.util.PageParams;
import backend.util.TaskListQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
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

// Permission rules of TaskService.updateTask — in particular that moving a
// task into another project is checked against THAT project, and that a
// read-only VIEWER can't edit even a task assigned to them.
@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private MilestoneRepository milestoneRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TaskAssigneeRepository taskAssigneeRepository;
    @Mock
    private SubtaskRepository subtaskRepository;
    @Mock
    private TaskDependencyRepository taskDependencyRepository;
    @Mock
    private UpdateNotificationService updateNotificationService;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private WorkLogRepository workLogRepository;
    @Mock
    private TaskApprovalService approvalService;
    @Mock
    private backend.repository.ChecklistItemRepository checklistItemRepository;

    private TaskService service;

    private User caller;
    private Project current;
    private Project other;
    private Task task;

    @BeforeEach
    void setUp() {
        service = new TaskService(taskRepository, projectRepository, projectMemberRepository, milestoneRepository,
                userRepository, taskAssigneeRepository, subtaskRepository, taskDependencyRepository,
                updateNotificationService, activityLogService, projectAccessGuard, workLogRepository, approvalService, checklistItemRepository);

        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("pm.olivia");

        current = project(10L);
        other = project(20L);

        task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setProject(current);
        task.setTitle("Original title");
        task.setStatus("TODO");
        task.setPriority("MEDIUM");
        task.setStartDate(LocalDate.of(2026, 10, 1));
        task.setDueDate(LocalDate.of(2026, 10, 30));

        lenient().when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));
        lenient().when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        lenient().when(projectRepository.findById(10L)).thenReturn(Optional.of(current));
        lenient().when(projectRepository.findById(20L)).thenReturn(Optional.of(other));
        lenient().when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Project project(Long id) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        User manager = new User();
        ReflectionTestUtils.setField(manager, "id", 99L);
        p.setManager(manager);
        return p;
    }

    private TaskRequest request(Long projectId, String title, String status) {
        TaskRequest r = new TaskRequest();
        r.setProjectId(projectId);
        r.setTitle(title);
        r.setStatus(status);
        r.setPriority("MEDIUM");
        r.setStartDate(LocalDate.of(2026, 10, 1));
        r.setDueDate(LocalDate.of(2026, 10, 30));
        return r;
    }

    // ---- moving a task between projects ---------------------------------

    @Test
    void manager_cannotMoveATaskIntoAProjectTheyDoNotManage() {
        when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCan(caller, 20L, Resource.TASK, Action.EDIT);

        assertThatThrownBy(() -> service.updateTask(5L, request(20L, "Original title", "TODO"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);

        verify(taskRepository, never()).save(any());
        assertThat(task.getProject().getId()).isEqualTo(10L);
    }

    @Test
    void manager_canMoveATaskIntoAProjectTheyAlsoManage() {
        when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.updateTask(5L, request(20L, "Original title", "TODO"), "pm.olivia");

        verify(projectAccessGuard).assertCan(caller, 20L, Resource.TASK, Action.EDIT);
        assertThat(task.getProject().getId()).isEqualTo(20L);
    }

    @Test
    void manager_editingWithinTheSameProject_needsNoCheckOnAnyOtherProject() {
        when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.updateTask(5L, request(10L, "Renamed", "TODO"), "pm.olivia");

        verify(projectAccessGuard, never()).assertCan(caller, 20L, Resource.TASK, Action.EDIT);
        assertThat(task.getTitle()).isEqualTo("Renamed");
    }

    // ---- assignees and read-only viewers --------------------------------

    @Test
    void assignedViewer_cannotEditTheirTask() {
        doThrow(new AccessDeniedException("You do not have permission to edit task status in this project"))
                .when(projectAccessGuard).assertCan(caller, 10L, Resource.TASK_STATUS, Action.EDIT);

        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "IN_PROGRESS"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("permission");

        verify(taskRepository, never()).save(any());
        assertThat(task.getStatus()).isEqualTo("TODO");
    }

    @Test
    void assignedMember_canChangeOnlyStatusAndProgress() {
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(true);

        service.updateTask(5L, request(20L, "Hijacked title", "IN_PROGRESS"), "pm.olivia");

        assertThat(task.getStatus()).isEqualTo("IN_PROGRESS");
        // the status change is announced, with the person who made it so they are not told
        verify(updateNotificationService).notifyTaskStatusChanged(task, caller);
        assertThat(task.getTitle()).isEqualTo("Original title");
        assertThat(task.getProject().getId()).isEqualTo(10L);
    }

    @Test
    void memberWhoIsNotAssigned_isRejected() {
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(false);

        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "IN_PROGRESS"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("not assigned");
        verify(taskRepository, never()).save(any());
    }

    // ---- completing a task is an approval ---------------------------------

    @Test
    void memberWithoutApprove_cannotMarkATaskCompleted() {
        doThrow(new AccessDeniedException("Only a Project Manager or Team Leader can approve a task as completed"))
                .when(projectAccessGuard).assertCan(caller, 10L, Resource.TASK, Action.APPROVE);

        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "COMPLETED"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("approve");

        verify(taskRepository, never()).save(any());
        assertThat(task.getStatus()).isEqualTo("TODO");
    }

    @Test
    void approver_canMarkATaskCompleted() {
        when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.updateTask(5L, request(10L, "Original title", "COMPLETED"), "pm.olivia");

        verify(projectAccessGuard).assertCan(caller, 10L, Resource.TASK, Action.APPROVE);
        assertThat(task.getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void memberCanStillSubmitATaskForReview() {
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(true);

        service.updateTask(5L, request(10L, "Original title", "IN_REVIEW"), "pm.olivia");

        verify(projectAccessGuard, never()).assertCan(caller, 10L, Resource.TASK, Action.APPROVE);
        assertThat(task.getStatus()).isEqualTo("IN_REVIEW");
    }

    // ---- the approval trail follows the status ---------------------------------

    @Test
    void movingATaskToReview_opensAnApprovalRequest() {
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(true);

        service.updateTask(5L, request(10L, "Original title", "IN_REVIEW"), "pm.olivia");

        verify(approvalService).openRequest(task, caller);
        verify(approvalService, never()).recordDirectCompletion(any(), any());
    }

    @Test
    void completingATask_isCheckedAndRecordedAsTheApproval() {
        when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.updateTask(5L, request(10L, "Original title", "COMPLETED"), "pm.olivia");

        verify(approvalService).assertMayDecide(caller, task);
        verify(approvalService).recordDirectCompletion(task, caller);
    }

    @Test
    void anApproverWhoMayNotDecide_cannotCompleteTheTask() {
        doThrow(new AccessDeniedException("You cannot approve your own work. Another approver has to decide"))
                .when(approvalService).assertMayDecide(caller, task);

        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "COMPLETED"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("your own work");
        verify(taskRepository, never()).save(any());
        verify(approvalService, never()).recordDirectCompletion(any(), any());
    }

    @Test
    void takingATaskOutOfReview_withdrawsTheOpenRequest() {
        task.setStatus("IN_REVIEW");
        when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.updateTask(5L, request(10L, "Original title", "IN_PROGRESS"), "pm.olivia");

        verify(approvalService).withdrawPending(task, caller);
        verify(approvalService, never()).openRequest(any(), any());
    }

    @Test
    void anOrdinaryEdit_leavesTheApprovalTrailAlone() {
        when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        service.updateTask(5L, request(10L, "Renamed", "TODO"), "pm.olivia");

        verify(approvalService, never()).openRequest(any(), any());
        verify(approvalService, never()).withdrawPending(any(), any());
        verify(approvalService, never()).recordDirectCompletion(any(), any());
    }

    @Test
    void creatingATask_needsTaskCreate() {
        doThrow(new AccessDeniedException("You do not have permission to create tasks in this project"))
                .when(projectAccessGuard).assertCan(caller, 10L, Resource.TASK, Action.CREATE);

        assertThatThrownBy(() -> service.createTask(request(10L, "New", "TODO"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(taskRepository, never()).save(any());
    }

    // ---- status changes keep progress and dependencies consistent (Kanban moves, #35) ------

    private void asApproverEditor() {
        lenient().when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);
    }

    @Test
    void completingATask_makesItHundredPercent_whateverNumberWasSent() {
        asApproverEditor();
        task.setStatus("IN_PROGRESS");
        task.setProgress(new java.math.BigDecimal("40"));
        TaskRequest completing = request(10L, "Original title", "COMPLETED");
        completing.setProgress(new java.math.BigDecimal("40"));

        service.updateTask(5L, completing, "pm.olivia");

        assertThat(task.getProgress()).isEqualByComparingTo("100");
    }

    @Test
    void reopeningATaskWithNothingToDeriveProgressFrom_putsItBackToZero() {
        asApproverEditor();
        task.setStatus("COMPLETED");
        task.setProgress(new java.math.BigDecimal("100"));
        TaskRequest reopening = request(10L, "Original title", "TODO");
        reopening.setProgress(new java.math.BigDecimal("100"));

        service.updateTask(5L, reopening, "pm.olivia");

        assertThat(task.getStatus()).isEqualTo("TODO");
        assertThat(task.getProgress()).isEqualByComparingTo("0");
    }

    @Test
    void reopeningATaskWithSubtasksOrChecklistItems_leavesProgressToTheDatabaseToDerive() {
        asApproverEditor();
        task.setStatus("COMPLETED");
        task.setProgress(new java.math.BigDecimal("100"));
        when(subtaskRepository.existsByTaskId(5L)).thenReturn(true);

        service.updateTask(5L, request(10L, "Original title", "IN_PROGRESS"), "pm.olivia");

        assertThat(task.getProgress()).isEqualByComparingTo("100");
    }

    @Test
    void anOrdinaryEditOfAnOpenTask_doesNotTouchProgress() {
        asApproverEditor();
        task.setStatus("IN_PROGRESS");
        TaskRequest edit = request(10L, "New title", "IN_PROGRESS");
        edit.setProgress(new java.math.BigDecimal("35"));

        service.updateTask(5L, edit, "pm.olivia");

        assertThat(task.getProgress()).isEqualByComparingTo("35");
    }

    @Test
    void aPrerequisiteCannotLeaveCompleted_whileATaskThatDependsOnItHasStarted() {
        asApproverEditor();
        task.setStatus("COMPLETED");
        when(taskDependencyRepository.findStartedDependentTitles(5L)).thenReturn(List.of("Build the page", "Test the page"));

        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "TODO"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("prerequisite of tasks that have already started")
                .hasMessageContaining("Build the page, Test the page");
        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "CANCELLED"), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(taskRepository, never()).save(any());
        assertThat(task.getStatus()).isEqualTo("COMPLETED");
    }

    @Test
    void aPrerequisiteCanLeaveCompleted_whenNothingThatDependsOnItHasStarted() {
        asApproverEditor();
        task.setStatus("COMPLETED");
        when(taskDependencyRepository.findStartedDependentTitles(5L)).thenReturn(List.of());

        service.updateTask(5L, request(10L, "Original title", "IN_PROGRESS"), "pm.olivia");

        assertThat(task.getStatus()).isEqualTo("IN_PROGRESS");
    }

    @Test
    void theDependentsAreOnlyCheckedWhenALeavesCompleted() {
        asApproverEditor();
        task.setStatus("IN_PROGRESS");

        service.updateTask(5L, request(10L, "Original title", "IN_REVIEW"), "pm.olivia");

        verify(taskDependencyRepository, never()).findStartedDependentTitles(any());
    }

    @Test
    void getAllTasks_aSearchOnlyNarrowsTheTasksOfTheCallersProjects() {
        when(projectAccessGuard.isAdmin(caller)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L));
        when(taskRepository.findByProjectIdIn(List.of(10L))).thenReturn(List.of(task));

        List<backend.dto.TaskResponse> narrowed = service.getAllTasks("pm.olivia",
                new TaskListQuery("no such title", null, null, null, null, null, null));
        List<backend.dto.TaskResponse> found = service.getAllTasks("pm.olivia",
                new TaskListQuery("original", null, null, null, null, null, null));

        // A task of a project the caller is not a member of is never loaded, so no query can find it.
        assertThat(narrowed).isEmpty();
        assertThat(found).extracting(backend.dto.TaskResponse::getTitle).containsExactly("Original title");
        verify(taskRepository, never()).findAll();
    }

    // ---- one page at a time (risk R-5) ---------------------------------------

    private Task taskWithId(Long id, String title) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", id);
        t.setProject(current);
        t.setTitle(title);
        t.setStatus("TODO");
        t.setPriority("MEDIUM");
        t.setStartDate(LocalDate.of(2026, 10, 1));
        t.setDueDate(LocalDate.of(2026, 10, 30));
        return t;
    }

    @Test
    void getTasksPage_buildsOnlyTheRequestedPageInIdOrderAndReportsTheTotalOfAllThatMatch() {
        when(projectAccessGuard.isAdmin(caller)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L));
        when(taskRepository.findByProjectIdIn(List.of(10L)))
                .thenReturn(List.of(taskWithId(9L, "Nine"), taskWithId(5L, "Five"), taskWithId(7L, "Seven")));

        backend.dto.PageResponse<backend.dto.TaskResponse> page = service.getTasksPage("pm.olivia",
                new TaskListQuery(null, null, null, null, null, null, null), PageParams.of(0, 2));

        assertThat(page.getItems()).extracting(backend.dto.TaskResponse::getId).containsExactly(5L, 7L);
        assertThat(page.getTotal()).isEqualTo(3);
        assertThat(page.getPage()).isZero();
        assertThat(page.getSize()).isEqualTo(2);
        // the work behind a response (subtask counts, hours, approvals...) was done for the two
        // tasks of the page, not for all three
        org.mockito.ArgumentCaptor<List<Long>> ids = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(subtaskRepository).countByTaskIds(ids.capture());
        assertThat(ids.getValue()).containsExactlyInAnyOrder(5L, 7L);
    }

    @Test
    void getTasksPage_pagesTheFilteredList() {
        when(projectAccessGuard.isAdmin(caller)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L));
        Task done = taskWithId(6L, "Done one");
        done.setStatus("COMPLETED");
        when(taskRepository.findByProjectIdIn(List.of(10L))).thenReturn(List.of(taskWithId(5L, "Five"), done, taskWithId(7L, "Seven")));

        backend.dto.PageResponse<backend.dto.TaskResponse> page = service.getTasksPage("pm.olivia",
                new TaskListQuery(null, List.of("TODO"), null, null, null, null, null), PageParams.of(1, 1));

        assertThat(page.getItems()).extracting(backend.dto.TaskResponse::getId).containsExactly(7L);
        assertThat(page.getTotal()).isEqualTo(2);
    }
}
