package backend.util;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

// States that are calculated from dates and statuses and never stored
// (assignment-brief.md B1.3), so they can never contradict the data they come
// from. Dates are calendar dates: something due on the 10th is late from the 11th.
public final class Derived {

    private Derived() {
    }

    private static boolean finished(String status) {
        return "COMPLETED".equals(status) || "CANCELLED".equals(status);
    }

    // Overdue (task): the due date has passed and the task is neither Completed nor Cancelled.
    public static boolean isTaskOverdue(String status, LocalDate dueDate, LocalDate today) {
        return dueDate != null && dueDate.isBefore(today) && !finished(status);
    }

    // How many days ahead a still-open task counts as "near its deadline". It is the
    // first of the two reminder days (3 and 1), so the flag appears when the first
    // reminder is sent.
    public static final int DUE_SOON_DAYS = 3;

    // Due soon (task): not finished, not yet overdue, and due today or within the
    // next DUE_SOON_DAYS days (assignment-brief.md Part A: "Tasks Near Deadline").
    public static boolean isTaskDueSoon(String status, LocalDate dueDate, LocalDate today) {
        return dueDate != null
                && !dueDate.isBefore(today)
                && !dueDate.isAfter(today.plusDays(DUE_SOON_DAYS))
                && !finished(status);
    }

    // Delayed (project): the end date has passed and the project is neither Completed nor Cancelled.
    public static boolean isProjectDelayed(String status, LocalDate endDate, LocalDate today) {
        return endDate != null && endDate.isBefore(today) && !finished(status);
    }

    // Days past the date, 0 when it has not passed.
    public static long daysLate(LocalDate date, LocalDate today) {
        return date == null || !date.isBefore(today) ? 0 : ChronoUnit.DAYS.between(date, today);
    }
}
