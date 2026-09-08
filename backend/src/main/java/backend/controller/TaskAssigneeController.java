package backend.controller;

import backend.entity.TaskAssignee;
import backend.service.TaskAssigneeService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task-assignees")
public class TaskAssigneeController {

    private final TaskAssigneeService taskAssigneeService;

    public TaskAssigneeController(TaskAssigneeService taskAssigneeService) {
        this.taskAssigneeService = taskAssigneeService;
    }

    @GetMapping
    public List<TaskAssignee> getAllTaskAssignees() {
        return taskAssigneeService.getAllTaskAssignees();
    }

    @GetMapping("/{id}")
    public TaskAssignee getTaskAssigneeById(@PathVariable Long id) {
        return taskAssigneeService.getTaskAssigneeById(id);
    }

    @GetMapping("/task/{taskId}")
    public List<TaskAssignee> getAssigneesByTaskId(@PathVariable Long taskId) {
        return taskAssigneeService.getAssigneesByTaskId(taskId);
    }

    @GetMapping("/user/{userId}")
    public List<TaskAssignee> getTasksByUserId(@PathVariable Long userId) {
        return taskAssigneeService.getTasksByUserId(userId);
    }

    @PostMapping
    public TaskAssignee createTaskAssignee(@RequestBody TaskAssignee taskAssignee) {
        return taskAssigneeService.createTaskAssignee(taskAssignee);
    }

    @DeleteMapping("/{id}")
    public void deleteTaskAssignee(@PathVariable Long id) {
        taskAssigneeService.deleteTaskAssignee(id);
    }
}