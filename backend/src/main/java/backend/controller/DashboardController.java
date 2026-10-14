package backend.controller;

import backend.dto.DashboardStatsResponse;
import backend.service.DashboardService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
}
