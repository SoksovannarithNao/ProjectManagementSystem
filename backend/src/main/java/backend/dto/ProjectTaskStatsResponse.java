package backend.dto;

// How much work one project holds, for the project cards (GET /api/tasks/project-stats): cancelled
// tasks are not counted, `overdue` is the shared rule (past due and still open).
public class ProjectTaskStatsResponse {

    private final Long projectId;
    private final long total;
    private final long completed;
    private final long overdue;

    public ProjectTaskStatsResponse(Long projectId, long total, long completed, long overdue) {
        this.projectId = projectId;
        this.total = total;
        this.completed = completed;
        this.overdue = overdue;
    }

    public Long getProjectId() {
        return projectId;
    }

    public long getTotal() {
        return total;
    }

    public long getCompleted() {
        return completed;
    }

    public long getOverdue() {
        return overdue;
    }
}
