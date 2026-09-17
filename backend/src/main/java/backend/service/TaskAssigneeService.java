package backend.service;

import backend.dto.TaskAssigneeRequest;
import backend.dto.TaskAssigneeResponse;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TaskAssigneeService {

    private final TaskAssigneeRepository taskAssigneeRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;
    private final ProjectAccessGuard projectAccessGuard;

    public TaskAssigneeService(
            TaskAssigneeRepository taskAssigneeRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectMemberRepository projectMemberRepository,
            NotificationService notificationService,
            ActivityLogService activityLogService,
            ProjectAccessGuard projectAccessGuard) {
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
        this.projectAccessGuard = projectAccessGuard;
    }

    // Scoped the same way as TaskService.getAllTasks — otherwise this
    // endpoint would leak the existence of tasks/projects/users a caller
    // can't see via GET /api/tasks, defeating that scoping.
    @Transactional(readOnly = true)
    public List<TaskAssigneeResponse> getAllTaskAssignees(String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        List<TaskAssignee> assignees;
        if (projectAccessGuard.isAdmin(caller)) {
            assignees = taskAssigneeRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            assignees = taskAssigneeRepository.findByTask_ProjectIdIn(visibleProjectIds);
        }

        return assignees.stream().map(TaskAssigneeResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public TaskAssigneeResponse getTaskAssigneeById(Long id, String username) {
        TaskAssignee taskAssignee = getTaskAssigneeEntityById(id);
        projectAccessGuard.assertAccess(requireUser(username), taskAssignee.getTask().getProject().getId());
        return new TaskAssigneeResponse(taskAssignee);
    }

    @Transactional(readOnly = true)
    public TaskAssignee getTaskAssigneeEntityById(Long id) {
        return taskAssigneeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task assignee not found"));
    }

    @Transactional(readOnly = true)
    public List<TaskAssigneeResponse> getAssigneesByTaskId(Long taskId, String username) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found"));
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return taskAssigneeRepository.findByTaskId(taskId)
                .stream()
                .map(TaskAssigneeResponse::new)
                .toList();
    }

    // Each row nests the full parent TaskResponse (title, description, ...),
    // so this must stay within the caller's visible projects the same way
    // getAllTaskAssignees does — otherwise querying an arbitrary userId would
    // leak the content of tasks in projects the caller isn't a member of.
    @Transactional(readOnly = true)
    public List<TaskAssigneeResponse> getTasksByUserId(Long userId, String username) {
        User caller = requireUser(username);
        List<TaskAssignee> assignees = taskAssigneeRepository.findByUserId(userId);
        if (!projectAccessGuard.isAdmin(caller)) {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            assignees = assignees.stream()
                    .filter(a -> visibleProjectIds.contains(a.getTask().getProject().getId()))
                    .toList();
        }
        return assignees.stream().map(TaskAssigneeResponse::new).toList();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    // Requires OWNER/ADMIN (or system ADMINISTRATOR) of the task's project.
    public TaskAssigneeResponse createTaskAssignee(TaskAssigneeRequest request, String username) {
        Task task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> new NotFoundException("Task not found"));
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new NotFoundException("User not found"));
        projectAccessGuard.assertCanManage(requireUser(username), task.getProject().getId());

        TaskAssignee taskAssignee = new TaskAssignee();
        taskAssignee.setTask(task);
        taskAssignee.setUser(user);

        TaskAssignee saved = taskAssigneeRepository.save(taskAssignee);
        notificationService.notifyTaskAssigned(task, user);
        activityLogService.record(requireUser(username), task, "TASK_ASSIGNED", user.getFullName() + " was assigned");
        return new TaskAssigneeResponse(saved);
    }

    public void deleteTaskAssignee(Long id, String username) {
        TaskAssignee taskAssignee = getTaskAssigneeEntityById(id);
        User caller = requireUser(username);
        projectAccessGuard.assertCanManage(caller, taskAssignee.getTask().getProject().getId());
        activityLogService.record(caller, taskAssignee.getTask(), "TASK_UNASSIGNED",
                taskAssignee.getUser().getFullName() + " was unassigned");
        taskAssigneeRepository.delete(taskAssignee);
    }
}
