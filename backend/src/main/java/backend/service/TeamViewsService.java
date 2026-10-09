package backend.service;

import backend.dto.TeamViewsResponse;
import backend.dto.UserResponse;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.repository.WorkLogRepository;
import backend.security.Action;
import backend.security.Resource;
import backend.util.Derived;
import backend.util.WorkloadClassifier;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// The manager views of a team (assignment-brief.md Part A: Team Tasks and Team
// Workload; workflow flows 22 and 30).
//
//  * Team Tasks: for one project, every active member with the tasks assigned
//    to them and how far along they are, plus the tasks nobody has yet.
//  * Workload: per member, assigned / active / overdue tasks, estimated and
//    actual hours, and whether they carry clearly more or less than the team
//    average (D-13).
//
// Both are for people who manage the work - the right to assign tasks in the
// project (TASK:ASSIGN: the Owner, a Team Leader, an Administrator). Cancelled
// tasks are left out: they are not remaining work. Everything is computed here,
// from the same assignments, statuses and work logs, so every screen agrees.
@Service
@Transactional(readOnly = true)
public class TeamViewsService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final WorkLogRepository workLogRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public TeamViewsService(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            TaskRepository taskRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            WorkLogRepository workLogRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.taskRepository = taskRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.workLogRepository = workLogRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    // ---------------------------------------------------------------- Team Tasks

    public TeamViewsResponse.TeamTasks getTeamTasks(Long projectId, String username) {
        return getTeamTasks(projectId, username, LocalDate.now());
    }

    TeamViewsResponse.TeamTasks getTeamTasks(Long projectId, String username, LocalDate today) {
        User caller = requireUser(username);
        Project project = requireProject(projectId);
        assertManages(caller, projectId, "see the team's tasks");

        Team team = loadTeam(List.of(projectId));
        List<TeamViewsResponse.MemberTasks> members = new ArrayList<>();
        for (ProjectMember pm : team.members) {
            List<Assignment> mine = team.assignmentsOf(pm.getUser().getId());
            List<TeamViewsResponse.TeamTask> tasks = mine.stream()
                    .sorted(Comparator.comparing((Assignment a) -> finished(a.task().getStatus()))
                            .thenComparing(a -> a.task().getDueDate()))
                    .map(a -> toTeamTask(a.task(), a.assignmentId(), today))
                    .toList();
            long completed = mine.stream().filter(a -> "COMPLETED".equals(a.task().getStatus())).count();
            long active = mine.stream().filter(a -> "IN_PROGRESS".equals(a.task().getStatus())).count();
            long overdue = mine.stream()
                    .filter(a -> Derived.isTaskOverdue(a.task().getStatus(), a.task().getDueDate(), today)).count();
            members.add(new TeamViewsResponse.MemberTasks(new UserResponse(pm.getUser()), pm.getProjectRole(),
                    mine.size(), completed, active, overdue, averageProgress(mine), tasks));
        }
        List<TeamViewsResponse.TeamTask> unassigned = team.tasks.stream()
                .filter(t -> !team.assigned.containsKey(t.getId()))
                .sorted(Comparator.comparing(Task::getDueDate))
                .map(t -> toTeamTask(t, null, today))
                .toList();
        return new TeamViewsResponse.TeamTasks(projectId, project.getName(), members, unassigned);
    }

    private static TeamViewsResponse.TeamTask toTeamTask(Task t, Long assignmentId, LocalDate today) {
        return new TeamViewsResponse.TeamTask(t.getId(), t.getTitle(), t.getStatus(), t.getPriority(), t.getStartDate(),
                t.getDueDate(), t.getProgress(), Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), today),
                t.getEstimatedHours(), assignmentId);
    }

    private static BigDecimal averageProgress(List<Assignment> assignments) {
        if (assignments.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = assignments.stream()
                .map(a -> a.task().getProgress() != null ? a.task().getProgress() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(assignments.size()), 1, RoundingMode.HALF_UP);
    }

    private static boolean finished(String status) {
        return "COMPLETED".equals(status);
    }

    // ---------------------------------------------------------------- Workload

    // projectId = one project's team; null = every project the caller manages.
    public TeamViewsResponse.Workload getWorkload(Long projectId, String username) {
        return getWorkload(projectId, username, LocalDate.now());
    }

    TeamViewsResponse.Workload getWorkload(Long projectId, String username, LocalDate today) {
        User caller = requireUser(username);
        List<Long> projectIds;
        String projectName = null;
        if (projectId != null) {
            projectName = requireProject(projectId).getName();
            assertManages(caller, projectId, "see the team's workload");
            projectIds = List.of(projectId);
        } else {
            projectIds = managedProjectIds(caller);
            if (projectIds.isEmpty()) {
                throw new AccessDeniedException(
                        "Only an Owner, a Team Leader or an Administrator can see the team's workload");
            }
        }

        return buildWorkload(projectIds, projectId, projectName, today);
    }

    // The workload of everyone working on the given projects. Shared with the
    // Workload Report (ReportService), whose access rule is GENERATE_REPORTS rather
    // than the right to assign tasks - the caller has already been checked.
    TeamViewsResponse.Workload buildWorkload(List<Long> projectIds, Long projectId, String projectName, LocalDate today) {
        Team team = loadTeam(projectIds);
        Map<Long, BigDecimal> actualHours = new HashMap<>();
        if (!projectIds.isEmpty()) {
            for (var row : workLogRepository.sumHoursByUserForProjects(projectIds)) {
                actualHours.put(row.getUserId(), row.getHours());
            }
        }

        // One row per person (a person on several projects counts once, with all their work).
        // An Owner or Team Leader manages the work rather than carrying a share of it, so
        // they appear - and count toward the team average - only when work is assigned to
        // them; otherwise they would always look "underloaded".
        Map<Long, User> people = new LinkedHashMap<>();
        for (ProjectMember pm : team.members) {
            boolean worker = "MEMBER".equals(pm.getProjectRole()) || !team.assignmentsOf(pm.getUser().getId()).isEmpty();
            if (worker) {
                people.putIfAbsent(pm.getUser().getId(), pm.getUser());
            }
        }
        List<User> ordered = people.values().stream().sorted(Comparator.comparing(User::getFullName)).toList();

        List<long[]> counts = new ArrayList<>();
        List<BigDecimal> hours = new ArrayList<>();
        List<WorkloadClassifier.Load> loads = new ArrayList<>();
        for (User person : ordered) {
            List<Assignment> mine = team.assignmentsOf(person.getId());
            long active = mine.stream().filter(a -> "IN_PROGRESS".equals(a.task().getStatus())).count();
            long overdue = mine.stream()
                    .filter(a -> Derived.isTaskOverdue(a.task().getStatus(), a.task().getDueDate(), today)).count();
            BigDecimal estimated = mine.stream()
                    .filter(a -> !finished(a.task().getStatus()))
                    .map(a -> a.task().getEstimatedHours() != null ? a.task().getEstimatedHours() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            counts.add(new long[] {mine.size(), active, overdue});
            hours.add(estimated);
            loads.add(new WorkloadClassifier.Load(active + overdue, estimated));
        }
        List<String> levels = WorkloadClassifier.classify(loads);
        WorkloadClassifier.Averages averages = WorkloadClassifier.averages(loads);

        List<TeamViewsResponse.MemberWorkload> members = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            User person = ordered.get(i);
            members.add(new TeamViewsResponse.MemberWorkload(new UserResponse(person), counts.get(i)[0], counts.get(i)[1],
                    counts.get(i)[2], hours.get(i), actualHours.getOrDefault(person.getId(), BigDecimal.ZERO), levels.get(i)));
        }
        return new TeamViewsResponse.Workload(projectId, projectName, members.size(), averages.openTasks(),
                averages.estimatedHours(), members);
    }

    // The projects where the caller may assign tasks: all of them for an administrator.
    private List<Long> managedProjectIds(User caller) {
        if (projectAccessGuard.isAdmin(caller)) {
            return projectRepository.findAll().stream().map(Project::getId).toList();
        }
        return projectMemberRepository.findProjectIdsByUserId(caller.getId()).stream()
                .filter(id -> projectAccessGuard.can(caller, id, Resource.TASK, Action.ASSIGN))
                .toList();
    }

    // ---------------------------------------------------------------- shared

    private void assertManages(User caller, Long projectId, String what) {
        projectAccessGuard.assertAccess(caller, projectId);
        if (!projectAccessGuard.can(caller, projectId, Resource.TASK, Action.ASSIGN)) {
            throw new AccessDeniedException("Only the Owner, a Team Leader or an Administrator can " + what);
        }
    }

    // One assignment of a non-cancelled task to a person.
    private record Assignment(Task task, Long assignmentId) {
    }

    // The people and the (non-cancelled) work of one or more projects.
    private static final class Team {
        final List<ProjectMember> members;
        final List<Task> tasks;
        // task id -> its assignments
        final Map<Long, List<TaskAssignee>> assigned;
        final Map<Long, Task> taskById = new HashMap<>();

        Team(List<ProjectMember> members, List<Task> tasks, Map<Long, List<TaskAssignee>> assigned) {
            this.members = members;
            this.tasks = tasks;
            this.assigned = assigned;
            for (Task t : tasks) {
                taskById.put(t.getId(), t);
            }
        }

        List<Assignment> assignmentsOf(Long userId) {
            List<Assignment> result = new ArrayList<>();
            for (var entry : assigned.entrySet()) {
                Task task = taskById.get(entry.getKey());
                if (task == null) {
                    continue;
                }
                for (TaskAssignee ta : entry.getValue()) {
                    if (ta.getUser().getId().equals(userId)) {
                        result.add(new Assignment(task, ta.getId()));
                    }
                }
            }
            return result;
        }
    }

    // Active members who can be given work (not Viewers, not deactivated accounts),
    // in name order, and the non-cancelled tasks of the projects with their assignees.
    private Team loadTeam(List<Long> projectIds) {
        List<ProjectMember> members = projectMemberRepository.findByProjectIdIn(projectIds).stream()
                .filter(pm -> "ACTIVE".equals(pm.getStatus()))
                .filter(pm -> !"VIEWER".equals(pm.getProjectRole()))
                .filter(pm -> "ACTIVE".equals(pm.getUser().getAccountStatus()))
                .sorted(Comparator.comparing((ProjectMember pm) -> pm.getUser().getFullName()))
                .toList();
        List<Task> tasks = taskRepository.findByProjectIdIn(projectIds).stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .toList();
        Map<Long, List<TaskAssignee>> assigned = new HashMap<>();
        for (TaskAssignee ta : taskAssigneeRepository.findByTask_ProjectIdIn(projectIds)) {
            if (!"CANCELLED".equals(ta.getTask().getStatus())) {
                assigned.computeIfAbsent(ta.getTask().getId(), k -> new ArrayList<>()).add(ta);
            }
        }
        return new Team(members, tasks, assigned);
    }

    private Project requireProject(Long id) {
        return projectRepository.findById(id).orElseThrow(() -> new NotFoundException("Project not found"));
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
