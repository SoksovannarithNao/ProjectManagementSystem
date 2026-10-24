package backend.dto;

import jakarta.validation.constraints.NotBlank;

// The ID token ("credential") Google gave the browser after the person chose their Google account.
public record GoogleLoginRequest(@NotBlank String credential) {
}
