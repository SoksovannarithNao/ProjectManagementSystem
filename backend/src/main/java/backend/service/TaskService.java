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
import backend.repository.SubtaskRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final MilestoneRepository milestoneRepository;
    private final UserRepository userRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final SubtaskRepository subtaskRepository;
    private final NotificationService notificationService;
    private final ProjectAccessGuard projectAccessGuard;

    public TaskService(
            TaskRepository taskRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            MilestoneRepository milestoneRepository,
            UserRepository userRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            SubtaskRepository subtaskRepository,
            NotificationService notificationService,
            ProjectAccessGuard projectAccessGuard) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.milestoneRepository = milestoneRepository;
        this.userRepository = userRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.subtaskRepository = subtaskRepository;
        this.notificationService = notificationService;
        this.projectAccessGuard = projectAccessGuard;
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
        if (projectAccessGuard.isAdmin(caller)) {
            tasks = taskRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            tasks = taskRepository.findByProjectIdIn(visibleProjectIds);
        }

        return tasks.stream().map(TaskResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse getTaskById(Long id, String username) {
        Task task = getTaskEntityById(id);
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return new TaskResponse(task);
    }

    @Transactional(readOnly = true)
    public Task getTaskEntityById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByProjectId(Long projectId, String username) {
        projectAccessGuard.assertAccess(requireUser(username), projectId);
        return taskRepository.findByProjectId(projectId)
                .stream()
                .map(TaskResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByMilestoneId(Long milestoneId, String username) {
        Milestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> new NotFoundException("Milestone not found"));
        projectAccessGuard.assertAccess(requireUser(username), milestone.getProject().getId());
        return taskRepository.findByMilestoneId(milestoneId)
                .stream()
                .map(TaskResponse::new)
                .toList();
    }

    // Global "every task with this status" scoped down to the caller's own
    // visible projects, same as getAllTasks — otherwise a non-admin could
    // enumerate every task in the system regardless of project membership.
    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByStatus(String status, String username) {
        User caller = requireUser(username);
        List<Task> tasks;
        if (projectAccessGuard.isAdmin(caller)) {
            tasks = taskRepository.findByStatus(status);
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            tasks = taskRepository.findByStatus(status).stream()
                    .filter(t -> visibleProjectIds.contains(t.getProject().getId()))
                    .toList();
        }
        return tasks.stream().map(TaskResponse::new).toList();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    // Requires the caller to have content-edit rights (OWNER/ADMIN/MEMBER,
    // not VIEWER) on the task's project — see ProjectAccessGuard. createdBy
    // is always the caller, unless a system ADMINISTRATOR explicitly names
    // someone else via request.createdById — a plain caller's createdById
    // (if the frontend even sends one) is never trusted, closing a
    // spoofing gap this used to have.
    public TaskResponse createTask(TaskRequest request, String username) {
        User caller = requireUser(username);
        projectAccessGuard.assertCanEditContent(caller, request.getProjectId());

        Task task = new Task();
        applyRequest(task, request);
        // Override whatever applyRequest resolved from request.createdById:
        // the caller is always the creator, unless they're a system
        // ADMINISTRATOR explicitly naming someone else.
        if (request.getCreatedById() == null || !projectAccessGuard.isAdmin(caller)) {
            task.setCreatedBy(caller);
        }
        return new TaskResponse(taskRepository.save(task));
    }

    public TaskResponse updateTask(Long id, TaskRequest request, String username) {
        Task task = getTaskEntityById(id);
        User caller = requireUser(username);

        String previousStatus = task.getStatus();
        String effectiveStatus = request.getStatus() != null ? request.getStatus() : task.getStatus();
        boolean newlyCompleting = !"COMPLETED".equals(previousStatus) && "COMPLETED".equals(effectiveStatus);
        if (newlyCompleting) {
            assertNotCompletingWithOpenSubtasks(id);
        }

        if (projectAccessGuard.canManage(caller, task.getProject().getId())) {
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

    // "A task shouldn't be marked done while part of its own checklist
    // isn't." Only gates the transition INTO completed (see the
    // newlyCompleting check at the call site) — a task that's already
    // COMPLETED (however it got that way) can still have its other fields
    // edited via the same full-replace PUT without re-tripping this, since
    // the request always resends the current status unchanged.
    private void assertNotCompletingWithOpenSubtasks(Long taskId) {
        if (subtaskRepository.existsByTaskIdAndStatusNot(taskId, "COMPLETED")) {
            throw new IllegalArgumentException(
                    "Cannot mark this task as completed while it still has incomplete subtasks");
        }
    }

    // A caller without OWNER/ADMIN project rights, updating a task assigned
    // to them, may only change its status/progress — every other field in
    // the request (title, project, dates, etc.) is silently ignored rather
    // than rejected, since the frontend's full-replace PUT still sends the
    // whole object.
    private void applyStatusAndProgressOnly(Task task, TaskRequest request) {
        if (request.getStatus() != null) {
            task.setStatus(request.getStatus());
        }
        if (request.getProgress() != null) {
            task.setProgress(request.getProgress());
        }
    }

    // Requires OWNER/ADMIN (or system ADMINISTRATOR) of the task's project.
    public void deleteTask(Long id, String username) {
        Task task = getTaskEntityById(id);
        projectAccessGuard.assertCanManage(requireUser(username), task.getProject().getId());
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
