package backend.dto;

import java.time.LocalDate;

// One day of the dashboard's activity chart (GET /api/dashboard/task-activity): how many tasks were
// created and completed on that day, and how many tasks that are still open were due before it.
public class TaskActivityResponse {

    private final LocalDate date;
    private final long created;
    private final long completed;
    private final long overdue;

    public TaskActivityResponse(LocalDate date, long created, long completed, long overdue) {
        this.date = date;
        this.created = created;
        this.completed = completed;
        this.overdue = overdue;
    }

    public LocalDate getDate() {
        return date;
    }

    public long getCreated() {
        return created;
    }

    public long getCompleted() {
        return completed;
    }

    public long getOverdue() {
        return overdue;
    }
}
