package backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// The numbers on the dashboard (assignment-brief.md B1.3, D-06), calculated on
// the server from the projects and tasks the caller may see, so every client
// shows the same figures. "Delayed" and "overdue" are derived, never stored.
public class DashboardStatsResponse {

    private final ProjectStats projects;
    private final TaskStats tasks;
    private final List<DelayedProject> delayedProjects;

    public DashboardStatsResponse(ProjectStats projects, TaskStats tasks, List<DelayedProject> delayedProjects) {
        this.projects = projects;
        this.tasks = tasks;
        this.delayedProjects = delayedProjects;
    }

    public ProjectStats getProjects() {
        return projects;
    }

    public TaskStats getTasks() {
        return tasks;
    }

    public List<DelayedProject> getDelayedProjects() {
        return delayedProjects;
    }

    // total = every project; active = IN_PROGRESS only (a PLANNING project is not
    // active, D-06); delayed overlaps the status counts (it is a derived group);
    // averageProgress = mean progress of the projects that are not cancelled.
    public record ProjectStats(long total, long planning, long active, long onHold, long completed, long cancelled,
                               long delayed, BigDecimal averageProgress) {
    }

    // total = every task (cancelled shown separately); overdue overlaps the
    // status counts (a task is overdue while it is still open).
    public record TaskStats(long total, long todo, long inProgress, long inReview, long completed, long cancelled,
                            long overdue) {
    }

    public record DelayedProject(Long id, String projectCode, String name, LocalDate endDate, long daysDelayed,
                                 BigDecimal progress, String status) {
    }
}
