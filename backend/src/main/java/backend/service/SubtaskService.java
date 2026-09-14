package backend.service;

import backend.dto.SubtaskRequest;
import backend.dto.SubtaskResponse;
import backend.entity.Subtask;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.SubtaskRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional
public class SubtaskService {

    private final SubtaskRepository subtaskRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public SubtaskService(
            SubtaskRepository subtaskRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.subtaskRepository = subtaskRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    @Transactional(readOnly = true)
    public List<SubtaskResponse> getSubtasksByTaskId(Long taskId, String username) {
        User caller = requireUser(username);
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(caller, task.getProject().getId());
        return subtaskRepository.findByTaskIdOrderByIdAsc(taskId).stream().map(SubtaskResponse::new).toList();
    }

    public SubtaskResponse createSubtask(SubtaskRequest request, String username) {
        User caller = requireUser(username);
        Task task = requireTask(request.getTaskId());
        projectAccessGuard.assertAccess(caller, task.getProject().getId());

        Subtask subtask = new Subtask();
        subtask.setTask(task);
        applyRequest(subtask, request);
        SubtaskResponse response = new SubtaskResponse(subtaskRepository.save(subtask));
        // A new subtask defaults to TO_DO — adding one to an already-COMPLETED
        // task breaks the "parent can only be COMPLETED when every subtask is"
        // invariant just as much as reopening an existing one does.
        reopenParentIfNoLongerFullyComplete(task);
        return response;
    }

    public SubtaskResponse updateSubtask(Long id, SubtaskRequest request, String username) {
        User caller = requireUser(username);
        Subtask subtask = requireSubtask(id);
        projectAccessGuard.assertAccess(caller, subtask.getTask().getProject().getId());

        applyRequest(subtask, request);
        SubtaskResponse response = new SubtaskResponse(subtaskRepository.save(subtask));
        reopenParentIfNoLongerFullyComplete(subtask.getTask());
        return response;
    }

    // "If a parent task is already DONE and a subtask is changed back to
    // incomplete, the parent must not remain incorrectly marked as DONE."
    // The backend is the source of truth for this invariant — TaskService
    // refuses to let a task BECOME COMPLETED while any subtask is open (see
    // TaskService.assertNotCompletingWithOpenSubtasks), but a subtask being
    // added or reopened AFTER the parent is already COMPLETED goes through
    // this service instead, so the same invariant has to be re-checked and
    // repaired here rather than left silently violated. Reopens to
    // IN_PROGRESS (not back to whatever it was before) and recomputes
    // progress from the actual completed/total subtask ratio, so the task
    // never visually shows 100%/DONE while work remains.
    private void reopenParentIfNoLongerFullyComplete(Task task) {
        if (!"COMPLETED".equals(task.getStatus())) {
            return;
        }
        List<Subtask> siblings = subtaskRepository.findByTaskIdOrderByIdAsc(task.getId());
        long total = siblings.size();
        long completed = siblings.stream().filter(s -> "COMPLETED".equals(s.getStatus())).count();
        if (total > 0 && completed < total) {
            task.setStatus("IN_PROGRESS");
            task.setCompletedAt(null);
            task.setProgress(BigDecimal.valueOf(completed * 100 / total));
            taskRepository.save(task);
        }
    }

    public void deleteSubtask(Long id, String username) {
        User caller = requireUser(username);
        Subtask subtask = requireSubtask(id);
        projectAccessGuard.assertAccess(caller, subtask.getTask().getProject().getId());

        subtaskRepository.delete(subtask);
    }

    private void applyRequest(Subtask subtask, SubtaskRequest request) {
        subtask.setTitle(request.getTitle());
        subtask.setDueDate(request.getDueDate());
        if (request.getStatus() != null) {
            subtask.setStatus(request.getStatus());
        }
        if (request.getAssigneeId() != null) {
            User assignee = userRepository.findById(request.getAssigneeId())
                    .orElseThrow(() -> new NotFoundException("Assignee (user) not found"));
            subtask.setAssignee(assignee);
        } else {
            subtask.setAssignee(null);
        }
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private Subtask requireSubtask(Long id) {
        return subtaskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Subtask not found"));
    }
}
