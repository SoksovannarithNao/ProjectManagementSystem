package backend.dto;

// The answer to a correct password when a second step is still needed (an administrator's sign-in
// code was e-mailed). Deliberately carries no token: the session starts only after POST
// /api/auth/login/verify. The e-mail is masked (a***@gmail.com) so the page can say where to look.
public record TwoFactorRequiredResponse(boolean twoFactorRequired, String username, String maskedEmail) {
}
