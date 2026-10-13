package backend.service;

import backend.entity.RefreshToken;
import backend.entity.User;
import backend.exception.SessionExpiredException;
import backend.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The refresh token behind the sign-in session (checklist risk R-4): what is stored, and when a
// cookie stops leading to a session.
@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    private static final long WEEK_MS = 7L * 24 * 60 * 60 * 1000;

    @Mock
    private RefreshTokenRepository repository;

    private RefreshTokenService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(repository, WEEK_MS);
        user = new User();
        user.setUsername("dev.chen");
        user.setAccountStatus("ACTIVE");
    }

    private RefreshToken stored(String raw, OffsetDateTime expiresAt, User owner) {
        RefreshToken token = new RefreshToken();
        token.setUser(owner);
        token.setTokenHash(RefreshTokenService.hash(raw));
        token.setExpiresAt(expiresAt);
        return token;
    }

    @Test
    void issueStoresOnlyTheHashOfAnUnguessableToken() {
        String first = service.issue(user);
        String second = service.issue(user);

        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repository, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(first).isNotEqualTo(second).hasSizeGreaterThanOrEqualTo(43); // 32 random bytes, base64url
        RefreshToken row = saved.getAllValues().get(0);
        assertThat(row.getTokenHash()).isEqualTo(RefreshTokenService.hash(first)).hasSize(64).isNotEqualTo(first);
        assertThat(row.getUser()).isSameAs(user);
        assertThat(row.getExpiresAt()).isBetween(OffsetDateTime.now().plusDays(6), OffsetDateTime.now().plusDays(8));
    }

    @Test
    void issueClearsExpiredRowsSoTheTableStaysSmall() {
        service.issue(user);

        verify(repository).deleteExpired(any(OffsetDateTime.class));
    }

    @Test
    void aLiveTokenOfAnActiveAccountGivesTheAccountBack() {
        when(repository.findByTokenHash(RefreshTokenService.hash("raw")))
                .thenReturn(Optional.of(stored("raw", OffsetDateTime.now().plusDays(1), user)));

        assertThat(service.validate("raw")).isSameAs(user);
    }

    @Test
    void missingBlankAndUnknownTokensAreSessionExpired() {
        when(repository.findByTokenHash(RefreshTokenService.hash("unknown"))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.validate(null)).isInstanceOf(SessionExpiredException.class);
        assertThatThrownBy(() -> service.validate("  ")).isInstanceOf(SessionExpiredException.class);
        assertThatThrownBy(() -> service.validate("unknown")).isInstanceOf(SessionExpiredException.class);
    }

    @Test
    void anExpiredTokenIsSessionExpired() {
        when(repository.findByTokenHash(RefreshTokenService.hash("old")))
                .thenReturn(Optional.of(stored("old", OffsetDateTime.now().minusMinutes(1), user)));

        assertThatThrownBy(() -> service.validate("old")).isInstanceOf(SessionExpiredException.class);
    }

    @Test
    void aSuspendedOrDeactivatedAccountCannotRefresh() {
        for (String status : new String[] {"SUSPENDED", "INACTIVE", "PENDING_VERIFICATION"}) {
            User other = new User();
            other.setAccountStatus(status);
            when(repository.findByTokenHash(RefreshTokenService.hash("t-" + status)))
                    .thenReturn(Optional.of(stored("t-" + status, OffsetDateTime.now().plusDays(1), other)));

            assertThatThrownBy(() -> service.validate("t-" + status))
                    .as(status).isInstanceOf(SessionExpiredException.class);
        }
    }

    @Test
    void revokeDeletesThatOneSessionAndIgnoresAMissingToken() {
        service.revoke("raw");
        service.revoke(null);
        service.revoke(" ");

        verify(repository).deleteByTokenHash(RefreshTokenService.hash("raw"));
        verify(repository, never()).deleteByTokenHash(RefreshTokenService.hash(""));
    }

    @Test
    void revokeAllDeletesEverySessionOfTheAccount() {
        service.revokeAll(9L);

        verify(repository).deleteByUserId(9L);
    }
}
