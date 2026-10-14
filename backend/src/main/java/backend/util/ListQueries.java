package backend.util;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

// Helpers shared by ProjectListQuery and TaskListQuery.
final class ListQueries {

    private ListQueries() {
    }

    // The values of a multi-value filter, each checked against the allowed ones (400 otherwise).
    static List<String> checked(String name, List<String> values, Set<String> allowed) {
        if (values == null) {
            return List.of();
        }
        for (String value : values) {
            if (!allowed.contains(value)) {
                throw new IllegalArgumentException("Invalid " + name + ": " + value);
            }
        }
        return values;
    }

    // A blank sort means "keep the current order".
    static String checkedSort(String sort, Set<String> allowed) {
        if (sort == null || sort.isBlank()) {
            return null;
        }
        if (!allowed.contains(sort)) {
            throw new IllegalArgumentException("Invalid sort: " + sort);
        }
        return sort;
    }

    // "IN_PROGRESS" -> "in progress", the way the screens write it.
    static String humanize(String enumValue) {
        return enumValue == null ? null : enumValue.replace('_', ' ').toLowerCase(Locale.ROOT);
    }

    // The searchable text of a record: its non-null parts, lower-cased and joined.
    static String text(Object... parts) {
        return Arrays.stream(parts)
                .filter(part -> part != null)
                .map(Object::toString)
                .collect(Collectors.joining(" "))
                .toLowerCase(Locale.ROOT);
    }
}
