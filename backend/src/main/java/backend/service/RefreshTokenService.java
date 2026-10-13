package backend.service;

import backend.entity.RefreshToken;
import backend.entity.User;
import backend.exception.SessionExpiredException;
import backend.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;

// The long-lived half of the sign-in session (checklist risk R-4). The browser holds a random
// token in an httpOnly cookie and trades it for a new short-lived access token; the database
// keeps only the token's SHA-256 hash. The token is not rotated on use (two tabs refreshing at
// once would otherwise invalidate each other) and ends at its fixed expiry, on sign-out, when
// the password is changed or reset, or when the account stops being ACTIVE.
@Service
@Transactional
public class RefreshTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final long lifetimeMs;

    public RefreshTokenService(
            RefreshTokenRepository refreshTokenRepository,
            @Value("${app.refresh.expiration-ms}") long lifetimeMs) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.lifetimeMs = lifetimeMs;
    }

    public long getLifetimeMs() {
        return lifetimeMs;
    }

    // Starts a session: stores the hash and returns the raw token for the cookie.
    public String issue(User user) {
        // Expired rows are only ever cleaned up here, which keeps the table small without a job.
        refreshTokenRepository.deleteExpired(OffsetDateTime.now());

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash(raw));
        token.setExpiresAt(OffsetDateTime.now().plusNanos(lifetimeMs * 1_000_000L));
        refreshTokenRepository.save(token);
        return raw;
    }

    // The account behind a refresh token that is still valid; anything else is a 401.
    @Transactional(readOnly = true)
    public User validate(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new SessionExpiredException("Session expired");
        }
        RefreshToken token = refreshTokenRepository.findByTokenHash(hash(raw))
                .orElseThrow(() -> new SessionExpiredException("Session expired"));
        if (token.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new SessionExpiredException("Session expired");
        }
        if (!"ACTIVE".equals(token.getUser().getAccountStatus())) {
            throw new SessionExpiredException("Session expired");
        }
        return token.getUser();
    }

    // Sign-out: ends this one session. Unknown or missing tokens are ignored.
    public void revoke(String raw) {
        if (raw != null && !raw.isBlank()) {
            refreshTokenRepository.deleteByTokenHash(hash(raw));
        }
    }

    // A changed or reset password ends every session of the account.
    public void revokeAll(Long userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }

    static String hash(String raw) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
