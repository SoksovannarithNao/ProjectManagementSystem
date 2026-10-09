package backend.util;

public final class TextFormat {

    private TextFormat() {
    }

    // "IN_PROGRESS" -> "In Progress". Used for human-readable activity-log
    // descriptions (see ActivityLogService callers) and notification text.
    // "TODO" is one word in storage but two in the label: "To Do".
    public static String humanizeEnum(String value) {
        if (value == null || value.isBlank()) return "";
        if ("TODO".equalsIgnoreCase(value)) return "To Do";
        StringBuilder result = new StringBuilder();
        for (String word : value.toLowerCase().split("_")) {
            if (word.isEmpty()) continue;
            if (!result.isEmpty()) result.append(' ');
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }
}
