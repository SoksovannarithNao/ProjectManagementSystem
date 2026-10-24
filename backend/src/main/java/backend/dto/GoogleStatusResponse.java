package backend.dto;

// Whether "Sign in with Google" exists on this server and whether the signed-in account has a Google
// account connected (email is the Google address, shown only so the person can tell which one).
public record GoogleStatusResponse(boolean enabled, boolean linked, String email) {
}
