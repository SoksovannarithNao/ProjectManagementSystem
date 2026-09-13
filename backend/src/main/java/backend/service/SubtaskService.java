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
        return new SubtaskResponse(subtaskRepository.save(subtask));
    }

    public SubtaskResponse updateSubtask(Long id, SubtaskRequest request, String username) {
        User caller = requireUser(username);
        Subtask subtask = requireSubtask(id);
        projectAccessGuard.assertAccess(caller, subtask.getTask().getProject().getId());

        applyRequest(subtask, request);
        return new SubtaskResponse(subtaskRepository.save(subtask));
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
