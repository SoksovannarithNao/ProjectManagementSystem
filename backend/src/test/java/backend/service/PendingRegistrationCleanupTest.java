package backend.service;

import backend.entity.User;
import backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Registrations nobody verified are removed after a while, so their username and e-mail are free
// again (issue I-14); nothing else is ever deleted.
@ExtendWith(MockitoExtension.class)
class PendingRegistrationCleanupTest {

    @Mock
    private UserRepository userRepository;

    private final OffsetDateTime now = OffsetDateTime.parse("2026-10-14T12:00:00Z");

    @Test
    void deletesUnverifiedRegistrationsOlderThanTheLimit_andCountsThem() {
        User a = new User();
        User b = new User();
        PendingRegistrationCleanup cleanup = new PendingRegistrationCleanup(userRepository);
        when(userRepository.findByAccountStatusAndCreatedAtBefore(eq("PENDING_VERIFICATION"), eq(now.minusHours(24))))
                .thenReturn(List.of(a, b));

        int deleted = cleanup.deleteOlderThan(Duration.ofHours(24), now);

        assertThat(deleted).isEqualTo(2);
        ArgumentCaptor<Iterable<User>> removed = ArgumentCaptor.forClass(Iterable.class);
        verify(userRepository).deleteAll(removed.capture());
        assertThat(removed.getValue()).containsExactly(a, b);
    }

    @Test
    void onlyPendingVerificationAccountsAreEverLookedFor() {
        PendingRegistrationCleanup cleanup = new PendingRegistrationCleanup(userRepository);
        when(userRepository.findByAccountStatusAndCreatedAtBefore(eq("PENDING_VERIFICATION"), eq(now.minusHours(1))))
                .thenReturn(List.of());

        assertThat(cleanup.deleteOlderThan(Duration.ofHours(1), now)).isZero();

        verify(userRepository).findByAccountStatusAndCreatedAtBefore("PENDING_VERIFICATION", now.minusHours(1));
        verify(userRepository, never()).delete(org.mockito.ArgumentMatchers.any());
    }
}
