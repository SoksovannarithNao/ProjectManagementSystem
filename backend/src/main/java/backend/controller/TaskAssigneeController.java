package backend.controller;

import backend.dto.TaskAssigneeRequest;
import backend.dto.TaskAssigneeResponse;
import backend.service.TaskAssigneeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public TaskAssigneeResponse createTaskAssignee(@Valid @RequestBody TaskAssigneeRequest request) {
        return taskAssigneeService.createTaskAssignee(request);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteTaskAssignee(@PathVariable Long id) {
        taskAssigneeService.deleteTaskAssignee(id);
    }
}
