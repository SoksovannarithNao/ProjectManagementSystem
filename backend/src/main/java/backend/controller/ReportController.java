package backend.controller;

import backend.dto.ReportsResponse;
import backend.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

// The five KPIs and the seven named reports (assignment-brief.md B8). The permission
// REPORT:GENERATE_REPORTS - and which projects it covers - is checked in ReportService
// on every request; the Reports page being hidden from other people is only a courtesy.
// Dates are ISO (yyyy-MM-dd). Every endpoint answers JSON; export is optional and not built.
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/kpis")
    public ReportsResponse.Kpis kpis(@RequestParam(required = false) Long projectId, Authentication authentication) {
        return reportService.getKpis(authentication.getName(), projectId);
    }

    // 1. Project Report - one project (projectId is required).
    @GetMapping("/project")
    public ReportsResponse.ProjectReport project(@RequestParam(required = false) Long projectId,
                                                 Authentication authentication) {
        return reportService.getProjectReport(authentication.getName(), projectId);
    }

    // 2. Task Report - filters: project, assignee, status, priority, due-date range.
    @GetMapping("/tasks")
    public ReportsResponse.TaskReport tasks(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueTo,
            Authentication authentication) {
        return reportService.getTaskReport(authentication.getName(), projectId, assigneeId, status, priority, dueFrom, dueTo);
    }

    // 3. Project Status Report - filters: status (or DELAYED), owner, date range.
    @GetMapping("/project-status")
    public ReportsResponse.ProjectStatusReport projectStatus(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long ownerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication authentication) {
        return reportService.getProjectStatusReport(authentication.getName(), status, ownerId, from, to);
    }

    // 4. Task Completion Report - grouped by project, member or month; the date range is required.
    @GetMapping("/task-completion")
    public ReportsResponse.TaskCompletionReport taskCompletion(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String groupBy,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication authentication) {
        return reportService.getTaskCompletionReport(authentication.getName(), projectId, groupBy, from, to);
    }

    // 5. Overdue Task Report - filters: project, assignee, priority.
    @GetMapping("/overdue")
    public ReportsResponse.OverdueReport overdue(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) String priority,
            Authentication authentication) {
        return reportService.getOverdueReport(authentication.getName(), projectId, assigneeId, priority);
    }

    // 6. Team Performance Report - filters: project, date range.
    @GetMapping("/team-performance")
    public ReportsResponse.TeamPerformanceReport teamPerformance(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication authentication) {
        return reportService.getTeamPerformanceReport(authentication.getName(), projectId, from, to);
    }

    // 7. Workload Report - filter: project.
    @GetMapping("/workload")
    public ReportsResponse.WorkloadReport workload(@RequestParam(required = false) Long projectId,
                                                   Authentication authentication) {
        return reportService.getWorkloadReport(authentication.getName(), projectId);
    }
}
