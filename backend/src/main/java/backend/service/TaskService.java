package backend.service;

import backend.dto.TaskRequest;
import backend.dto.TaskResponse;
import backend.entity.Milestone;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.entity.TaskAssignee;
import backend.exception.NotFoundException;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@Service
@Transactional
public class TaskService {

    // Roles allowed to edit every field of any task via PUT /api/tasks/{id}.
    // Everyone else (TEAM_MEMBER) may only touch status/progress, and only on
    // a task they're assigned to — see updateTask.
    private static final Set<String> TASK_FULL_EDIT_ROLES =
            Set.of("ADMINISTRATOR", "PROJECT_MANAGER", "TEAM_LEADER");

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final MilestoneRepository milestoneRepository;
    private final UserRepository userRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final NotificationService notificationService;

    public TaskService(
            TaskRepository taskRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            MilestoneRepository milestoneRepository,
            UserRepository userRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            NotificationService notificationService) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.milestoneRepository = milestoneRepository;
        this.userRepository = userRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.notificationService = notificationService;
    }

    // Scoped by project membership (Role_Requirment.md / Project_requirement_plan.md
    // §28: "Users should only view Projects and Tasks for which they have
    // permission") — ADMINISTRATOR retains full visibility; everyone else
    // only sees tasks in projects they're a member of. A task's assignee is
    // always already a project member (trg_task_assignees_project_member
    // enforces this), so project membership alone is a strict superset of
    // "tasks assigned to me" — no separate assignee-based clause is needed.
    @Transactional(readOnly = true)
    public List<TaskResponse> getAllTasks(String username) {
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        List<Task> tasks;
        if ("ADMINISTRATOR".equals(caller.getRole().getName())) {
            tasks = taskRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            tasks = taskRepository.findByProjectIdIn(visibleProjectIds);
        }

        return tasks.stream().map(TaskResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse getTaskById(Long id) {
        return new TaskResponse(getTaskEntityById(id));
    }

    @Transactional(readOnly = true)
    public Task getTaskEntityById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByProjectId(Long projectId) {
        return taskRepository.findByProjectId(projectId)
                .stream()
                .map(TaskResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByMilestoneId(Long milestoneId) {
        return taskRepository.findByMilestoneId(milestoneId)
                .stream()
                .map(TaskResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByStatus(String status) {
        return taskRepository.findByStatus(status)
                .stream()
                .map(TaskResponse::new)
                .toList();
    }

    public TaskResponse createTask(TaskRequest request) {
        Task task = new Task();
        applyRequest(task, request);
        return new TaskResponse(taskRepository.save(task));
    }

    public TaskResponse updateTask(Long id, TaskRequest request, String username) {
        Task task = getTaskEntityById(id);
        User caller = userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));

        String previousStatus = task.getStatus();

        if (TASK_FULL_EDIT_ROLES.contains(caller.getRole().getName())) {
            applyRequest(task, request);
        } else {
            if (!taskAssigneeRepository.existsByTaskIdAndUserId(id, caller.getId())) {
                throw new AccessDeniedException("You are not assigned to this task");
            }
            applyStatusAndProgressOnly(task, request);
        }

        Task saved = taskRepository.save(task);

        if (previousStatus != null && !previousStatus.equals(saved.getStatus())) {
            List<User> assignees = taskAssigneeRepository.findByTaskId(saved.getId())
                    .stream()
                    .map(TaskAssignee::getUser)
                    .toList();
            notificationService.notifyTaskStatusChanged(saved, assignees);
        }

        return new TaskResponse(saved);
    }

    // A TEAM_MEMBER updating a task assigned to them may only change its
    // status/progress — every other field in the request (title, project,
    // dates, etc.) is silently ignored rather than rejected, since the
    // frontend's full-replace PUT still sends the whole object.
    private void applyStatusAndProgressOnly(Task task, TaskRequest request) {
        if (request.getStatus() != null) {
            task.setStatus(request.getStatus());
        }
        if (request.getProgress() != null) {
            task.setProgress(request.getProgress());
        }
    }

    public void deleteTask(Long id) {
        Task task = getTaskEntityById(id);
        taskRepository.delete(task);
    }

    private void applyRequest(Task task, TaskRequest request) {
        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new NotFoundException("Project not found"));

        Milestone milestone = null;
        if (request.getMilestoneId() != null) {
            milestone = milestoneRepository.findById(request.getMilestoneId())
                    .orElseThrow(() -> new NotFoundException("Milestone not found"));
        }

        User createdBy = null;
        if (request.getCreatedById() != null) {
            createdBy = userRepository.findById(request.getCreatedById())
                    .orElseThrow(() -> new NotFoundException("Creator (user) not found"));
        }

        task.setProject(project);
        task.setMilestone(milestone);
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        if (request.getPriority() != null) {
            task.setPriority(request.getPriority());
        }
        if (request.getStatus() != null) {
            task.setStatus(request.getStatus());
        }
        task.setStartDate(request.getStartDate());
        task.setDueDate(request.getDueDate());
        task.setEstimatedHours(request.getEstimatedHours());
        if (request.getProgress() != null) {
            task.setProgress(request.getProgress());
        } else if (task.getProgress() == null) {
            task.setProgress(BigDecimal.ZERO);
        }
        task.setCompletedAt(request.getCompletedAt());
        task.setCreatedBy(createdBy);
    }
}
