package backend.controller;

import backend.dto.AuditLogPageResponse;
import backend.dto.AuditLogResponse;
import backend.service.AuditLogService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

// The administrator audit log (read-only: entries are written by the services that do the
// audited actions, and nothing can change or delete them). Access is checked in
// AuditLogService: the whole log is for an Administrator; the Owner of a project can read
// that project's ownership transfers (D-11).
@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogController {

    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    // Newest first. Filters: action, targetType, free text (actor, target, before, after),
    // an inclusive date range. page starts at 0; size defaults to 25 and is capped at 100.
    @GetMapping
    public AuditLogPageResponse search(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            Authentication authentication) {
        return auditLogService.search(authentication.getName(), action, targetType, q, from, to, page, size);
    }

    @GetMapping("/project/{projectId}")
    public List<AuditLogResponse> forProject(@PathVariable Long projectId, Authentication authentication) {
        return auditLogService.forProject(projectId, authentication.getName());
    }
}
