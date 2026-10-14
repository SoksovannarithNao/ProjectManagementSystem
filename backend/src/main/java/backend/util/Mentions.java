package backend.util;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// @mentions in a comment (change-plan G-14; mentions are UNDEFINED in the specification, so the
// rules are the ones the brief records as D-21). A mention is "@" followed by a username
// (letters, digits, dots, underscores and hyphens, as RegisterRequest allows), not glued to a
// preceding word or another "@" (so an e-mail address is not a mention). Sentence punctuation
// after the name ("@pm.olivia.", "@dev.chen,") is not part of it: the name before it is looked up
// among the project's active members; if it is not one of them, nothing is mentioned.
public final class Mentions {

    private static final Pattern MENTION = Pattern.compile("(?<![A-Za-z0-9._@-])@([A-Za-z0-9][A-Za-z0-9._-]{0,49})");

    private Mentions() {
    }

    // The usernames (as written in `members`) of the people mentioned in `text`, in the order
    // they first appear, each once. `members` maps lower-case username to the stored username.
    public static List<String> resolve(String text, Map<String, String> members) {
        if (text == null || text.isBlank() || members.isEmpty()) {
            return List.of();
        }
        Set<String> found = new LinkedHashSet<>();
        Matcher matcher = MENTION.matcher(text);
        while (matcher.find()) {
            String candidate = matcher.group(1).toLowerCase(Locale.ROOT);
            while (!candidate.isEmpty()) {
                String username = members.get(candidate);
                if (username != null) {
                    found.add(username);
                    break;
                }
                candidate = stripLastPunctuation(candidate);
            }
        }
        return new ArrayList<>(found);
    }

    // Convenience for a collection of stored usernames.
    public static Map<String, String> byLowerCase(Collection<String> usernames) {
        Map<String, String> map = new java.util.LinkedHashMap<>();
        for (String username : usernames) {
            map.put(username.toLowerCase(Locale.ROOT), username);
        }
        return map;
    }

    // "dev.chen." -> "dev.chen": only trailing punctuation is peeled, never part of a name, so
    // "@dev.chenx" is not read as a mention of "dev".
    private static String stripLastPunctuation(String candidate) {
        int end = candidate.length();
        while (end > 0 && isSeparator(candidate.charAt(end - 1))) {
            end--;
        }
        return end < candidate.length() ? candidate.substring(0, end) : "";
    }

    private static boolean isSeparator(char c) {
        return c == '.' || c == '_' || c == '-';
    }
}
