package backend.controller;

import backend.dto.ChecklistItemRequest;
import backend.dto.ChecklistItemResponse;
import backend.service.ChecklistItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// No @PreAuthorize role gate - every action is scoped to the parent task's
// project inside ChecklistItemService (ProjectAccessGuard), like subtasks.
@RestController
@RequestMapping("/api/checklist-items")
public class ChecklistItemController {

    private final ChecklistItemService checklistItemService;

    public ChecklistItemController(ChecklistItemService checklistItemService) {
        this.checklistItemService = checklistItemService;
    }

    @GetMapping("/task/{taskId}")
    public List<ChecklistItemResponse> getByTask(@PathVariable Long taskId, Authentication authentication) {
        return checklistItemService.getByTask(taskId, authentication.getName());
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public ChecklistItemResponse create(@Valid @RequestBody ChecklistItemRequest request, Authentication authentication) {
        return checklistItemService.create(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public ChecklistItemResponse update(
            @PathVariable Long id,
            @Valid @RequestBody ChecklistItemRequest request,
            Authentication authentication) {
        return checklistItemService.update(id, request, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        checklistItemService.delete(id, authentication.getName());
    }
}
