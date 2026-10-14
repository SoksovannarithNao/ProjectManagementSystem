package backend.controller;

import backend.dto.TaskRequest;
import backend.dto.TaskResponse;
import backend.service.TaskService;
import backend.util.PageParams;
import backend.util.TaskListQuery;
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
            Set.of("TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "CANCELLED");

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    // Every parameter is optional (B1.9, B7.2); filters combine with AND, several values of
    // status or priority with OR. They only narrow what the caller may already see.
    // With ?page and/or ?size the answer is a page ({ items, total, page, size }) instead of the
    // whole list; without them it is the whole list, as before.
    @GetMapping
    public Object getAllTasks(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) List<String> priority,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String due,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            Authentication authentication
    ) {
        TaskListQuery query = new TaskListQuery(search, status, priority, assigneeId, projectId, due, sort);
        PageParams paging = PageParams.of(page, size);
        return paging == null
                ? taskService.getAllTasks(authentication.getName(), query)
                : taskService.getTasksPage(authentication.getName(), query, paging);
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
    // TaskService.updateTask and docs/backend.md's Security section.
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
