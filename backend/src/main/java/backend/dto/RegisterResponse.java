package backend.dto;

// Deliberately carries no token/role — the account is PENDING_VERIFICATION
// until the OTP is verified, so there's nothing to authenticate yet.
public class RegisterResponse {

    private final String username;
    private final String email;
    private final String message;

    public RegisterResponse(String username, String email, String message) {
        this.username = username;
        this.email = email;
        this.message = message;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getMessage() {
        return message;
    }
}
