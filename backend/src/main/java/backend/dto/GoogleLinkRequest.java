package backend.dto;

import jakarta.validation.constraints.NotBlank;

// Connecting a Google account to the signed-in account: the Google ID token plus the account's current
// password, so a stolen access token alone cannot attach someone else's Google account.
public record GoogleLinkRequest(@NotBlank String credential, @NotBlank String currentPassword) {
}
