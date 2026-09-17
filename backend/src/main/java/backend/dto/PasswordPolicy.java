package backend.dto;

// Shared password-complexity rule, applied everywhere a password is ever
// set (registration, self password-change, and admin create/update) so
// there's exactly one policy in the app rather than a stricter one for
// registration and a looser one elsewhere. Requires: 8+ characters, at
// least one lowercase, one uppercase, one digit, and one special character.
public final class PasswordPolicy {

    public static final String REGEX =
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$";

    public static final String MESSAGE =
            "Password must be at least 8 characters and include an uppercase letter, "
                    + "a lowercase letter, a number, and a special character";

    private PasswordPolicy() {
    }
}
