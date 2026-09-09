package backend.controller;

import backend.dto.TaskRequest;
import backend.dto.TaskResponse;
import backend.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> getAllTasks() {
        return taskService.getAllTasks();
    }

    @GetMapping("/{id}")
    public TaskResponse getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id);
    }

    @GetMapping("/project/{projectId}")
    public List<TaskResponse> getTasksByProjectId(@PathVariable Long projectId) {
        return taskService.getTasksByProjectId(projectId);
    }

    @GetMapping("/milestone/{milestoneId}")
    public List<TaskResponse> getTasksByMilestoneId(@PathVariable Long milestoneId) {
        return taskService.getTasksByMilestoneId(milestoneId);
    }

    @GetMapping("/status/{status}")
    public List<TaskResponse> getTasksByStatus(@PathVariable String status) {
        return taskService.getTasksByStatus(status);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public TaskResponse createTask(@Valid @RequestBody TaskRequest request) {
        return taskService.createTask(request);
    }

    // Open to any authenticated role (not just PM/TL), since a TEAM_MEMBER
    // must be able to update the status/progress of their own tasks. There's
    // no per-row ownership check yet, so this is coarser than ideal — see
    // the README's Security section.
    @PutMapping("/{id}")
    public TaskResponse updateTask(
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest request
    ) {
        return taskService.updateTask(id, request);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
    }
}
