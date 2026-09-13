package backend.service;

import backend.exception.TooManyRequestsException;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

// In-memory login attempt limiter, keyed by "remoteAddr:username" rather than
// username alone (so an attacker can't lock a known victim out of their own
// account by deliberately failing logins under that username from elsewhere)
// or IP alone (which would over-punish legitimate users sharing an IP with an
// attacker). Fine for a single-instance app with no distributed cache; would
// need a shared store (e.g. Redis) if the backend is ever scaled
// horizontally — resets on restart, not shared across instances.
@Component
public class LoginRateLimiter {

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final ConcurrentHashMap<String, Deque<Instant>> failuresByKey = new ConcurrentHashMap<>();

    public void assertNotLocked(String key) {
        Deque<Instant> failures = failuresByKey.get(key);
        if (failures == null) {
            return;
        }
        synchronized (failures) {
            purge(failures);
            if (failures.size() >= MAX_ATTEMPTS) {
                throw new TooManyRequestsException("Too many failed login attempts. Try again later.");
            }
        }
    }

    public void recordFailure(String key) {
        Deque<Instant> failures = failuresByKey.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (failures) {
            purge(failures);
            failures.addLast(Instant.now());
        }
    }

    public void recordSuccess(String key) {
        failuresByKey.remove(key);
    }

    private void purge(Deque<Instant> failures) {
        Instant cutoff = Instant.now().minus(WINDOW);
        while (!failures.isEmpty() && failures.peekFirst().isBefore(cutoff)) {
            failures.pollFirst();
        }
    }
}
