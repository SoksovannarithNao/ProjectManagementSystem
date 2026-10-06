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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
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
    private NotificationService notificationService;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private TaskService service;

    private User caller;
    private Project current;
    private Project other;
    private Task task;

    @BeforeEach
    void setUp() {
        service = new TaskService(taskRepository, projectRepository, projectMemberRepository, milestoneRepository,
                userRepository, taskAssigneeRepository, subtaskRepository, taskDependencyRepository,
                notificationService, activityLogService, projectAccessGuard);

        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("pm.olivia");

        current = project(10L);
        other = project(20L);

        task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setProject(current);
        task.setTitle("Original title");
        task.setStatus("TO_DO");
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
        when(projectAccessGuard.canManage(caller, 10L)).thenReturn(true);
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCanManage(caller, 20L);

        assertThatThrownBy(() -> service.updateTask(5L, request(20L, "Original title", "TO_DO"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);

        verify(taskRepository, never()).save(any());
        assertThat(task.getProject().getId()).isEqualTo(10L);
    }

    @Test
    void manager_canMoveATaskIntoAProjectTheyAlsoManage() {
        when(projectAccessGuard.canManage(caller, 10L)).thenReturn(true);

        service.updateTask(5L, request(20L, "Original title", "TO_DO"), "pm.olivia");

        verify(projectAccessGuard).assertCanManage(caller, 20L);
        assertThat(task.getProject().getId()).isEqualTo(20L);
    }

    @Test
    void manager_editingWithinTheSameProject_needsNoCheckOnAnyOtherProject() {
        when(projectAccessGuard.canManage(caller, 10L)).thenReturn(true);

        service.updateTask(5L, request(10L, "Renamed", "TO_DO"), "pm.olivia");

        verify(projectAccessGuard, never()).assertCanManage(caller, 20L);
        assertThat(task.getTitle()).isEqualTo("Renamed");
    }

    // ---- assignees and read-only viewers --------------------------------

    @Test
    void assignedViewer_cannotEditTheirTask() {
        when(projectAccessGuard.canManage(caller, 10L)).thenReturn(false);
        when(projectAccessGuard.canEditContent(caller, 10L)).thenReturn(false);

        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "IN_PROGRESS"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("permission");

        verify(taskRepository, never()).save(any());
        assertThat(task.getStatus()).isEqualTo("TO_DO");
    }

    @Test
    void assignedMember_canChangeOnlyStatusAndProgress() {
        when(projectAccessGuard.canManage(caller, 10L)).thenReturn(false);
        when(projectAccessGuard.canEditContent(caller, 10L)).thenReturn(true);
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(true);
        when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(java.util.List.of());

        service.updateTask(5L, request(20L, "Hijacked title", "IN_PROGRESS"), "pm.olivia");

        assertThat(task.getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(task.getTitle()).isEqualTo("Original title");
        assertThat(task.getProject().getId()).isEqualTo(10L);
    }

    @Test
    void memberWhoIsNotAssigned_isRejected() {
        when(projectAccessGuard.canManage(caller, 10L)).thenReturn(false);
        when(projectAccessGuard.canEditContent(caller, 10L)).thenReturn(true);
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(false);

        assertThatThrownBy(() -> service.updateTask(5L, request(10L, "Original title", "IN_PROGRESS"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("not assigned");
        verify(taskRepository, never()).save(any());
    }
}
