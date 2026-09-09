package backend.controller;

import backend.dto.TaskDependencyRequest;
import backend.dto.TaskDependencyResponse;
import backend.entity.TaskDependency.TaskDependencyId;
import backend.service.TaskDependencyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task-dependencies")
public class TaskDependencyController {

    private final TaskDependencyService taskDependencyService;

    public TaskDependencyController(TaskDependencyService taskDependencyService) {
        this.taskDependencyService = taskDependencyService;
    }

    @GetMapping
    public List<TaskDependencyResponse> getAllTaskDependencies() {
        return taskDependencyService.getAllTaskDependencies();
    }

    @GetMapping("/task/{taskId}")
    public List<TaskDependencyResponse> getDependenciesByTaskId(@PathVariable Long taskId) {
        return taskDependencyService.getDependenciesByTaskId(taskId);
    }

    @GetMapping("/depends-on/{taskId}")
    public List<TaskDependencyResponse> getDependentTasks(@PathVariable Long taskId) {
        return taskDependencyService.getDependentTasks(taskId);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public TaskDependencyResponse createTaskDependency(
            @Valid @RequestBody TaskDependencyRequest request
    ) {
        return taskDependencyService.createTaskDependency(request);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping
    public void deleteTaskDependency(
            @RequestParam Long taskId,
            @RequestParam Long dependsOnTaskId
    ) {
        TaskDependencyId id = new TaskDependencyId(taskId, dependsOnTaskId);
        taskDependencyService.deleteTaskDependency(id);
    }
}
