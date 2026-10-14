package backend.util;

import backend.util.WorkloadClassifier.Load;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static backend.util.WorkloadClassifier.BALANCED;
import static backend.util.WorkloadClassifier.OVERLOADED;
import static backend.util.WorkloadClassifier.UNDERLOADED;
import static org.assertj.core.api.Assertions.assertThat;

// D-13: overloaded / underloaded is judged against the team average, not fixed numbers.
class WorkloadClassifierTest {

    private static Load load(long openTasks, double hours) {
        return new Load(openTasks, BigDecimal.valueOf(hours));
    }

    @Test
    void aMemberWithClearlyMoreOpenTasksThanTheTeamAverage_isOverloaded() {
        // average 3.33: 6 is more than 1.5x (5) and 2.67 tasks above it
        List<String> levels = WorkloadClassifier.classify(List.of(load(6, 0), load(2, 0), load(2, 0)));

        assertThat(levels).containsExactly(OVERLOADED, BALANCED, BALANCED);
    }

    @Test
    void aMemberWithClearlyMoreEstimatedHours_isOverloaded_evenWithFewTasks() {
        // hours average 20: 50 is more than 1.5x and 30 hours above
        List<String> levels = WorkloadClassifier.classify(List.of(load(1, 50), load(1, 5), load(1, 5)));

        assertThat(levels.get(0)).isEqualTo(OVERLOADED);
    }

    @Test
    void aMemberWithClearlyFewerOpenTasks_andNoMoreHours_isUnderloaded() {
        // average 4: 0 is under half of it and 4 tasks below
        List<String> levels = WorkloadClassifier.classify(List.of(load(8, 20), load(8, 20), load(0, 0)));

        assertThat(levels).containsExactly(BALANCED, BALANCED, UNDERLOADED);
    }

    @Test
    void fewTasksButManyHours_isNotUnderloaded() {
        List<String> levels = WorkloadClassifier.classify(List.of(load(8, 10), load(8, 10), load(0, 40)));

        assertThat(levels.get(2)).isNotEqualTo(UNDERLOADED);
    }

    @Test
    void noOneIsCompared_whenThereIsOnlyOnePerson() {
        assertThat(WorkloadClassifier.classify(List.of(load(9, 90)))).containsExactly(BALANCED);
        assertThat(WorkloadClassifier.classify(List.of())).isEmpty();
    }

    @Test
    void whenNobodyHasWork_everyoneIsBalanced() {
        assertThat(WorkloadClassifier.classify(List.of(load(0, 0), load(0, 0), load(0, 0))))
                .containsExactly(BALANCED, BALANCED, BALANCED);
    }

    @Test
    void aGapOfASingleTask_isNotEnoughToChangeTheLabel() {
        // average 0.5: 1 task is 2x the average but only half a task above it
        assertThat(WorkloadClassifier.classify(List.of(load(1, 0), load(0, 0)))).containsExactly(BALANCED, BALANCED);
    }

    @Test
    void theAveragesAreOverEveryoneListed() {
        WorkloadClassifier.Averages avg = WorkloadClassifier.averages(List.of(load(4, 10), load(2, 6), load(0, 2)));

        assertThat(avg.openTasks()).isEqualByComparingTo("2.00");
        assertThat(avg.estimatedHours()).isEqualByComparingTo("6.00");
        assertThat(WorkloadClassifier.averages(List.of()).openTasks()).isEqualByComparingTo("0");
    }
}
