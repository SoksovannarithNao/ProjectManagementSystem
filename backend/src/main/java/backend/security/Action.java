package backend.security;

import java.util.Arrays;
import java.util.Optional;

// The 7 permission types named in Role_Requirment.md ("Available actions").
// The enum names equal permissions.code in the database.
public enum Action {
    VIEW("view"),
    CREATE("create"),
    EDIT("edit"),
    DELETE("delete"),
    ASSIGN("assign"),
    APPROVE("approve"),
    GENERATE_REPORTS("generate");

    private final String verb;

    Action(String verb) {
        this.verb = verb;
    }

    // Used in 403 messages: "You do not have permission to create tasks in this project".
    public String verb() {
        return verb;
    }

    public static Optional<Action> parse(String value) {
        return Arrays.stream(values()).filter(a -> a.name().equals(value)).findFirst();
    }
}
