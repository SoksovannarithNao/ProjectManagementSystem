package backend.controller;

import backend.dto.ActivityLogResponse;
import backend.service.ActivityLogService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// No @PreAuthorize role gate - ActivityLogService scopes reads to "is the
// caller a member of the task's / project's project", same pattern as
// comments/subtasks.
@RestController
@RequestMapping("/api/activity-logs")
public class ActivityLogController {

    private final ActivityLogService activityLogService;

    public ActivityLogController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @GetMapping("/task/{taskId}")
    public List<ActivityLogResponse> getActivityByTaskId(@PathVariable Long taskId, Authentication authentication) {
        return activityLogService.getActivityByTaskId(taskId, authentication.getName());
    }

    // The latest events across everything the caller may see (dashboard).
    // `limit` defaults to 10 and is capped at 50.
    @GetMapping("/recent")
    public List<ActivityLogResponse> getRecentActivity(
            @RequestParam(defaultValue = "10") int limit, Authentication authentication) {
        return activityLogService.getRecentActivity(limit, authentication.getName());
    }

    // The project's activity feed, newest first: project and milestone events,
    // task events (created, assigned, status changed, approvals, deleted),
    // comments and uploaded files. `limit` defaults to 50 and is capped at 200.
    @GetMapping("/project/{projectId}")
    public List<ActivityLogResponse> getActivityByProjectId(
            @PathVariable Long projectId,
            @RequestParam(defaultValue = "50") int limit,
            Authentication authentication) {
        return activityLogService.getActivityByProjectId(projectId, limit, authentication.getName());
    }
}
