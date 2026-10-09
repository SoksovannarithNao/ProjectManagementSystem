package backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// The five KPIs and the seven named reports (assignment-brief.md B8). Every figure
// is calculated on the server from the projects and tasks the caller may report
// on, so every client shows the same numbers. Percentages are 0-100 with one
// decimal, and null when the denominator is empty (a rate of nothing is not 0%).
public final class ReportsResponse {

    private ReportsResponse() {
    }

    // What the report covers and when it was made.
    public record Scope(Long projectId, String projectName, int projects, LocalDate from, LocalDate to,
                        OffsetDateTime generatedAt) {
    }

    // ---- shared rows ---------------------------------------------------------

    public record TaskCounts(long total, long todo, long inProgress, long inReview, long completed, long cancelled,
                             long overdue) {
    }

    // One task, as the Task, Overdue and Completion reports list it.
    public record TaskRow(Long id, String title, Long projectId, String projectName, List<String> assignees,
                          String priority, String status, BigDecimal progress, LocalDate startDate, LocalDate dueDate,
                          BigDecimal estimatedHours, OffsetDateTime completedAt, long daysOverdue) {
    }

    public record ProjectRow(Long id, String projectCode, String name, String status, String priority,
                             UserResponse owner, LocalDate startDate, LocalDate endDate, BigDecimal progress,
                             boolean delayed, long daysDelayed) {
    }

    // ---- KPIs ----------------------------------------------------------------

    // projectCompletionRate = completed projects / (projects - cancelled)
    // taskCompletionRate    = completed tasks / (tasks - cancelled)
    // overdueRate           = overdue tasks / (tasks - completed - cancelled)
    // averageTaskCompletionDays = mean of (completion date - start date) over completed tasks
    // onTimeCompletionRate  = tasks completed on or before the due date / completed tasks
    public record Kpis(Scope scope, BigDecimal projectCompletionRate, BigDecimal taskCompletionRate,
                       BigDecimal overdueRate, BigDecimal averageTaskCompletionDays, BigDecimal onTimeCompletionRate,
                       Basis basis) {
    }

    // The counts the rates were calculated from.
    public record Basis(long projects, long completedProjects, long cancelledProjects, long tasks, long completedTasks,
                        long cancelledTasks, long overdueTasks, long completedOnTime) {
    }

    // ---- 1. Project Report ----------------------------------------------------

    public record ProjectReport(Scope scope, ProjectRow project, String description, List<TeamMember> team,
                                List<MilestoneRow> milestones, TaskCounts taskCounts, List<TaskRow> upcomingDeadlines) {
    }

    public record TeamMember(UserResponse user, String projectRole) {
    }

    public record MilestoneRow(Long id, String title, LocalDate dueDate, String status, BigDecimal progress) {
    }

    // ---- 2. Task Report ------------------------------------------------------------

    public record TaskReport(Scope scope, List<TaskRow> rows) {
    }

    // ---- 3. Project Status Report -----------------------------------------------------

    // key: PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED or DELAYED (derived: it overlaps the others).
    public record StatusGroup(String key, String label, long count, List<ProjectRow> projects) {
    }

    public record ProjectStatusReport(Scope scope, List<StatusGroup> groups) {
    }

    // ---- 4. Task Completion Report -------------------------------------------------------

    // total = non-cancelled tasks due in the range; completed = how many of them are Completed.
    public record CompletionGroup(String key, String label, long total, long completed, BigDecimal percentage) {
    }

    public record TaskCompletionReport(Scope scope, String groupBy, CompletionGroup overall,
                                       List<CompletionGroup> groups, List<TaskRow> completedTasks) {
    }

    // ---- 5. Overdue Task Report --------------------------------------------------------------

    public record OverdueReport(Scope scope, List<TaskRow> rows) {
    }

    // ---- 6. Team Performance Report ------------------------------------------------------------

    // Counts are over the member's non-cancelled tasks. todo is the B1.3 "pending"; in progress and in
    // review are shown apart so assigned = completed + todo + inProgress + inReview.
    public record MemberPerformance(UserResponse user, long assigned, long completed, long todo, long inProgress,
                                    long inReview, long overdue, BigDecimal completionRate) {
    }

    public record TeamPerformanceReport(Scope scope, List<MemberPerformance> members) {
    }

    // ---- 7. Workload Report -------------------------------------------------------------------------

    public record WorkloadReport(Scope scope, TeamViewsResponse.Workload workload) {
    }
}
