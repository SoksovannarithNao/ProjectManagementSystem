package backend.service;

import backend.dto.SubtaskRequest;
import backend.entity.Project;
import backend.entity.Subtask;
import backend.entity.Task;
import backend.entity.User;
import backend.repository.SubtaskRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskDependencyRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Touching a subtask on a task that has not been started moves the task to In Progress, and that is
// announced like any other status change (issue I-17).
@ExtendWith(MockitoExtension.class)
class SubtaskServiceTest {

    @Mock
    private SubtaskRepository subtaskRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskDependencyRepository taskDependencyRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private TaskAssigneeRepository taskAssigneeRepository;
    @Mock
    private UpdateNotificationService updateNotificationService;

    private SubtaskService service;
    private User caller;
    private Task task;
    private Subtask subtask;

    @BeforeEach
    void setUp() {
        service = new SubtaskService(subtaskRepository, taskRepository, taskDependencyRepository, userRepository,
                activityLogService, projectAccessGuard, taskAssigneeRepository, updateNotificationService);
        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("lead.owen");
        lenient().when(userRepository.findByUsername("lead.owen")).thenReturn(Optional.of(caller));

        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        task = new Task();
        ReflectionTestUtils.setField(task, "id", 64L);
        task.setProject(project);
        task.setTitle("Some task");
        task.setStatus("TODO");

        subtask = new Subtask();
        ReflectionTestUtils.setField(subtask, "id", 8L);
        subtask.setTask(task);
        subtask.setTitle("Existing");
        subtask.setStatus("TODO");
        when(subtaskRepository.findById(8L)).thenReturn(Optional.of(subtask));
        lenient().when(subtaskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(taskRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(projectAccessGuard.can(caller, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);
    }

    private SubtaskRequest completeIt() {
        SubtaskRequest request = new SubtaskRequest();
        request.setTaskId(64L);
        request.setTitle("Existing");
        request.setStatus("COMPLETED");
        return request;
    }

    @Test
    void touchingASubtaskOfATaskNotStarted_startsTheTask_andAnnouncesTheChange() {
        service.updateSubtask(8L, completeIt(), "lead.owen");

        assertThat(task.getStatus()).isEqualTo("IN_PROGRESS");
        verify(updateNotificationService).notifyTaskStatusChanged(task, caller);
    }

    @Test
    void aTaskAlreadyUnderWay_isNotChangedAndNothingIsAnnounced() {
        task.setStatus("IN_REVIEW");

        service.updateSubtask(8L, completeIt(), "lead.owen");

        assertThat(task.getStatus()).isEqualTo("IN_REVIEW");
        verify(updateNotificationService, never()).notifyTaskStatusChanged(any(), any());
    }

    @Test
    void aTaskBlockedByAnUnfinishedDependency_staysAsItIsAndNothingIsAnnounced() {
        when(taskDependencyRepository.existsByTaskIdAndDependsOnTaskStatusNot(64L, "COMPLETED")).thenReturn(true);

        service.updateSubtask(8L, completeIt(), "lead.owen");

        assertThat(task.getStatus()).isEqualTo("TODO");
        verify(updateNotificationService, never()).notifyTaskStatusChanged(any(), any());
        verify(activityLogService, never()).record(any(), any(), org.mockito.ArgumentMatchers.eq("TASK_STATUS_CHANGED"), anyString());
    }
}
