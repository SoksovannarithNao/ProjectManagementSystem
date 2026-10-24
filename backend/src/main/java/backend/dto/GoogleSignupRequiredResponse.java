package backend.dto;

// The answer to a Google sign-in whose Google account is not connected to any TaskFlow account, when an account
// could be created from it: the sign-in page then asks for a username. Carries no token or cookie. The e-mail is
// the address Google vouches for and the name is the one on the Google account (a suggestion, may be null).
public record GoogleSignupRequiredResponse(boolean signupRequired, String email, String name) {
}
