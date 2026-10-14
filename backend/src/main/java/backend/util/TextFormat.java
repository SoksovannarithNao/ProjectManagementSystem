package backend.util;

public final class TextFormat {

    private TextFormat() {
    }

    // One line of at most `max` characters, ending in an ellipsis when it was cut:
    // for previews of long text in notifications.
    public static String shorten(String text, int max) {
        if (text == null) return "";
        String oneLine = text.replaceAll("\\s+", " ").trim();
        return oneLine.length() <= max ? oneLine : oneLine.substring(0, max - 1) + "…";
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
