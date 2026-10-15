package backend.service;

import backend.entity.User;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

// Deletes registrations that were never verified (issue I-14): a person who registered but did not
// enter the e-mailed code kept their username and e-mail reserved for ever. Such an account is
// PENDING_VERIFICATION, cannot sign in and has done nothing, so removing it loses nothing; its
// verification codes go with it (ON DELETE CASCADE) and the name is free again. Verified accounts
// and every other status are never touched.
@Service
@Transactional
public class PendingRegistrationCleanup {

    private final UserRepository userRepository;

    public PendingRegistrationCleanup(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // Deletes the unverified registrations created more than `maxAge` before `now`; returns how many.
    public int deleteOlderThan(Duration maxAge, OffsetDateTime now) {
        List<User> expired = userRepository.findByAccountStatusAndCreatedAtBefore("PENDING_VERIFICATION", now.minus(maxAge));
        userRepository.deleteAll(expired);
        return expired.size();
    }
}
