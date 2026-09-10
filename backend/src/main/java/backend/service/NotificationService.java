package backend.service;

import backend.dto.NotificationResponse;
import backend.entity.Notification;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserService userService;

    public NotificationService(NotificationRepository notificationRepository, UserService userService) {
        this.notificationRepository = notificationRepository;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(String username) {
        User user = userService.getUserEntityByUsername(username);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(NotificationResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(String username) {
        User user = userService.getUserEntityByUsername(username);
        return notificationRepository.countByUserIdAndReadFalse(user.getId());
    }

    public NotificationResponse markAsRead(Long id, String username) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        // Not the requester's notification — 404 rather than 403, so we don't
        // confirm to the caller that a given id belongs to someone else.
        if (!notification.getUser().getUsername().equals(username)) {
            throw new NotFoundException("Notification not found");
        }
        notification.setRead(true);
        return new NotificationResponse(notificationRepository.save(notification));
    }

    public void markAllAsRead(String username) {
        User user = userService.getUserEntityByUsername(username);
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(user.getId());
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    // Called by TaskAssigneeService right after a new assignment is saved.
    public void notifyTaskAssigned(Task task, User assignee) {
        Notification notification = new Notification();
        notification.setUser(assignee);
        notification.setType("TASK_ASSIGNED");
        notification.setTitle("New task assigned");
        notification.setMessage("You were assigned to \"" + task.getTitle() + "\"");
        notification.setProject(task.getProject());
        notification.setTask(task);
        notificationRepository.save(notification);
    }

    // Called by TaskService after a task's status actually changes.
    public void notifyTaskStatusChanged(Task task, List<User> assignees) {
        String humanizedStatus = humanizeStatus(task.getStatus());
        for (User assignee : assignees) {
            Notification notification = new Notification();
            notification.setUser(assignee);
            notification.setType("TASK_STATUS_CHANGED");
            notification.setTitle("Task status updated");
            notification.setMessage("\"" + task.getTitle() + "\" is now " + humanizedStatus);
            notification.setProject(task.getProject());
            notification.setTask(task);
            notificationRepository.save(notification);
        }
    }

    private String humanizeStatus(String status) {
        if (status == null || status.isBlank()) return "";
        StringBuilder result = new StringBuilder();
        for (String word : status.toLowerCase().split("_")) {
            if (word.isEmpty()) continue;
            if (!result.isEmpty()) result.append(' ');
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }
}
