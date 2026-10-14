package backend.config;

import backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActiveAccountJwtValidatorTest {

    @Mock
    private UserRepository userRepository;

    private Jwt tokenFor(String username) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS512")
                .subject(username)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private OAuth2TokenValidatorResult validate(String username) {
        return new ActiveAccountJwtValidator(userRepository).validate(tokenFor(username));
    }

    @Test
    void activeAccount_isAccepted() {
        when(userRepository.findAccountStatusByUsername("dev.chen")).thenReturn(Optional.of("ACTIVE"));

        assertThat(validate("dev.chen").hasErrors()).isFalse();
    }

    @Test
    void suspendedAccount_isRejectedEvenWithAValidToken() {
        when(userRepository.findAccountStatusByUsername("dev.chen")).thenReturn(Optional.of("SUSPENDED"));

        OAuth2TokenValidatorResult result = validate("dev.chen");

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.getErrors()).extracting(e -> e.getErrorCode()).containsExactly("invalid_token");
    }

    @Test
    void inactiveAccount_isRejected() {
        when(userRepository.findAccountStatusByUsername("dev.chen")).thenReturn(Optional.of("INACTIVE"));

        assertThat(validate("dev.chen").hasErrors()).isTrue();
    }

    @Test
    void accountThatNoLongerExists_isRejected() {
        when(userRepository.findAccountStatusByUsername("deleted.user")).thenReturn(Optional.empty());

        assertThat(validate("deleted.user").hasErrors()).isTrue();
    }

    @Test
    void accountStillPendingVerification_isRejected() {
        when(userRepository.findAccountStatusByUsername("new.signup")).thenReturn(Optional.of("PENDING_VERIFICATION"));

        assertThat(validate("new.signup").hasErrors()).isTrue();
    }
}
