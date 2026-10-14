package backend.service;

import backend.entity.OtpVerification;
import backend.entity.User;
import backend.repository.OtpVerificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The registration code: every way a verification can fail says the same thing (issue I-08), so the
// answer cannot tell a caller whether the username exists or what went wrong with its code.
@ExtendWith(MockitoExtension.class)
class OtpServiceTest {

    @Mock
    private OtpVerificationRepository otpVerificationRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private MailService mailService;

    private OtpService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new OtpService(otpVerificationRepository, passwordEncoder, mailService, 10, 5, 60);
        user = new User();
        ReflectionTestUtils.setField(user, "id", 7L);
    }

    private OtpVerification otp(OffsetDateTime expiresAt, int attempts, OffsetDateTime consumedAt) {
        OtpVerification otp = new OtpVerification();
        otp.setExpiresAt(expiresAt);
        otp.setAttempts(attempts);
        otp.setMaxAttempts(5);
        otp.setConsumedAt(consumedAt);
        otp.setOtpHash("hash");
        return otp;
    }

    private void latestIs(OtpVerification otp) {
        when(otpVerificationRepository.findTopByUserIdAndPurposeOrderByCreatedAtDesc(7L, "REGISTRATION")).thenReturn(Optional.ofNullable(otp));
    }

    @Test
    void aCorrectCode_isConsumedAndAccepted() {
        OtpVerification live = otp(OffsetDateTime.now().plusMinutes(5), 0, null);
        latestIs(live);
        when(passwordEncoder.matches("123456", "hash")).thenReturn(true);

        service.verify(user, "123456");

        assertThat(live.getConsumedAt()).isNotNull();
        verify(otpVerificationRepository).save(live);
    }

    @Test
    void aWrongCode_countsAnAttempt_andSaysTheGeneralThing() {
        OtpVerification live = otp(OffsetDateTime.now().plusMinutes(5), 1, null);
        latestIs(live);
        when(passwordEncoder.matches("000000", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.verify(user, "000000"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(OtpService.INVALID_CODE_MESSAGE);
        assertThat(live.getAttempts()).isEqualTo(2);
        verify(otpVerificationRepository).save(live);
    }

    @Test
    void noCode_anExpiredCode_aUsedCode_andTooManyAttempts_allSayTheSameThing() {
        OtpVerification expired = otp(OffsetDateTime.now().minusMinutes(1), 0, null);
        OtpVerification used = otp(OffsetDateTime.now().plusMinutes(5), 0, OffsetDateTime.now().minusMinutes(1));
        OtpVerification exhausted = otp(OffsetDateTime.now().plusMinutes(5), 5, null);

        for (OtpVerification latest : new OtpVerification[] { null, expired, used, exhausted }) {
            latestIs(latest);
            assertThatThrownBy(() -> service.verify(user, "123456"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage(OtpService.INVALID_CODE_MESSAGE);
        }
        // none of these reached the comparison, so no attempt was counted against an unusable code
        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void theGeneralMessage_namesNoReasonAndNoAttemptCount() {
        assertThat(OtpService.INVALID_CODE_MESSAGE).doesNotContain("attempt", "expired code", "already", "No verification", "not found");
    }
}
