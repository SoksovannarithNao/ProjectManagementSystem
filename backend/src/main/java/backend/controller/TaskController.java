package backend.controller;

import backend.dto.TaskRequest;
import backend.dto.TaskResponse;
import backend.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

    // Requires content-edit rights (OWNER/ADMIN/MEMBER, not VIEWER) on the
    // target project — enforced in TaskService.createTask.
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public TaskResponse createTask(@Valid @RequestBody TaskRequest request, Authentication authentication) {
        return taskService.createTask(request, authentication.getName());
    }

    // Open to any authenticated user, since a project MEMBER must be able
    // to update the status/progress of their own assigned tasks. A project
    // OWNER/ADMIN (or system ADMINISTRATOR) may still edit every field on
    // any task in that project; anyone else may only act on a task they're
    // assigned to, and only its status/progress take effect — see
    // TaskService.updateTask and the README's Security section.
    @PutMapping("/{id}")
    public TaskResponse updateTask(
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest request,
            Authentication authentication
    ) {
        return taskService.updateTask(id, request, authentication.getName());
    }

    // Requires OWNER/ADMIN of the task's project — enforced in
    // TaskService.deleteTask.
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteTask(@PathVariable Long id, Authentication authentication) {
        taskService.deleteTask(id, authentication.getName());
    }
}
