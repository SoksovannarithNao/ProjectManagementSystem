package backend.service;

import backend.dto.WorkLogRequest;
import backend.dto.WorkLogResponse;
import backend.entity.Task;
import backend.entity.User;
import backend.entity.WorkLog;
import backend.exception.NotFoundException;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.repository.WorkLogRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

// Time tracking (Role_Requirment.md "Time Tracking & Work Logs"): members
// record time spent on a task; the sum is the task's actual time, compared
// with its estimated hours. Access follows the same project rules as
// comments — read needs project access, logging needs content-edit rights
// (not a read-only VIEWER), and deleting is author-or-project-manager.
@Service
@Transactional
public class WorkLogService {

    private final WorkLogRepository workLogRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public WorkLogService(
            WorkLogRepository workLogRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.workLogRepository = workLogRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    @Transactional(readOnly = true)
    public List<WorkLogResponse> getWorkLogsByTaskId(Long taskId, String username) {
        User caller = requireUser(username);
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(caller, task.getProject().getId());
        return workLogRepository.findByTaskIdOrderByWorkDateDescIdDesc(taskId).stream()
                .map(WorkLogResponse::new)
                .toList();
    }

    public WorkLogResponse createWorkLog(WorkLogRequest request, String username) {
        User caller = requireUser(username);
        Task task = requireTask(request.getTaskId());
        projectAccessGuard.assertCan(caller, task.getProject().getId(), Resource.WORK_LOG, Action.CREATE);

        if (request.getWorkDate().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Work date cannot be in the future");
        }

        WorkLog log = new WorkLog();
        log.setTask(task);
        log.setUser(caller);
        log.setWorkDate(request.getWorkDate());
        log.setHoursWorked(request.getHoursWorked());
        String description = request.getDescription() == null ? null : request.getDescription().trim();
        log.setDescription(description == null || description.isEmpty() ? null : description);
        return new WorkLogResponse(workLogRepository.save(log));
    }

    public void deleteWorkLog(Long id, String username) {
        User caller = requireUser(username);
        WorkLog log = workLogRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Work log not found"));
        Long projectId = log.getTask().getProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);

        boolean isAuthor = log.getUser().getId().equals(caller.getId());
        if (!isAuthor && !projectAccessGuard.can(caller, projectId, Resource.WORK_LOG, Action.DELETE)) {
            throw new AccessDeniedException("You can only delete your own time entries");
        }
        workLogRepository.delete(log);
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }
}
