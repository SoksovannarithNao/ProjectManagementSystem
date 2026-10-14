package backend.service;

import backend.entity.Notification;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.dto.NotificationResponse;
import backend.dto.PageResponse;
import backend.repository.NotificationRepository;
import backend.util.PageParams;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    // ---- the bell asks for its notifications a page at a time (risk R-5) ----

    @Test
    void getMyNotificationsPage_returnsTheNewestFirstWithTheTotalOfAll() {
        NotificationService service = new NotificationService(notificationRepository, userService);
        User me = user("Mia Alvarez");
        org.springframework.test.util.ReflectionTestUtils.setField(me, "id", 3L);
        when(userService.getUserEntityByUsername("dev.mia")).thenReturn(me);
        Notification one = new Notification();
        one.setUser(me);
        one.setTitle("First");
        when(notificationRepository.findByUserId(eq(3L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(one), org.springframework.data.domain.PageRequest.of(1, 20), 41));

        PageResponse<NotificationResponse> page = service.getMyNotificationsPage("dev.mia", PageParams.of(1, 20));

        assertThat(page.getItems()).hasSize(1);
        assertThat(page.getTotal()).isEqualTo(41);
        assertThat(page.getPage()).isEqualTo(1);
        assertThat(page.getSize()).isEqualTo(20);
        ArgumentCaptor<Pageable> asked = ArgumentCaptor.forClass(Pageable.class);
        verify(notificationRepository).findByUserId(eq(3L), asked.capture());
        assertThat(asked.getValue().getPageNumber()).isEqualTo(1);
        assertThat(asked.getValue().getPageSize()).isEqualTo(20);
        // newest first, the id breaking ties so that no page repeats or skips one
        assertThat(asked.getValue().getSort().getOrderFor("createdAt").getDirection()).isEqualTo(Sort.Direction.DESC);
        assertThat(asked.getValue().getSort().getOrderFor("id").getDirection()).isEqualTo(Sort.Direction.DESC);
    }
}
