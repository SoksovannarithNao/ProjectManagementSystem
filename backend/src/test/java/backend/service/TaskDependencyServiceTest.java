package backend.service;

import backend.dto.TaskDependencyRequest;
import backend.dto.TaskDependencyResponse;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.TaskDependency;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Task dependencies (workflow A4, brief B1.8, G-20): a dependency joins two tasks of one project.
@ExtendWith(MockitoExtension.class)
class TaskDependencyServiceTest {

    @Mock
    private TaskDependencyRepository taskDependencyRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private TaskDependencyService service;
    private User caller;
    private Task blocked;
    private Task sameProjectBlocker;
    private Task otherProjectBlocker;

    @BeforeEach
    void setUp() {
        service = new TaskDependencyService(taskDependencyRepository, taskRepository, userRepository,
                projectMemberRepository, projectAccessGuard);
        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("pm.olivia");
        lenient().when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));

        Project current = project(10L);
        Project other = project(20L);
        blocked = task(1L, current);
        sameProjectBlocker = task(2L, current);
        otherProjectBlocker = task(3L, other);
        lenient().when(taskRepository.findById(1L)).thenReturn(Optional.of(blocked));
        lenient().when(taskRepository.findById(2L)).thenReturn(Optional.of(sameProjectBlocker));
        lenient().when(taskRepository.findById(3L)).thenReturn(Optional.of(otherProjectBlocker));
    }

    private Project project(Long id) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        p.setManager(caller);
        return p;
    }

    private Task task(Long id, Project project) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", id);
        t.setProject(project);
        t.setTitle("Task " + id);
        return t;
    }

    private TaskDependencyRequest request(Long taskId, Long dependsOnTaskId) {
        TaskDependencyRequest r = new TaskDependencyRequest();
        r.setTaskId(taskId);
        r.setDependsOnTaskId(dependsOnTaskId);
        return r;
    }

    @Test
    void twoTasksOfTheSameProject_canBeLinked() {
        when(taskDependencyRepository.save(any(TaskDependency.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskDependencyResponse created = service.createTaskDependency(request(1L, 2L), "pm.olivia");

        assertThat(created).isNotNull();
        verify(projectAccessGuard).assertCan(caller, 10L, Resource.TASK, Action.ASSIGN);
        verify(taskDependencyRepository).save(any(TaskDependency.class));
    }

    @Test
    void aTaskOfAnotherProject_isRefusedEvenForSomeoneWhoIsInBoth() {
        assertThatThrownBy(() -> service.createTaskDependency(request(1L, 3L), "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("same project");

        verify(taskDependencyRepository, never()).save(any());
    }

    @Test
    void aTaskOfAProjectTheCallerCannotSee_isNotFound() {
        doThrow(new NotFoundException("Project not found")).when(projectAccessGuard).assertAccess(caller, 20L);

        assertThatThrownBy(() -> service.createTaskDependency(request(1L, 3L), "pm.olivia"))
                .isInstanceOf(NotFoundException.class);

        verify(taskDependencyRepository, never()).save(any());
    }

    @Test
    void withoutTheAssignPermission_nothingIsSaved() {
        doThrow(new AccessDeniedException("no")).when(projectAccessGuard)
                .assertCan(caller, 10L, Resource.TASK, Action.ASSIGN);

        assertThatThrownBy(() -> service.createTaskDependency(request(1L, 2L), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);

        verify(taskDependencyRepository, never()).save(any());
    }
}
