package backend.service;

import backend.dto.WorkLogRequest;
import backend.dto.WorkLogResponse;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.entity.WorkLog;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.repository.WorkLogRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkLogServiceTest {

    @Mock
    private WorkLogRepository workLogRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private WorkLogService service;
    private User caller;
    private Task task;

    @BeforeEach
    void setUp() {
        service = new WorkLogService(workLogRepository, taskRepository, userRepository, projectAccessGuard);

        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("dev.mia");
        caller.setFullName("Mia Alvarez");
        when(userRepository.findByUsername("dev.mia")).thenReturn(Optional.of(caller));

        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setProject(project);
    }

    private WorkLogRequest request(LocalDate date, String hours, String description) {
        WorkLogRequest r = new WorkLogRequest();
        r.setTaskId(5L);
        r.setWorkDate(date);
        r.setHoursWorked(new BigDecimal(hours));
        r.setDescription(description);
        return r;
    }

    @Test
    void createWorkLogRecordsHoursForTheCaller() {
        when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        when(workLogRepository.save(any(WorkLog.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkLogResponse response = service.createWorkLog(request(LocalDate.now(), "1.50", "  Wrote the tests  "), "dev.mia");

        assertThat(response.getHoursWorked()).isEqualByComparingTo("1.5");
        assertThat(response.getUserId()).isEqualTo(1L);
        assertThat(response.getAuthorName()).isEqualTo("Mia Alvarez");
        assertThat(response.getDescription()).isEqualTo("Wrote the tests");
        verify(projectAccessGuard).assertCan(caller, 10L, Resource.WORK_LOG, Action.CREATE);
    }

    @Test
    void createWorkLogStoresBlankDescriptionAsNull() {
        when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        when(workLogRepository.save(any(WorkLog.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkLogResponse response = service.createWorkLog(request(LocalDate.now(), "2", "   "), "dev.mia");

        assertThat(response.getDescription()).isNull();
    }

    @Test
    void createWorkLogRejectsAFutureDate() {
        when(taskRepository.findById(5L)).thenReturn(Optional.of(task));

        assertThatThrownBy(() -> service.createWorkLog(request(LocalDate.now().plusDays(1), "1", null), "dev.mia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("future");
        verify(workLogRepository, never()).save(any());
    }

    @Test
    void createWorkLogRefusesAReadOnlyViewer() {
        when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        doThrow(new AccessDeniedException("read-only")).when(projectAccessGuard).assertCan(caller, 10L, Resource.WORK_LOG, Action.CREATE);

        assertThatThrownBy(() -> service.createWorkLog(request(LocalDate.now(), "1", null), "dev.mia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(workLogRepository, never()).save(any());
    }

    private WorkLog logBy(Long authorId) {
        User author = new User();
        ReflectionTestUtils.setField(author, "id", authorId);
        WorkLog log = new WorkLog();
        ReflectionTestUtils.setField(log, "id", 7L);
        log.setTask(task);
        log.setUser(author);
        log.setHoursWorked(new BigDecimal("1"));
        log.setWorkDate(LocalDate.now());
        return log;
    }

    @Test
    void authorCanDeleteTheirOwnEntry() {
        WorkLog log = logBy(1L);
        when(workLogRepository.findById(7L)).thenReturn(Optional.of(log));

        service.deleteWorkLog(7L, "dev.mia");

        verify(workLogRepository).delete(log);
    }

    @Test
    void projectManagerCanDeleteSomeoneElsesEntry() {
        WorkLog log = logBy(2L);
        when(workLogRepository.findById(7L)).thenReturn(Optional.of(log));
        when(projectAccessGuard.can(caller, 10L, Resource.WORK_LOG, Action.DELETE)).thenReturn(true);

        service.deleteWorkLog(7L, "dev.mia");

        verify(workLogRepository).delete(log);
    }

    @Test
    void anotherMemberCannotDeleteSomeoneElsesEntry() {
        WorkLog log = logBy(2L);
        when(workLogRepository.findById(7L)).thenReturn(Optional.of(log));
        when(projectAccessGuard.can(caller, 10L, Resource.WORK_LOG, Action.DELETE)).thenReturn(false);

        assertThatThrownBy(() -> service.deleteWorkLog(7L, "dev.mia"))
                .isInstanceOf(AccessDeniedException.class);
        verify(workLogRepository, never()).delete(any());
    }
}
