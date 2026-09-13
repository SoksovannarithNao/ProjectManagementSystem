package backend.service;

import backend.dto.NotificationResponse;
import backend.entity.Notification;
import backend.entity.ProjectMember;
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

    public void deleteNotification(Long id, String username) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
        // Same "404, not 403" reasoning as markAsRead — don't confirm to the
        // caller that a given id belongs to someone else.
        if (!notification.getUser().getUsername().equals(username)) {
            throw new NotFoundException("Notification not found");
        }
        notificationRepository.delete(notification);
    }

    public void markAllAsRead(String username) {
        User user = userService.getUserEntityByUsername(username);
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(user.getId());
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    // Called by TaskAssigneeService right after a new assignment is saved.
    public void notifyTaskAssigned(Task task, User assignee) {
        if (!assignee.isTaskNotificationsEnabled()) {
            return;
        }
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
            if (!assignee.isTaskNotificationsEnabled()) {
                continue;
            }
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

    // Called by ProjectMemberService.inviteMember right after a new/re-sent
    // invitation is saved. The invited user is the "Admin action -> correct
    // recipient" notification this app was actually missing — see
    // backend/README.md's Notifications section for why the old ADMIN
    // notification requirement didn't work: no event ever created one.
    public void notifyTeamInvitation(ProjectMember member, User inviter) {
        User invitee = member.getUser();
        if (!invitee.isTaskNotificationsEnabled()) {
            return;
        }
        Notification notification = new Notification();
        notification.setUser(invitee);
        notification.setType("TEAM_INVITATION");
        notification.setTitle("Team invitation");
        notification.setMessage(inviter.getFullName() + " invited you to join \"" + member.getProject().getName() + "\"");
        notification.setProject(member.getProject());
        notificationRepository.save(notification);
    }

    // Called by ProjectMemberService.respondToInvitation — notifies the
    // Team Admin who sent the invitation whether it was accepted or declined.
    public void notifyInvitationResponded(ProjectMember member, boolean accepted) {
        User inviter = member.getInvitedBy();
        if (inviter == null || !inviter.isTaskNotificationsEnabled()) {
            return;
        }
        Notification notification = new Notification();
        notification.setUser(inviter);
        notification.setType("TEAM_INVITATION_RESPONDED");
        notification.setTitle(accepted ? "Invitation accepted" : "Invitation declined");
        notification.setMessage(member.getUser().getFullName() + " " + (accepted ? "accepted" : "declined")
                + " your invitation to join \"" + member.getProject().getName() + "\"");
        notification.setProject(member.getProject());
        notificationRepository.save(notification);
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
