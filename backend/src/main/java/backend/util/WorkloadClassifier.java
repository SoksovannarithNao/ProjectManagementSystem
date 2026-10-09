package backend.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

// "Too much / too little work" is judged against the team, not against fixed
// numbers (assignment-brief.md D-13). A member's load is two figures: their open
// tasks (active plus overdue) and the estimated hours of the work not yet done.
//
//   OVERLOADED  open tasks or estimated hours are clearly above the team average;
//   UNDERLOADED open tasks are clearly below the average and the estimated hours
//               are not above it;
//   BALANCED    everything else - and always when there is only one person, or
//               nobody has any work, because there is nothing to compare with.
//
// "Clearly" is a margin that is tuned here in one place: more than 1.5 times the
// average (overloaded) or less than half of it (underloaded), and also at least
// one task / four hours away from the average, so that tiny teams with tiny
// numbers do not flip between labels over a single task.
public final class WorkloadClassifier {

    public static final String OVERLOADED = "OVERLOADED";
    public static final String UNDERLOADED = "UNDERLOADED";
    public static final String BALANCED = "BALANCED";

    static final double HIGH = 1.5;
    static final double LOW = 0.5;
    static final double MIN_TASK_GAP = 1.0;
    static final double MIN_HOUR_GAP = 4.0;

    private WorkloadClassifier() {
    }

    public record Load(long openTasks, BigDecimal estimatedHours) {
    }

    public record Averages(BigDecimal openTasks, BigDecimal estimatedHours) {
    }

    public static Averages averages(List<Load> loads) {
        if (loads.isEmpty()) {
            return new Averages(BigDecimal.ZERO, BigDecimal.ZERO);
        }
        BigDecimal count = BigDecimal.valueOf(loads.size());
        BigDecimal tasks = loads.stream().map(l -> BigDecimal.valueOf(l.openTasks())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal hours = loads.stream().map(Load::estimatedHours).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Averages(tasks.divide(count, 2, RoundingMode.HALF_UP), hours.divide(count, 2, RoundingMode.HALF_UP));
    }

    // One level per load, in the same order.
    public static List<String> classify(List<Load> loads) {
        List<String> levels = new ArrayList<>();
        boolean comparable = loads.size() >= 2;
        // The exact averages, not the rounded ones shown on screen, decide the labels.
        double avgTasks = loads.stream().mapToLong(Load::openTasks).average().orElse(0);
        double avgHours = loads.stream().mapToDouble(l -> l.estimatedHours().doubleValue()).average().orElse(0);
        for (Load load : loads) {
            levels.add(comparable ? level(load.openTasks(), load.estimatedHours().doubleValue(), avgTasks, avgHours) : BALANCED);
        }
        return levels;
    }

    private static String level(double tasks, double hours, double avgTasks, double avgHours) {
        boolean manyTasks = avgTasks > 0 && tasks > avgTasks * HIGH && tasks - avgTasks >= MIN_TASK_GAP;
        boolean manyHours = avgHours > 0 && hours > avgHours * HIGH && hours - avgHours >= MIN_HOUR_GAP;
        if (manyTasks || manyHours) {
            return OVERLOADED;
        }
        boolean fewTasks = avgTasks > 0 && tasks < avgTasks * LOW && avgTasks - tasks >= MIN_TASK_GAP;
        boolean hoursNotAbove = hours <= avgHours;
        if (fewTasks && hoursNotAbove) {
            return UNDERLOADED;
        }
        return BALANCED;
    }
}
