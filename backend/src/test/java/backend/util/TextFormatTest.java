package backend.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TextFormatTest {

    @Test
    void humanizeEnum_turnsStoredStatusesIntoLabels() {
        assertThat(TextFormat.humanizeEnum("IN_PROGRESS")).isEqualTo("In Progress");
        assertThat(TextFormat.humanizeEnum("IN_REVIEW")).isEqualTo("In Review");
        assertThat(TextFormat.humanizeEnum("COMPLETED")).isEqualTo("Completed");
    }

    @Test
    void humanizeEnum_labelsTheStoredTodoStatusAsTwoWords() {
        assertThat(TextFormat.humanizeEnum("TODO")).isEqualTo("To Do");
    }

    @Test
    void humanizeEnum_toleratesNullAndBlank() {
        assertThat(TextFormat.humanizeEnum(null)).isEmpty();
        assertThat(TextFormat.humanizeEnum("  ")).isEmpty();
    }
}
