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

    public TaskAssigneeService(
            TaskAssigneeRepository taskAssigneeRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectMemberRepository projectMemberRepository,
            NotificationService notificationService) {
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.notificationService = notificationService;
    }

    // Scoped the same way as TaskService.getAllTasks — otherwise this
    // endpoint would leak the existence of tasks/projects/users a caller
    // can't see via GET /api/tasks, defeating that scoping.
    @Transactional(readOnly = true)
    public List<TaskAssigneeResponse> getAllTaskAssignees(String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        List<TaskAssignee> assignees;
        if ("ADMINISTRATOR".equals(caller.getRole().getName())) {
            assignees = taskAssigneeRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            assignees = taskAssigneeRepository.findByTask_ProjectIdIn(visibleProjectIds);
        }

        return assignees.stream().map(TaskAssigneeResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public TaskAssigneeResponse getTaskAssigneeById(Long id) {
        return new TaskAssigneeResponse(getTaskAssigneeEntityById(id));
    }

    @Transactional(readOnly = true)
    public TaskAssignee getTaskAssigneeEntityById(Long id) {
        return taskAssigneeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task assignee not found"));
    }

    @Transactional(readOnly = true)
    public List<TaskAssigneeResponse> getAssigneesByTaskId(Long taskId) {
        return taskAssigneeRepository.findByTaskId(taskId)
                .stream()
                .map(TaskAssigneeResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TaskAssigneeResponse> getTasksByUserId(Long userId) {
        return taskAssigneeRepository.findByUserId(userId)
                .stream()
                .map(TaskAssigneeResponse::new)
                .toList();
    }

    public TaskAssigneeResponse createTaskAssignee(TaskAssigneeRequest request) {
        Task task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> new NotFoundException("Task not found"));
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new NotFoundException("User not found"));

        TaskAssignee taskAssignee = new TaskAssignee();
        taskAssignee.setTask(task);
        taskAssignee.setUser(user);

        TaskAssignee saved = taskAssigneeRepository.save(taskAssignee);
        notificationService.notifyTaskAssigned(task, user);
        return new TaskAssigneeResponse(saved);
    }

    public void deleteTaskAssignee(Long id) {
        TaskAssignee taskAssignee = getTaskAssigneeEntityById(id);
        taskAssigneeRepository.delete(taskAssignee);
    }
}
