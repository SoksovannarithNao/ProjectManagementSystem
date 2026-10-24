package backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

// Setting the first password of an account that Google created: instead of a current password (it has none the
// person knows) the person proves who they are with a fresh Google ID token for the connected Google account.
public record GoogleSetPasswordRequest(
        @NotBlank String credential,
        @NotBlank @Pattern(regexp = PasswordPolicy.REGEX, message = PasswordPolicy.MESSAGE) String newPassword,
        @NotBlank String confirmNewPassword) {
}
