package backend.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// Warns (does not fail startup — there's no profile system or real deploy
// target yet, so failing fast here would just break local dev/CI) if
// app.jwt.secret is still the fallback baked into application.properties,
// so an accidental deployment without JWT_SECRET set is loud, not silent.
@Component
public class JwtSecretGuard {

    private static final Logger log = LoggerFactory.getLogger(JwtSecretGuard.class);

    static final String DEFAULT_SECRET =
            "change-this-development-secret-key-change-this-development-secret-key";

    private final String configuredSecret;

    public JwtSecretGuard(@Value("${app.jwt.secret}") String configuredSecret) {
        this.configuredSecret = configuredSecret;
    }

    @PostConstruct
    void warnIfDefaultSecret() {
        if (DEFAULT_SECRET.equals(configuredSecret)) {
            log.warn("app.jwt.secret is still the built-in development default. "
                    + "Set the JWT_SECRET environment variable to a unique, random "
                    + "value before running this anywhere other than local dev — "
                    + "all existing JWTs are invalidated when the secret changes.");
        }
    }
}
