package backend.controller;

import backend.dto.DashboardStatsResponse;
import backend.dto.TaskActivityResponse;
import backend.service.DashboardService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Statistics for the dashboard, limited to the projects and tasks the caller may
// already see - no role gate beyond being signed in.
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/stats")
    public DashboardStatsResponse getStats(Authentication authentication) {
        return dashboardService.getStats(authentication.getName());
    }

    // The activity chart: per day over the last `days` days (1 to 366, default 7), oldest first, how many
    // tasks were created and completed and how many open ones were due before that day. `zone` is the
    // caller's IANA time zone; `projectId` limits it to one project (404 if the caller is not in it).
    @GetMapping("/task-activity")
    public List<TaskActivityResponse> getTaskActivity(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(required = false) String zone,
            @RequestParam(required = false) Long projectId,
            Authentication authentication) {
        return dashboardService.getTaskActivity(authentication.getName(), days, zone, projectId);
    }
}
