package backend.service;

import backend.exception.NotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.util.List;

// Checks the ID token that Google hands the browser ("Sign in with Google") before anything in it is
// believed: the signature against Google's public keys (fetched from Google and cached by Spring's
// decoder), that it has not expired, that it was issued by Google, and that it was issued for THIS
// application's OAuth client (the audience), so a token Google made for some other app is refused.
// What comes out is Google's stable account id (sub) and, when Google vouches for it, the e-mail
// address, which is never used to find an account (it only fills in a new account), and the display name. Switched off by a blank client ID.
@Component
public class GoogleTokenVerifier {

    private static final String JWK_SET_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final List<String> ISSUERS = List.of("https://accounts.google.com", "accounts.google.com");

    static final String INVALID_TOKEN_MESSAGE = "Google sign-in could not be verified. Please try again.";

    // name is the display name on the Google account (a suggestion for a new account's full name), may be null.
    public record GoogleAccount(String subject, String email, String name) {
    }

    private final String clientId;
    private final NimbusJwtDecoder decoder;

    @Autowired
    public GoogleTokenVerifier(@Value("${app.auth.google.client-id}") String clientId) {
        this(clientId, isSet(clientId) ? NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI).build() : null);
    }

    GoogleTokenVerifier(String clientId, NimbusJwtDecoder decoder) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.decoder = decoder;
        if (decoder != null) {
            decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                    JwtValidators.createDefault(), issuedByGoogle(), issuedForThisApp()));
        }
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

    public boolean isEnabled() {
        return decoder != null;
    }

    // The public OAuth client ID the browser needs, or null when the feature is off.
    public String clientId() {
        return isEnabled() ? clientId : null;
    }

    // Throws NotFoundException when the feature is off, IllegalArgumentException (a 400 with a
    // client-facing message) for any token that is not good, whatever the reason.
    public GoogleAccount verify(String credential) {
        if (!isEnabled()) {
            throw new NotFoundException("Google sign-in is not available");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(credential);
        } catch (JwtException ex) {
            throw new IllegalArgumentException(INVALID_TOKEN_MESSAGE);
        }
        if (jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new IllegalArgumentException(INVALID_TOKEN_MESSAGE);
        }
        String email = Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")) ? jwt.getClaimAsString("email") : null;
        return new GoogleAccount(jwt.getSubject(), email, jwt.getClaimAsString("name"));
    }

    private static OAuth2TokenValidator<Jwt> issuedByGoogle() {
        return jwt -> ISSUERS.contains(String.valueOf(jwt.getClaims().get("iss")))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Not issued by Google", null));
    }

    private OAuth2TokenValidator<Jwt> issuedForThisApp() {
        return jwt -> jwt.getAudience() != null && jwt.getAudience().contains(clientId)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Issued for another application", null));
    }
}
