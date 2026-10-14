package backend.dto;

import java.util.List;
import java.util.Map;

// What the task and report screens show beside (or instead of) a list of tasks: how many tasks each
// quick view holds, the people who hold an assignment on a task the caller may see, and how many of the
// matching tasks each person has completed (GET /api/tasks/summary).
public class TaskSummaryResponse {

    private final Map<String, Long> viewCounts;
    private final List<UserResponse> assignees;
    private final Map<Long, Long> completedByAssignee;

    public TaskSummaryResponse(Map<String, Long> viewCounts, List<UserResponse> assignees, Map<Long, Long> completedByAssignee) {
        this.viewCounts = viewCounts;
        this.assignees = assignees;
        this.completedByAssignee = completedByAssignee;
    }

    // user id -> completed tasks among those the search and filters leave (a person is counted once
    // per task they hold); people with none are absent.
    public Map<Long, Long> getCompletedByAssignee() {
        return completedByAssignee;
    }

    public Map<String, Long> getViewCounts() {
        return viewCounts;
    }

    public List<UserResponse> getAssignees() {
        return assignees;
    }
}
