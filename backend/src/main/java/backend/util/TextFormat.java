package backend.util;

public final class TextFormat {

    private TextFormat() {
    }

    // "IN_PROGRESS" -> "In Progress". Used for human-readable activity-log
    // descriptions (see ActivityLogService callers) — NotificationService has
    // its own private copy of this same logic for the same reason.
    public static String humanizeEnum(String value) {
        if (value == null || value.isBlank()) return "";
        StringBuilder result = new StringBuilder();
        for (String word : value.toLowerCase().split("_")) {
            if (word.isEmpty()) continue;
            if (!result.isEmpty()) result.append(' ');
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }
}
