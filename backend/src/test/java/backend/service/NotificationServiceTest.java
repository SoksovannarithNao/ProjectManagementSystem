package backend.service;

import backend.entity.Notification;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserService userService;

    private Task task(LocalDate dueDate) {
        Project project = new Project();
        project.setName("Website Redesign");
        Task task = new Task();
        task.setTitle("Draft the homepage");
        task.setProject(project);
        task.setDueDate(dueDate);
        return task;
    }

    private User user(String fullName) {
        User user = new User();
        user.setFullName(fullName);
        return user;
    }

    @Test
    void notifyTaskAssigned_namesTheTaskProjectDueDateAndWhoAssignedIt() {
        NotificationService service = new NotificationService(notificationRepository, userService);

        service.notifyTaskAssigned(task(LocalDate.of(2026, 11, 5)), user("Owen Lead"), user("Mara Manager"));

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(saved.capture());
        assertThat(saved.getValue().getMessage())
                .contains("Mara Manager")
                .contains("Draft the homepage")
                .contains("Website Redesign")
                .contains("2026-11-05");
    }

    @Test
    void notifyTaskAssigned_saysSoWhenThereIsNoDueDate() {
        NotificationService service = new NotificationService(notificationRepository, userService);

        service.notifyTaskAssigned(task(null), user("Owen Lead"), user("Mara Manager"));

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(saved.capture());
        assertThat(saved.getValue().getMessage()).contains("no due date set");
    }

    @Test
    void notifyTaskAssigned_respectsTheAssigneesNotificationPreference() {
        NotificationService service = new NotificationService(notificationRepository, userService);
        User assignee = user("Owen Lead");
        assignee.setTaskNotificationsEnabled(false);

        service.notifyTaskAssigned(task(LocalDate.of(2026, 11, 5)), assignee, user("Mara Manager"));

        verify(notificationRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }
}
