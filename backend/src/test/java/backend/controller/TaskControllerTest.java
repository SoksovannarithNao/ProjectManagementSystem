package backend.controller;

import backend.dto.PageResponse;
import backend.dto.ProjectTaskStatsResponse;
import backend.dto.TaskResponse;
import backend.dto.TaskSummaryResponse;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.service.TaskService;
import backend.util.PageParams;
import backend.util.TaskListQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// GET /api/tasks and its siblings as the screens call them: every query parameter reaches the query
// (checked by running the captured query over a few tasks), paging switches the answer to a page, a
// wrong value is a 400 before any service is asked, and an error is the application's JSON.
@ExtendWith(MockitoExtension.class)
class TaskControllerTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Mock
    private TaskService taskService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = ControllerTestSupport.mvcFor(new TaskController(taskService));
    }

    private static Project project(long id, String name, String progress) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        p.setName(name);
        p.setProgress(new BigDecimal(progress));
        return p;
    }

    private static Task task(long id, Project project, String status, String priority, LocalDate due) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", id);
        ReflectionTestUtils.setField(t, "createdAt", OffsetDateTime.parse("2026-10-01T09:00:00Z").plusMinutes(id));
        t.setTitle("Task " + id);
        t.setProject(project);
        t.setStatus(status);
        t.setPriority(priority);
        t.setDueDate(due);
        t.setProgress(BigDecimal.ZERO);
        return t;
    }

    private static User user(long id) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setFullName("User " + id);
        return u;
    }

    private final Project alpha = project(10, "Alpha", "40");
    private final Project beta = project(20, "Beta", "100");
    private final Task a = task(1, alpha, "TODO", "LOW", TODAY.minusDays(4));
    private final Task b = task(2, alpha, "IN_PROGRESS", "HIGH", TODAY.plusDays(6));
    private final Task c = task(3, beta, "COMPLETED", "URGENT", TODAY.plusDays(20));
    private final List<Task> all = List.of(a, b, c);
    private final Map<Long, List<User>> assignees = Map.of(1L, List.of(user(1)), 3L, List.of(user(1), user(2)));

    private TaskListQuery queryFor(String url) throws Exception {
        when(taskService.getAllTasks(eq("pm.olivia"), any())).thenReturn(List.of());
        mvc.perform(get(url).principal(ControllerTestSupport.CALLER)).andExpect(status().isOk());
        ArgumentCaptor<TaskListQuery> query = ArgumentCaptor.forClass(TaskListQuery.class);
        verify(taskService).getAllTasks(eq("pm.olivia"), query.capture());
        return query.getValue();
    }

    private List<Long> ids(List<Task> tasks) {
        return tasks.stream().map(Task::getId).toList();
    }

    // ---- the list and its paging ----

    @Test
    void withoutPageOrSize_theAnswerIsAPlainArray_andNothingIsPaged() throws Exception {
        when(taskService.getAllTasks(eq("pm.olivia"), any())).thenReturn(List.of());

        mvc.perform(get("/api/tasks").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));
        verify(taskService, never()).getTasksPage(any(), any(), any());
    }

    @Test
    void withPageOrSize_theAnswerIsAPage_andOneAloneIsFilledInWithTheDefault() throws Exception {
        when(taskService.getTasksPage(eq("pm.olivia"), any(), any())).thenAnswer(inv -> {
            PageParams p = inv.getArgument(2);
            return new PageResponse<TaskResponse>(List.of(), 42, p.getPage(), p.getSize());
        });

        mvc.perform(get("/api/tasks?page=1&size=2").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.total").value(42))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2));
        mvc.perform(get("/api/tasks?size=5").principal(ControllerTestSupport.CALLER))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(5));
        mvc.perform(get("/api/tasks?page=3").principal(ControllerTestSupport.CALLER))
                .andExpect(jsonPath("$.page").value(3))
                .andExpect(jsonPath("$.size").value(PageParams.DEFAULT_SIZE));
    }

    @Test
    void aBadPageOrSizeIs400_beforeTheServiceIsAsked() throws Exception {
        for (String bad : List.of("size=0", "size=201", "page=-1", "size=many", "page=first")) {
            mvc.perform(get("/api/tasks?" + bad).principal(ControllerTestSupport.CALLER))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));
        }
        verify(taskService, never()).getTasksPage(any(), any(), any());
        verify(taskService, never()).getAllTasks(any(), any());
    }

    // ---- every parameter reaches the query ----

    @Test
    void statusPriorityAndAssigneeFilters_reachTheQuery() throws Exception {
        assertThat(ids(queryFor("/api/tasks?status=TODO&status=IN_PROGRESS").apply(all, assignees))).containsExactly(1L, 2L);
    }

    @Test
    void priority_assignee_unassigned_andProject_reachTheQuery() throws Exception {
        assertThat(ids(queryFor("/api/tasks?priority=HIGH").apply(all, assignees))).containsExactly(2L);
    }

    @Test
    void severalAssigneeIds_mustAllHoldTheTask_andUnassignedMeansNone() throws Exception {
        assertThat(ids(queryFor("/api/tasks?assigneeId=1&assigneeId=2").apply(all, assignees))).containsExactly(3L);
    }

    @Test
    void unassigned_keepsTheTasksWithNoAssignee() throws Exception {
        assertThat(ids(queryFor("/api/tasks?unassigned=true").apply(all, assignees))).containsExactly(2L);
    }

    @Test
    void projectAndDue_reachTheQuery() throws Exception {
        assertThat(ids(queryFor("/api/tasks?projectId=20").apply(all, assignees))).containsExactly(3L);
    }

    @Test
    void dueOverdue_andTheQuickViews_reachTheQuery() throws Exception {
        assertThat(ids(queryFor("/api/tasks?due=overdue").apply(all, assignees))).containsExactly(1L);
    }

    @Test
    void view_reachesTheQuery() throws Exception {
        assertThat(ids(queryFor("/api/tasks?view=completed").apply(all, assignees))).containsExactly(3L);
    }

    @Test
    void dueFromAndDueTo_areTheWindowOfDueDates_bothDaysIncluded() throws Exception {
        String url = "/api/tasks?dueFrom=" + TODAY.minusDays(4) + "&dueTo=" + TODAY.plusDays(6);

        assertThat(ids(queryFor(url).apply(all, assignees))).containsExactly(1L, 2L);
    }

    @Test
    void blocked_isHandedOnForTheServiceToApply() throws Exception {
        assertThat(queryFor("/api/tasks?blocked=true").blocked()).isTrue();
    }

    @Test
    void blockedFalseAndNoBlocked_areTold() throws Exception {
        assertThat(queryFor("/api/tasks?blocked=false").blocked()).isFalse();
    }

    @Test
    void sortAndGroupByProject_reachTheQuery() throws Exception {
        // finished projects last, then the sort inside each: Alpha (b by priority, then a), Beta last
        assertThat(ids(queryFor("/api/tasks?groupBy=project&sort=priority").apply(all, assignees))).containsExactly(2L, 1L, 3L);
    }

    @Test
    void searchIsTrimmedAndCaseInsensitive() throws Exception {
        when(taskService.getAllTasks(eq("pm.olivia"), any())).thenReturn(List.of());

        mvc.perform(get("/api/tasks").param("search", "  TASK 2 ").principal(ControllerTestSupport.CALLER)).andExpect(status().isOk());

        ArgumentCaptor<TaskListQuery> query = ArgumentCaptor.forClass(TaskListQuery.class);
        verify(taskService).getAllTasks(eq("pm.olivia"), query.capture());
        assertThat(ids(query.getValue().apply(all, assignees))).containsExactly(2L);
    }

    @Test
    void anUnknownOrMalformedValueIs400_andTheServiceIsNotAsked() throws Exception {
        for (String bad : List.of("status=DONE", "priority=CRITICAL", "due=soon", "view=soon", "groupBy=owner", "sort=colour",
                "blocked=maybe", "dueFrom=soon", "dueTo=2026-13-45", "assigneeId=abc", "projectId=abc",
                "dueFrom=2026-10-20&dueTo=2026-10-10")) {
            mvc.perform(get("/api/tasks?" + bad).principal(ControllerTestSupport.CALLER))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));
        }
        verify(taskService, never()).getAllTasks(any(), any());
        verify(taskService, never()).getTasksPage(any(), any(), any());
    }

    // ---- the neighbours: summary, project counts, one task ----

    @Test
    void summary_answersTheCountsTheAssigneesAndWhoCompletedWhat() throws Exception {
        Map<String, Long> counts = new LinkedHashMap<>();
        counts.put("all", 98L);
        counts.put("overdue", 9L);
        when(taskService.getTaskSummary(eq("pm.olivia"), any()))
                .thenReturn(new TaskSummaryResponse(counts, List.of(), Map.of(7L, 3L)));

        mvc.perform(get("/api/tasks/summary?projectId=10&status=TODO").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewCounts.all").value(98))
                .andExpect(jsonPath("$.viewCounts.overdue").value(9))
                .andExpect(jsonPath("$.assignees").isArray())
                .andExpect(jsonPath("$.completedByAssignee.7").value(3));
    }

    @Test
    void summary_takesTheFiltersButNotTheViewOrPaging() throws Exception {
        when(taskService.getTaskSummary(eq("pm.olivia"), any())).thenReturn(new TaskSummaryResponse(Map.of(), List.of(), Map.of()));

        mvc.perform(get("/api/tasks/summary?status=TODO&view=completed&page=0&size=1&sort=title").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk());

        ArgumentCaptor<TaskListQuery> query = ArgumentCaptor.forClass(TaskListQuery.class);
        verify(taskService).getTaskSummary(eq("pm.olivia"), query.capture());
        // the status filter applies (only the To Do task is left) and the view and the sort are not part of the summary
        assertThat(ids(query.getValue().apply(all, assignees))).containsExactly(1L);
    }

    @Test
    void projectStats_isAnArrayOfCounts_andIsNotTakenForATaskId() throws Exception {
        when(taskService.getProjectTaskStats("pm.olivia")).thenReturn(List.of(new ProjectTaskStatsResponse(10L, 8, 3, 1)));

        mvc.perform(get("/api/tasks/project-stats").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].projectId").value(10))
                .andExpect(jsonPath("$[0].total").value(8))
                .andExpect(jsonPath("$[0].completed").value(3))
                .andExpect(jsonPath("$[0].overdue").value(1));
        verify(taskService, never()).getTaskById(any(), any());
    }

    @Test
    void aMissingTaskIsA404InTheApplicationsJson_aForbiddenOneA403() throws Exception {
        when(taskService.getTaskById(99L, "pm.olivia")).thenThrow(new NotFoundException("Task not found"));
        when(taskService.getTaskById(98L, "pm.olivia")).thenThrow(new AccessDeniedException("no"));

        mvc.perform(get("/api/tasks/99").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Task not found"));
        mvc.perform(get("/api/tasks/98").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Forbidden"));
        mvc.perform(get("/api/tasks/abc").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid value for 'id'"));
    }

    @Test
    void tasksOfAStatus_checksTheStatusBeforeAskingTheService() throws Exception {
        mvc.perform(get("/api/tasks/status/DONE").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid status: DONE"));
        verify(taskService, never()).getTasksByStatus(any(), any());

        when(taskService.getTasksByStatus("TODO", "pm.olivia")).thenReturn(List.of());
        mvc.perform(get("/api/tasks/status/TODO").principal(ControllerTestSupport.CALLER)).andExpect(status().isOk());
    }
}
