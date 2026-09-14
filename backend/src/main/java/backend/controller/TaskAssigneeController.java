package backend.controller;

import backend.dto.TaskAssigneeRequest;
import backend.dto.TaskAssigneeResponse;
import backend.service.TaskAssigneeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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
    public List<TaskAssigneeResponse> getAllTaskAssignees(Authentication authentication) {
        return taskAssigneeService.getAllTaskAssignees(authentication.getName());
    }

    @GetMapping("/{id}")
    public TaskAssigneeResponse getTaskAssigneeById(@PathVariable Long id, Authentication authentication) {
        return taskAssigneeService.getTaskAssigneeById(id, authentication.getName());
    }

    @GetMapping("/task/{taskId}")
    public List<TaskAssigneeResponse> getAssigneesByTaskId(@PathVariable Long taskId, Authentication authentication) {
        return taskAssigneeService.getAssigneesByTaskId(taskId, authentication.getName());
    }

    @GetMapping("/user/{userId}")
    public List<TaskAssigneeResponse> getTasksByUserId(@PathVariable Long userId, Authentication authentication) {
        return taskAssigneeService.getTasksByUserId(userId, authentication.getName());
    }

    // Requires OWNER/ADMIN of the task's project — enforced in
    // TaskAssigneeService.
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public TaskAssigneeResponse createTaskAssignee(@Valid @RequestBody TaskAssigneeRequest request, Authentication authentication) {
        return taskAssigneeService.createTaskAssignee(request, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteTaskAssignee(@PathVariable Long id, Authentication authentication) {
        taskAssigneeService.deleteTaskAssignee(id, authentication.getName());
    }
}
