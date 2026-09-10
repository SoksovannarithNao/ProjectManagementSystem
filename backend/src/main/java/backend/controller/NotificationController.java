package backend.controller;

import backend.dto.NotificationResponse;
import backend.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// Every endpoint here is scoped to "the caller's own" notifications by
// username (from the JWT), not by role — any authenticated user manages
// their own notifications, same as no-@PreAuthorize GET endpoints elsewhere.
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<NotificationResponse> getMyNotifications(Authentication authentication) {
        return notificationService.getMyNotifications(authentication.getName());
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount(Authentication authentication) {
        return Map.of("count", notificationService.getUnreadCount(authentication.getName()));
    }

    @PutMapping("/{id}/read")
    public NotificationResponse markAsRead(@PathVariable Long id, Authentication authentication) {
        return notificationService.markAsRead(id, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PostMapping("/read-all")
    public void markAllAsRead(Authentication authentication) {
        notificationService.markAllAsRead(authentication.getName());
    }
}
