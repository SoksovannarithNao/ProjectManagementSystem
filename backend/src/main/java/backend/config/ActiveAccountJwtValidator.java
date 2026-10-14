package backend.config;

import backend.repository.UserRepository;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

// A JWT is valid for its whole lifetime by signature and expiry alone, so
// without this an account that is deactivated or suspended AFTER logging in
// (or deleted) would keep working until its token expired — login checks the
// status, but nothing re-checked it per request. This runs as part of JWT
// decoding (see SecurityConfig.jwtDecoder): a token whose subject no longer
// exists or is not ACTIVE is rejected with a 401, exactly like an expired one.
public class ActiveAccountJwtValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error INACTIVE_ACCOUNT =
            new OAuth2Error("invalid_token", "The account is not active", null);

    private final UserRepository userRepository;

    public ActiveAccountJwtValidator(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        String status = userRepository.findAccountStatusByUsername(jwt.getSubject()).orElse(null);
        if ("ACTIVE".equals(status)) {
            return OAuth2TokenValidatorResult.success();
        }
        return OAuth2TokenValidatorResult.failure(INACTIVE_ACCOUNT);
    }
}
