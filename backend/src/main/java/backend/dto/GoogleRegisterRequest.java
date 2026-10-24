package backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// Creating an account from a Google sign-in (ADR-0018): the Google ID token and the username the person chose,
// under the same rules as a self-registration (RegisterRequest).
public record GoogleRegisterRequest(
        @NotBlank String credential,
        @NotBlank
        @Size(min = 3, max = 50)
        @Pattern(regexp = "[A-Za-z0-9._-]+", message = "Username may only contain letters, numbers, dots, underscores, and hyphens")
        String username) {
}
