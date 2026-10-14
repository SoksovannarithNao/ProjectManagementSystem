package backend.controller;

import backend.dto.NotificationResponse;
import backend.dto.PageResponse;
import backend.dto.ProjectResponse;
import backend.service.NotificationService;
import backend.service.ProjectService;
import backend.util.PageParams;
import backend.util.ProjectListQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The other two lists that can be read a page at a time: with page or size the answer is
// { items, total, page, size }, without them it is the whole list, and a bad value is a 400.
@ExtendWith(MockitoExtension.class)
class PagedListControllersTest {

    @Mock
    private ProjectService projectService;
    @Mock
    private NotificationService notificationService;

    private MockMvc projects;
    private MockMvc notifications;

    @BeforeEach
    void setUp() {
        projects = ControllerTestSupport.mvcFor(new ProjectController(projectService));
        notifications = ControllerTestSupport.mvcFor(new NotificationController(notificationService));
    }

    @Test
    void projects_withoutPaging_areAnArray_withPaging_aPage() throws Exception {
        when(projectService.getAllProjects(eq("pm.olivia"), any())).thenReturn(List.of());
        when(projectService.getProjectsPage(eq("pm.olivia"), any(), any())).thenAnswer(inv -> {
            PageParams p = inv.getArgument(2);
            return new PageResponse<ProjectResponse>(List.of(), 11, p.getPage(), p.getSize());
        });

        projects.perform(get("/api/projects").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        verify(projectService, never()).getProjectsPage(any(), any(), any());

        projects.perform(get("/api/projects?page=2&size=3&status=IN_PROGRESS&sort=name").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(11))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(3));
    }

    @Test
    void projects_aBadPagingValueOrFilterIs400() throws Exception {
        for (String bad : List.of("size=0", "size=201", "page=-1", "status=DONE", "priority=NOPE", "sort=colour", "managerId=abc")) {
            projects.perform(get("/api/projects?" + bad).principal(ControllerTestSupport.CALLER))
                    .andExpect(status().isBadRequest());
        }
        verify(projectService, never()).getAllProjects(any(), any(ProjectListQuery.class));
        verify(projectService, never()).getProjectsPage(any(), any(), any());
    }

    @Test
    void notifications_withoutPaging_areAnArray_withPaging_aPage() throws Exception {
        when(notificationService.getMyNotifications("pm.olivia")).thenReturn(List.of());
        when(notificationService.getMyNotificationsPage(eq("pm.olivia"), any())).thenAnswer(inv -> {
            PageParams p = inv.getArgument(1);
            return new PageResponse<NotificationResponse>(List.of(), 23, p.getPage(), p.getSize());
        });

        notifications.perform(get("/api/notifications").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        notifications.perform(get("/api/notifications?page=0&size=20").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(23))
                .andExpect(jsonPath("$.size").value(20));
        verify(notificationService).getMyNotificationsPage(eq("pm.olivia"), any());
    }

    @Test
    void notifications_unreadCountIsAMapWithCount_andABadPageIs400() throws Exception {
        when(notificationService.getUnreadCount("pm.olivia")).thenReturn(5L);

        notifications.perform(get("/api/notifications/unread-count").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(5));
        notifications.perform(get("/api/notifications?size=500").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest());
        verify(notificationService, never()).getMyNotificationsPage(any(), any());
    }
}
