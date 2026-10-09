package backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// The manager views of a team: who is working on what (Team Tasks) and how
// much each member carries (Workload). Both are calculated on the server from
// the tasks, assignments and work logs of the projects the caller manages.
public final class TeamViewsResponse {

    private TeamViewsResponse() {
    }

    // ---- Team Tasks -----------------------------------------------------------

    public record TeamTasks(Long projectId, String projectName, List<MemberTasks> members, List<TeamTask> unassigned) {
    }

    // One member of the project and the tasks assigned to them. Counts leave out
    // cancelled tasks; averageProgress is the mean progress of those tasks.
    public record MemberTasks(UserResponse user, String projectRole, long assigned, long completed, long active,
                              long overdue, BigDecimal averageProgress, List<TeamTask> tasks) {
    }

    // assignmentId is the task_assignees row that links this task to the member,
    // so a manager can reassign it (unassign, then assign someone else).
    public record TeamTask(Long id, String title, String status, String priority, LocalDate startDate,
                           LocalDate dueDate, BigDecimal progress, boolean overdue, BigDecimal estimatedHours,
                           Long assignmentId) {
    }

    // ---- Workload ------------------------------------------------------------------

    // projectId is null when the figures span every project the caller manages.
    // The averages are over the members listed; level is relative to them (D-13).
    public record Workload(Long projectId, String projectName, int teamSize, BigDecimal averageOpenTasks,
                           BigDecimal averageEstimatedHours, List<MemberWorkload> members) {
    }

    // assigned = non-cancelled tasks; active = in progress; overdue = past due and
    // not finished; estimatedHours = of the tasks not yet completed or cancelled;
    // actualHours = hours this person logged on the team's tasks.
    // level: OVERLOADED, UNDERLOADED or BALANCED (BALANCED too when there is no one to compare with).
    public record MemberWorkload(UserResponse user, long assigned, long active, long overdue,
                                 BigDecimal estimatedHours, BigDecimal actualHours, String level) {
    }
}
