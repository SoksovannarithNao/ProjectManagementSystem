package backend.dto;

// What the sign-in page needs to show the Google button: the public OAuth client ID, or null when
// "Sign in with Google" is switched off on this server.
public record GoogleConfigResponse(String clientId) {
}
