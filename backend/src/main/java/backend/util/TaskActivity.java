package backend.util;

import backend.dto.TaskActivityResponse;
import backend.entity.Task;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

// The daily figures behind the dashboard's activity chart: for each of the last N days, how many tasks
// were created and completed that day (read in the caller's time zone, so a day is the day the person
// sees), and how many tasks that are open now were due before that day. The same calculation the
// browser used to do over every task, now done where the tasks are.
public final class TaskActivity {

    public static final int MAX_DAYS = 366;

    private TaskActivity() {
    }

    // Oldest day first, ending with `today`. days is 1 to MAX_DAYS.
    public static List<TaskActivityResponse> lastDays(List<Task> tasks, LocalDate today, int days, ZoneId zone) {
        if (days < 1 || days > MAX_DAYS) {
            throw new IllegalArgumentException("Invalid days: " + days + " (1 to " + MAX_DAYS + ")");
        }
        LocalDate first = today.minusDays(days - 1L);
        long[] created = new long[days];
        long[] completed = new long[days];
        for (Task t : tasks) {
            if (t.getCreatedAt() != null) {
                count(created, first, t.getCreatedAt().atZoneSameInstant(zone).toLocalDate());
            }
            if (t.getCompletedAt() != null) {
                count(completed, first, t.getCompletedAt().atZoneSameInstant(zone).toLocalDate());
            }
        }
        List<TaskActivityResponse> points = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate date = first.plusDays(i);
            // open now and due before this day (Derived.isTaskOverdue as if today were `date`)
            long overdue = tasks.stream().filter(t -> Derived.isTaskOverdue(t.getStatus(), t.getDueDate(), date)).count();
            points.add(new TaskActivityResponse(date, created[i], completed[i], overdue));
        }
        return points;
    }

    private static void count(long[] perDay, LocalDate first, LocalDate day) {
        long index = java.time.temporal.ChronoUnit.DAYS.between(first, day);
        if (index >= 0 && index < perDay.length) {
            perDay[(int) index]++;
        }
    }
}
