package backend.service;

import backend.dto.ChecklistItemRequest;
import backend.dto.ChecklistItemResponse;
import backend.entity.ChecklistItem;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ChecklistItemRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Checklist items inside a task (assignment-brief.md B1.6, B3.4, D-07).
//
//  * read: every member of the project;
//  * add: CHECKLIST_ITEM:CREATE (Owner, Team Leader, Team Member);
//  * tick, untick, rename: CHECKLIST_ITEM:EDIT, and a Team Member only on tasks
//    assigned to them (like subtasks);
//  * delete: CHECKLIST_ITEM:DELETE (Owner, Team Leader), or the person who added it.
// A task's progress counts its checklist items together with its subtasks; the
// database trigger trg_checklist_items_sync_parent_task keeps that current.
@Service
@Transactional
public class ChecklistItemService {

    private final ChecklistItemRepository checklistItemRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final TaskAssigneeRepository taskAssigneeRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public ChecklistItemService(
            ChecklistItemRepository checklistItemRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            TaskAssigneeRepository taskAssigneeRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.checklistItemRepository = checklistItemRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.taskAssigneeRepository = taskAssigneeRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    @Transactional(readOnly = true)
    public List<ChecklistItemResponse> getByTask(Long taskId, String username) {
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return checklistItemRepository.findByTaskIdOrderBySortOrderAscIdAsc(taskId).stream()
                .map(ChecklistItemResponse::new)
                .toList();
    }

    public ChecklistItemResponse create(ChecklistItemRequest request, String username) {
        if (request.getTaskId() == null) {
            throw new IllegalArgumentException("A checklist item belongs to a task");
        }
        User caller = requireUser(username);
        Task task = requireTask(request.getTaskId());
        projectAccessGuard.assertCan(caller, task.getProject().getId(), Resource.CHECKLIST_ITEM, Action.CREATE);

        ChecklistItem item = new ChecklistItem();
        item.setTask(task);
        item.setContent(request.getContent().trim());
        item.setCompleted(Boolean.TRUE.equals(request.getCompleted()));
        item.setSortOrder(checklistItemRepository.maxSortOrder(task.getId()) + 1);
        item.setCreatedBy(caller);
        return new ChecklistItemResponse(checklistItemRepository.save(item));
    }

    public ChecklistItemResponse update(Long id, ChecklistItemRequest request, String username) {
        User caller = requireUser(username);
        ChecklistItem item = requireItem(id);
        Long projectId = item.getTask().getProject().getId();
        projectAccessGuard.assertCan(caller, projectId, Resource.CHECKLIST_ITEM, Action.EDIT);
        // Someone who can edit tasks (Owner, Team Leader) works on any item; a Team
        // Member only on the checklist of a task assigned to them (B3.5).
        if (!projectAccessGuard.can(caller, projectId, Resource.TASK, Action.EDIT)
                && !taskAssigneeRepository.existsByTaskIdAndUserId(item.getTask().getId(), caller.getId())) {
            throw new AccessDeniedException("You can only change the checklist of tasks assigned to you");
        }
        item.setContent(request.getContent().trim());
        if (request.getCompleted() != null) {
            item.setCompleted(request.getCompleted());
        }
        return new ChecklistItemResponse(checklistItemRepository.save(item));
    }

    public void delete(Long id, String username) {
        User caller = requireUser(username);
        ChecklistItem item = requireItem(id);
        Long projectId = item.getTask().getProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);
        boolean isAuthor = item.getCreatedBy() != null && item.getCreatedBy().getId().equals(caller.getId());
        if (!isAuthor && !projectAccessGuard.can(caller, projectId, Resource.CHECKLIST_ITEM, Action.DELETE)) {
            throw new AccessDeniedException("You can only delete checklist items you added");
        }
        checklistItemRepository.delete(item);
    }

    private ChecklistItem requireItem(Long id) {
        return checklistItemRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Checklist item not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
