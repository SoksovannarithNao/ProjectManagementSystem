package backend.controller;

import backend.dto.DashboardStatsResponse;
import backend.dto.TaskActivityResponse;
import backend.service.DashboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The dashboard endpoints: the statistics, and the activity chart's daily figures with its defaults.
@ExtendWith(MockitoExtension.class)
class DashboardControllerTest {

    @Mock
    private DashboardService dashboardService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = ControllerTestSupport.mvcFor(new DashboardController(dashboardService));
    }

    @Test
    void stats_areTheProjectAndTaskFigures() throws Exception {
        when(dashboardService.getStats("pm.olivia")).thenReturn(new DashboardStatsResponse(
                new DashboardStatsResponse.ProjectStats(11, 2, 6, 1, 1, 1, 1, new BigDecimal("35.0")),
                new DashboardStatsResponse.TaskStats(98, 37, 16, 6, 37, 2, 9),
                List.of()));

        mvc.perform(get("/api/dashboard/stats").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projects.total").value(11))
                .andExpect(jsonPath("$.projects.delayed").value(1))
                .andExpect(jsonPath("$.tasks.total").value(98))
                .andExpect(jsonPath("$.tasks.overdue").value(9))
                .andExpect(jsonPath("$.delayedProjects").isArray());
    }

    @Test
    void taskActivity_defaultsToAWeek_andPassesTheZoneAndTheProjectOn() throws Exception {
        when(dashboardService.getTaskActivity(eq("pm.olivia"), anyInt(), any(), any())).thenReturn(
                List.of(new TaskActivityResponse(LocalDate.of(2026, 10, 14), 2, 1, 9)));

        mvc.perform(get("/api/dashboard/task-activity").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].date").value("2026-10-14"))
                .andExpect(jsonPath("$[0].created").value(2))
                .andExpect(jsonPath("$[0].completed").value(1))
                .andExpect(jsonPath("$[0].overdue").value(9));
        verify(dashboardService).getTaskActivity("pm.olivia", 7, null, null);

        mvc.perform(get("/api/dashboard/task-activity?days=30&zone=Asia/Phnom_Penh&projectId=10").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk());
        verify(dashboardService).getTaskActivity("pm.olivia", 30, "Asia/Phnom_Penh", 10L);
    }

    @Test
    void taskActivity_aBadDaysOrProjectIs400_andAServiceRefusalIsToo() throws Exception {
        mvc.perform(get("/api/dashboard/task-activity?days=many").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid value for 'days'"));
        mvc.perform(get("/api/dashboard/task-activity?projectId=x").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest());
        verify(dashboardService, never()).getTaskActivity(any(), anyInt(), isNull(), any());

        when(dashboardService.getTaskActivity("pm.olivia", 400, null, null)).thenThrow(new IllegalArgumentException("Invalid days: 400 (1 to 366)"));
        mvc.perform(get("/api/dashboard/task-activity?days=400").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid days: 400 (1 to 366)"));
    }
}
