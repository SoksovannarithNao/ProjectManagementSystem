package backend.util;

import backend.dto.TaskActivityResponse;
import backend.entity.Task;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// The daily figures of the dashboard's activity chart (risk R-5: calculated where the tasks are).
class TaskActivityTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);
    private static final ZoneId UTC = ZoneId.of("UTC");

    private static Task task(String status, LocalDate due, String createdAt, String completedAt) {
        Task t = new Task();
        t.setStatus(status);
        t.setDueDate(due);
        ReflectionTestUtils.setField(t, "createdAt", createdAt == null ? null : OffsetDateTime.parse(createdAt));
        t.setCompletedAt(completedAt == null ? null : OffsetDateTime.parse(completedAt));
        return t;
    }

    @Test
    void givesOnePointPerDay_oldestFirst_endingToday() {
        List<TaskActivityResponse> points = TaskActivity.lastDays(List.of(), TODAY, 7, UTC);

        assertThat(points).hasSize(7);
        assertThat(points.get(0).getDate()).isEqualTo(LocalDate.of(2026, 10, 8));
        assertThat(points.get(6).getDate()).isEqualTo(TODAY);
        assertThat(points).allSatisfy(p -> assertThat(p.getCreated() + p.getCompleted() + p.getOverdue()).isZero());
    }

    @Test
    void countsTasksCreatedAndCompletedOnEachDay_andIgnoresThoseOutsideTheWindow() {
        List<Task> tasks = List.of(
                task("TODO", null, "2026-10-14T09:00:00Z", null),
                task("COMPLETED", null, "2026-10-14T10:00:00Z", "2026-10-14T16:00:00Z"),
                task("COMPLETED", null, "2026-10-12T10:00:00Z", "2026-10-13T08:00:00Z"),
                task("COMPLETED", null, "2026-09-01T10:00:00Z", "2026-09-02T08:00:00Z"));

        List<TaskActivityResponse> points = TaskActivity.lastDays(tasks, TODAY, 7, UTC);

        assertThat(points.get(6).getCreated()).isEqualTo(2);   // 14 Oct
        assertThat(points.get(6).getCompleted()).isEqualTo(1);
        assertThat(points.get(4).getCreated()).isEqualTo(1);   // 12 Oct
        assertThat(points.get(5).getCompleted()).isEqualTo(1); // 13 Oct
        assertThat(points.stream().mapToLong(TaskActivityResponse::getCreated).sum()).isEqualTo(3); // September's is out
        assertThat(points.stream().mapToLong(TaskActivityResponse::getCompleted).sum()).isEqualTo(2);
    }

    @Test
    void aTimestampIsReadInTheCallersZone_soADayIsTheDayThePersonSees() {
        // 23:30 UTC on the 13th is already the 14th for someone at UTC+3
        List<Task> tasks = List.of(task("TODO", null, "2026-10-13T23:30:00Z", null));

        List<TaskActivityResponse> inUtc = TaskActivity.lastDays(tasks, TODAY, 3, UTC);
        List<TaskActivityResponse> inPhnomPenh = TaskActivity.lastDays(tasks, TODAY, 3, ZoneId.of("Asia/Phnom_Penh"));

        assertThat(inUtc.get(1).getCreated()).isEqualTo(1);        // 13 Oct
        assertThat(inUtc.get(2).getCreated()).isZero();
        assertThat(inPhnomPenh.get(1).getCreated()).isZero();
        assertThat(inPhnomPenh.get(2).getCreated()).isEqualTo(1);  // 14 Oct
    }

    @Test
    void overdueCountsTasksOpenNowThatWereDueBeforeEachDay() {
        List<Task> tasks = List.of(
                task("IN_PROGRESS", LocalDate.of(2026, 10, 10), null, null), // due the 10th, open
                task("TODO", LocalDate.of(2026, 10, 13), null, null),        // due the 13th, open
                task("COMPLETED", LocalDate.of(2026, 10, 1), null, null),    // finished: never overdue
                task("CANCELLED", LocalDate.of(2026, 10, 1), null, null),    // cancelled: never overdue
                task("TODO", null, null, null));                              // no due date

        List<TaskActivityResponse> points = TaskActivity.lastDays(tasks, TODAY, 7, UTC); // 8 to 14 Oct

        assertThat(points).extracting(TaskActivityResponse::getOverdue).containsExactly(0L, 0L, 0L, 1L, 1L, 1L, 2L);
    }

    @Test
    void aWindowOutsideOneToATreehundredAndSixtySixDaysIsRefused() {
        assertThatThrownBy(() -> TaskActivity.lastDays(List.of(), TODAY, 0, UTC)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> TaskActivity.lastDays(List.of(), TODAY, 367, UTC)).isInstanceOf(IllegalArgumentException.class);
        assertThat(TaskActivity.lastDays(List.of(), TODAY, 366, UTC)).hasSize(366);
        assertThat(TaskActivity.lastDays(List.of(), TODAY, 1, UTC)).hasSize(1);
    }
}
