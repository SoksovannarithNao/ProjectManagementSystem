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

    // Delayed (project): the end date has passed and the project is neither Completed nor Cancelled.
    public static boolean isProjectDelayed(String status, LocalDate endDate, LocalDate today) {
        return endDate != null && endDate.isBefore(today) && !finished(status);
    }

    // Days past the date, 0 when it has not passed.
    public static long daysLate(LocalDate date, LocalDate today) {
        return date == null || !date.isBefore(today) ? 0 : ChronoUnit.DAYS.between(date, today);
    }
}
