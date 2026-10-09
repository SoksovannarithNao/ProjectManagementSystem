package backend.service;

import backend.dto.ActivityLogResponse;
import backend.entity.ActivityLog;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ActivityLogRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The project-wide activity feed and project-level events.
@ExtendWith(MockitoExtension.class)
class ActivityLogServiceTest {

    @Mock
    private ActivityLogRepository activityLogRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private backend.repository.ProjectMemberRepository projectMemberRepository;

    private ActivityLogService service;
    private User member;
    private Project project;

    @BeforeEach
    void setUp() {
        service = new ActivityLogService(activityLogRepository, taskRepository, userRepository, projectAccessGuard,
                projectMemberRepository);
        member = new User();
        ReflectionTestUtils.setField(member, "id", 1L);
        member.setUsername("dev.chen");
        member.setFullName("Chen");
        project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        lenient().when(userRepository.findByUsername("dev.chen")).thenReturn(Optional.of(member));
    }

    private ActivityLog entry(String action, Task task) {
        ActivityLog log = new ActivityLog();
        log.setUser(member);
        log.setProject(project);
        log.setTask(task);
        log.setAction(action);
        log.setDescription("something happened");
        return log;
    }

    @Test
    void theProjectFeed_listsEntriesWithAndWithoutATask() {
        Task task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setTitle("Build it");
        when(activityLogRepository.findByProjectIdOrderByCreatedAtDescIdDesc(eq(10L), any(Pageable.class)))
                .thenReturn(List.of(entry("TASK_CREATED", task), entry("PROJECT_UPDATED", null)));

        List<ActivityLogResponse> feed = service.getActivityByProjectId(10L, 50, "dev.chen");

        assertThat(feed).hasSize(2);
        assertThat(feed.get(0).getTaskId()).isEqualTo(5L);
        assertThat(feed.get(0).getTaskTitle()).isEqualTo("Build it");
        assertThat(feed.get(0).getUserName()).isEqualTo("Chen");
        assertThat(feed.get(1).getTaskId()).isNull();
        verify(projectAccessGuard).assertAccess(member, 10L);
    }

    @Test
    void theFeedIsLimited_betweenOneAndTwoHundred() {
        when(activityLogRepository.findByProjectIdOrderByCreatedAtDescIdDesc(eq(10L), any(Pageable.class)))
                .thenReturn(List.of());

        service.getActivityByProjectId(10L, 100000, "dev.chen");
        service.getActivityByProjectId(10L, -5, "dev.chen");

        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(activityLogRepository, org.mockito.Mockito.times(2))
                .findByProjectIdOrderByCreatedAtDescIdDesc(eq(10L), page.capture());
        assertThat(page.getAllValues()).extracting(Pageable::getPageSize).containsExactly(200, 1);
    }

    @Test
    void aStranger_cannotReadTheFeed() {
        doThrow(new NotFoundException("Project not found")).when(projectAccessGuard).assertAccess(member, 10L);

        assertThatThrownBy(() -> service.getActivityByProjectId(10L, 50, "dev.chen"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void aProjectEvent_isStoredAgainstTheProjectWithoutATask() {
        service.recordProjectEvent(member, project, "PROJECT_UPDATED", "Project updated (status)");

        ArgumentCaptor<ActivityLog> saved = ArgumentCaptor.forClass(ActivityLog.class);
        verify(activityLogRepository).save(saved.capture());
        assertThat(saved.getValue().getProject()).isSameAs(project);
        assertThat(saved.getValue().getTask()).isNull();
        assertThat(saved.getValue().getAction()).isEqualTo("PROJECT_UPDATED");
    }

    // ---- the dashboard's recent activity -------------------------------------

    @Test
    void recentActivity_forAMember_coversOnlyTheirProjects_andNamesTheProject() {
        when(projectAccessGuard.isAdmin(member)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of(10L, 11L));
        when(activityLogRepository.findByProjectIdInOrderByCreatedAtDescIdDesc(eq(List.of(10L, 11L)), any(Pageable.class)))
                .thenReturn(List.of(entry("PROJECT_UPDATED", null)));
        project.setName("Website Redesign");

        List<ActivityLogResponse> recent = service.getRecentActivity(8, "dev.chen");

        assertThat(recent).hasSize(1);
        assertThat(recent.get(0).getProjectId()).isEqualTo(10L);
        assertThat(recent.get(0).getProjectName()).isEqualTo("Website Redesign");
    }

    @Test
    void recentActivity_forAMemberOfNothing_isEmpty_withoutAskingTheDatabaseForEveryProject() {
        when(projectAccessGuard.isAdmin(member)).thenReturn(false);
        when(projectMemberRepository.findProjectIdsByUserId(1L)).thenReturn(List.of());

        assertThat(service.getRecentActivity(8, "dev.chen")).isEmpty();
        verify(activityLogRepository, org.mockito.Mockito.never()).findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class));
    }

    @Test
    void recentActivity_forAnAdministrator_isEverywhere_andTheLimitIsClamped() {
        when(projectAccessGuard.isAdmin(member)).thenReturn(true);
        when(activityLogRepository.findAllByOrderByCreatedAtDescIdDesc(any(Pageable.class))).thenReturn(List.of());

        service.getRecentActivity(9999, "dev.chen");

        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(activityLogRepository).findAllByOrderByCreatedAtDescIdDesc(page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(50);
    }
}
