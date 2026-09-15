package backend.controller;

import backend.dto.ActivityLogResponse;
import backend.service.ActivityLogService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// No @PreAuthorize role gate — ActivityLogService scopes reads to "is the
// caller a member of the task's project", same pattern as comments/subtasks.
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
}
