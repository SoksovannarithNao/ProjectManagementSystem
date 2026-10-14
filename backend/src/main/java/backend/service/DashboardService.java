package backend.service;

import backend.dto.DashboardStatsResponse;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.util.Derived;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

// The dashboard's project and task statistics (assignment-brief.md B1.3, D-06),
// over what the caller may see: every project for an administrator, otherwise
// the projects they are an active member of and the tasks in them.
@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final int DELAYED_LIST_SIZE = 5;

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public DashboardService(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    public DashboardStatsResponse getStats(String username) {
        return getStats(username, LocalDate.now());
    }

    // `today` is a parameter so the "delayed" and "overdue" rules can be tested on fixed dates.
    DashboardStatsResponse getStats(String username, LocalDate today) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        List<Project> projects;
        List<Task> tasks;
        if (projectAccessGuard.isAdmin(caller)) {
            projects = projectRepository.findAll();
            tasks = taskRepository.findAll();
        } else {
            List<Long> visible = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            projects = projectRepository.findByIdIn(visible);
            tasks = taskRepository.findByProjectIdIn(visible);
        }
        return new DashboardStatsResponse(projectStats(projects, today), taskStats(tasks, today), delayedList(projects, today));
    }

    private static DashboardStatsResponse.ProjectStats projectStats(List<Project> projects, LocalDate today) {
        long delayed = projects.stream()
                .filter(p -> Derived.isProjectDelayed(p.getStatus(), p.getEndDate(), today))
                .count();
        List<BigDecimal> progress = projects.stream()
                .filter(p -> !"CANCELLED".equals(p.getStatus()))
                .map(p -> p.getProgress() != null ? p.getProgress() : BigDecimal.ZERO)
                .toList();
        BigDecimal average = progress.isEmpty() ? BigDecimal.ZERO
                : progress.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(progress.size()), 1, RoundingMode.HALF_UP);
        return new DashboardStatsResponse.ProjectStats(
                projects.size(),
                countProjects(projects, "PLANNING"),
                countProjects(projects, "IN_PROGRESS"),
                countProjects(projects, "ON_HOLD"),
                countProjects(projects, "COMPLETED"),
                countProjects(projects, "CANCELLED"),
                delayed,
                average);
    }

    private static long countProjects(List<Project> projects, String status) {
        return projects.stream().filter(p -> status.equals(p.getStatus())).count();
    }

    private static DashboardStatsResponse.TaskStats taskStats(List<Task> tasks, LocalDate today) {
        long overdue = tasks.stream().filter(t -> Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), today)).count();
        return new DashboardStatsResponse.TaskStats(
                tasks.size(),
                countTasks(tasks, "TODO"),
                countTasks(tasks, "IN_PROGRESS"),
                countTasks(tasks, "IN_REVIEW"),
                countTasks(tasks, "COMPLETED"),
                countTasks(tasks, "CANCELLED"),
                overdue);
    }

    private static long countTasks(List<Task> tasks, String status) {
        return tasks.stream().filter(t -> status.equals(t.getStatus())).count();
    }

    // The most-late delayed projects first.
    private static List<DashboardStatsResponse.DelayedProject> delayedList(List<Project> projects, LocalDate today) {
        return projects.stream()
                .filter(p -> Derived.isProjectDelayed(p.getStatus(), p.getEndDate(), today))
                .sorted(Comparator.comparing(Project::getEndDate))
                .limit(DELAYED_LIST_SIZE)
                .map(p -> new DashboardStatsResponse.DelayedProject(p.getId(), p.getProjectCode(), p.getName(),
                        p.getEndDate(), Derived.daysLate(p.getEndDate(), today), p.getProgress(), p.getStatus()))
                .toList();
    }
}
