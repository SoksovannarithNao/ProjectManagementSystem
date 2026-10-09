package backend.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

// "Delayed" and "overdue" are calculated, never stored (assignment-brief.md B1.3).
class DerivedTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 11);

    @Test
    void aProjectIsDelayed_theDayAfterItsEndDate_unlessFinished() {
        assertThat(Derived.isProjectDelayed("IN_PROGRESS", LocalDate.of(2026, 10, 10), TODAY)).isTrue();
        assertThat(Derived.isProjectDelayed("PLANNING", LocalDate.of(2026, 10, 10), TODAY)).isTrue();
        assertThat(Derived.isProjectDelayed("ON_HOLD", LocalDate.of(2026, 10, 10), TODAY)).isTrue();
        assertThat(Derived.isProjectDelayed("COMPLETED", LocalDate.of(2026, 10, 10), TODAY)).isFalse();
        assertThat(Derived.isProjectDelayed("CANCELLED", LocalDate.of(2026, 10, 10), TODAY)).isFalse();
    }

    @Test
    void aProjectEndingTodayIsNotDelayedYet() {
        assertThat(Derived.isProjectDelayed("IN_PROGRESS", TODAY, TODAY)).isFalse();
        assertThat(Derived.isProjectDelayed("IN_PROGRESS", TODAY.plusDays(1), TODAY)).isFalse();
        assertThat(Derived.isProjectDelayed("IN_PROGRESS", null, TODAY)).isFalse();
    }

    @Test
    void aTaskIsOverdueTheDayAfterItsDueDate_unlessFinished() {
        assertThat(Derived.isTaskOverdue("TODO", LocalDate.of(2026, 10, 10), TODAY)).isTrue();
        assertThat(Derived.isTaskOverdue("IN_REVIEW", LocalDate.of(2026, 10, 10), TODAY)).isTrue();
        assertThat(Derived.isTaskOverdue("COMPLETED", LocalDate.of(2026, 10, 10), TODAY)).isFalse();
        assertThat(Derived.isTaskOverdue("CANCELLED", LocalDate.of(2026, 10, 10), TODAY)).isFalse();
        assertThat(Derived.isTaskOverdue("TODO", TODAY, TODAY)).isFalse();
    }

    @Test
    void daysLateCountsCalendarDays_andIsZeroBeforeTheDate() {
        assertThat(Derived.daysLate(LocalDate.of(2026, 10, 1), TODAY)).isEqualTo(10);
        assertThat(Derived.daysLate(TODAY, TODAY)).isZero();
        assertThat(Derived.daysLate(TODAY.plusDays(3), TODAY)).isZero();
        assertThat(Derived.daysLate(null, TODAY)).isZero();
    }
}
