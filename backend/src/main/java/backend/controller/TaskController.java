package backend.controller;

import backend.dto.TaskRequest;
import backend.dto.TaskResponse;
import backend.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    // Mirrors the @Pattern on TaskRequest.status — kept in sync with it.
    private static final Set<String> VALID_STATUSES =
            Set.of("TO_DO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED");

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> getAllTasks(Authentication authentication) {
        return taskService.getAllTasks(authentication.getName());
    }

    @GetMapping("/{id}")
    public TaskResponse getTaskById(@PathVariable Long id, Authentication authentication) {
        return taskService.getTaskById(id, authentication.getName());
    }

    @GetMapping("/project/{projectId}")
    public List<TaskResponse> getTasksByProjectId(@PathVariable Long projectId, Authentication authentication) {
        return taskService.getTasksByProjectId(projectId, authentication.getName());
    }

    @GetMapping("/milestone/{milestoneId}")
    public List<TaskResponse> getTasksByMilestoneId(@PathVariable Long milestoneId, Authentication authentication) {
        return taskService.getTasksByMilestoneId(milestoneId, authentication.getName());
    }

    @GetMapping("/status/{status}")
    public List<TaskResponse> getTasksByStatus(@PathVariable String status, Authentication authentication) {
        if (!VALID_STATUSES.contains(status)) {
            throw new IllegalArgumentException("Invalid status: " + status);
        }
        return taskService.getTasksByStatus(status, authentication.getName());
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public TaskResponse createTask(@Valid @RequestBody TaskRequest request) {
        return taskService.createTask(request);
    }

    // Open to any authenticated role (not just PM/TL), since a TEAM_MEMBER
    // must be able to update the status/progress of their own tasks.
    // ADMINISTRATOR/PROJECT_MANAGER/TEAM_LEADER may still edit every field on
    // any task; a TEAM_MEMBER may only act on a task they're assigned to, and
    // only its status/progress take effect — see TaskService.updateTask and
    // the README's Security section.
    @PutMapping("/{id}")
    public TaskResponse updateTask(
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest request,
            Authentication authentication
    ) {
        return taskService.updateTask(id, request, authentication.getName());
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
    }
}
