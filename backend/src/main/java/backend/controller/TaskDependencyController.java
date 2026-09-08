package backend.controller;

import backend.entity.TaskDependency;
import backend.entity.TaskDependency.TaskDependencyId;
import backend.service.TaskDependencyService;
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
    public List<TaskDependency> getAllTaskDependencies() {
        return taskDependencyService.getAllTaskDependencies();
    }

    @GetMapping("/task/{taskId}")
    public List<TaskDependency> getDependenciesByTaskId(@PathVariable Long taskId) {
        return taskDependencyService.getDependenciesByTaskId(taskId);
    }

    @GetMapping("/depends-on/{taskId}")
    public List<TaskDependency> getDependentTasks(@PathVariable Long taskId) {
        return taskDependencyService.getDependentTasks(taskId);
    }

    @PostMapping
    public TaskDependency createTaskDependency(
            @RequestBody TaskDependency dependency
    ) {
        return taskDependencyService.createTaskDependency(dependency);
    }

    @DeleteMapping
    public void deleteTaskDependency(
            @RequestParam Long taskId,
            @RequestParam Long dependsOnTaskId
    ) {
        TaskDependencyId id =
                new TaskDependencyId(taskId, dependsOnTaskId);

        taskDependencyService.deleteTaskDependency(id);
    }
}