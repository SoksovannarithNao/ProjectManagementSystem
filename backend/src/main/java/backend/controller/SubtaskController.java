package backend.controller;

import backend.dto.SubtaskRequest;
import backend.dto.SubtaskResponse;
import backend.service.SubtaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// No @PreAuthorize role gates here — every action is scoped to "is the
// caller a member of the parent task's project" inside SubtaskService
// (ProjectAccessGuard), same pattern as the notification endpoints being
// scoped by caller identity rather than role.
@RestController
@RequestMapping("/api/subtasks")
public class SubtaskController {

    private final SubtaskService subtaskService;

    public SubtaskController(SubtaskService subtaskService) {
        this.subtaskService = subtaskService;
    }

    @GetMapping("/task/{taskId}")
    public List<SubtaskResponse> getSubtasksByTaskId(@PathVariable Long taskId, Authentication authentication) {
        return subtaskService.getSubtasksByTaskId(taskId, authentication.getName());
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public SubtaskResponse createSubtask(@Valid @RequestBody SubtaskRequest request, Authentication authentication) {
        return subtaskService.createSubtask(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public SubtaskResponse updateSubtask(
            @PathVariable Long id,
            @Valid @RequestBody SubtaskRequest request,
            Authentication authentication
    ) {
        return subtaskService.updateSubtask(id, request, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteSubtask(@PathVariable Long id, Authentication authentication) {
        subtaskService.deleteSubtask(id, authentication.getName());
    }
}
