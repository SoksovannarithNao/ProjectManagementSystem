package backend.controller;

import backend.dto.WorkLogRequest;
import backend.dto.WorkLogResponse;
import backend.service.WorkLogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// No @PreAuthorize role gates — WorkLogService enforces project access for
// reads, content-edit rights for logging, and author-or-manager for deletes.
@RestController
@RequestMapping("/api/work-logs")
public class WorkLogController {

    private final WorkLogService workLogService;

    public WorkLogController(WorkLogService workLogService) {
        this.workLogService = workLogService;
    }

    @GetMapping("/task/{taskId}")
    public List<WorkLogResponse> getWorkLogsByTaskId(@PathVariable Long taskId, Authentication authentication) {
        return workLogService.getWorkLogsByTaskId(taskId, authentication.getName());
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public WorkLogResponse createWorkLog(@Valid @RequestBody WorkLogRequest request, Authentication authentication) {
        return workLogService.createWorkLog(request, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteWorkLog(@PathVariable Long id, Authentication authentication) {
        workLogService.deleteWorkLog(id, authentication.getName());
    }
}
