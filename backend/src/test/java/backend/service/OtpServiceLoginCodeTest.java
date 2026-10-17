package backend.service;

import backend.entity.OtpVerification;
import backend.entity.User;
import backend.repository.OtpVerificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The administrator's sign-in code shares the table and the rules of the registration code but is its own
// purpose: it is mailed with its own wording, a code sent a moment ago is kept instead of replaced, and a
// registration code never answers for it.
@ExtendWith(MockitoExtension.class)
class OtpServiceLoginCodeTest {

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
        user.setEmail("alex.rivera@gmail.com");
        ReflectionTestUtils.setField(user, "id", 7L);
    }

    private OtpVerification loginCode(OffsetDateTime sentAt, OffsetDateTime expiresAt, int attempts, OffsetDateTime consumedAt) {
        OtpVerification otp = new OtpVerification();
        otp.setPurpose(OtpService.PURPOSE_LOGIN);
        otp.setOtpHash("hash");
        otp.setLastSentAt(sentAt);
        otp.setExpiresAt(expiresAt);
        otp.setAttempts(attempts);
        otp.setMaxAttempts(5);
        otp.setConsumedAt(consumedAt);
        return otp;
    }

    private void latestLoginCodeIs(OtpVerification otp) {
        when(otpVerificationRepository.findTopByUserIdAndPurposeOrderByCreatedAtDesc(7L, "LOGIN_2FA")).thenReturn(Optional.ofNullable(otp));
    }

    @Test
    void sendingTheFirstLoginCode_storesAHashUnderThePurpose_andMailsTheSignInWording() {
        latestLoginCodeIs(null);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        service.sendLoginCode(user);

        ArgumentCaptor<OtpVerification> saved = ArgumentCaptor.forClass(OtpVerification.class);
        verify(otpVerificationRepository).save(saved.capture());
        assertThat(saved.getValue().getPurpose()).isEqualTo("LOGIN_2FA");
        assertThat(saved.getValue().getOtpHash()).isEqualTo("hashed");
        verify(mailService).sendLoginCodeEmail(eq("alex.rivera@gmail.com"), anyString(), eq(10));
        verify(mailService, never()).sendOtpEmail(anyString(), anyString(), anyInt());
    }

    @Test
    void aCodeSentAMomentAgo_isKept_soSigningInAgainDoesNotFloodTheInbox() {
        latestLoginCodeIs(loginCode(OffsetDateTime.now().minusSeconds(20), OffsetDateTime.now().plusMinutes(9), 0, null));

        service.sendLoginCode(user);

        verify(otpVerificationRepository, never()).save(any());
        verify(mailService, never()).sendLoginCodeEmail(anyString(), anyString(), anyInt());
    }

    @Test
    void anOlderCode_aUsedOne_andOneOutOfAttempts_areReplaced() {
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        OffsetDateTime longAgo = OffsetDateTime.now().minusMinutes(5);
        OffsetDateTime justNow = OffsetDateTime.now().minusSeconds(10);
        OffsetDateTime later = OffsetDateTime.now().plusMinutes(5);
        OtpVerification[] stale = {
                loginCode(longAgo, later, 0, null),
                loginCode(justNow, later, 0, justNow),
                loginCode(justNow, later, 5, null),
                loginCode(justNow, OffsetDateTime.now().minusSeconds(1), 0, null),
        };
        for (OtpVerification old : stale) {
            latestLoginCodeIs(old);
            service.sendLoginCode(user);
        }

        verify(otpVerificationRepository, org.mockito.Mockito.times(stale.length)).save(any(OtpVerification.class));
        verify(mailService, org.mockito.Mockito.times(stale.length)).sendLoginCodeEmail(anyString(), anyString(), anyInt());
    }

    @Test
    void verifyingALoginCode_consumesIt_andOnlyLooksAtLoginCodes() {
        OtpVerification live = loginCode(OffsetDateTime.now(), OffsetDateTime.now().plusMinutes(5), 0, null);
        latestLoginCodeIs(live);
        when(passwordEncoder.matches("123456", "hash")).thenReturn(true);

        service.verifyLoginCode(user, "123456");

        assertThat(live.getConsumedAt()).isNotNull();
        verify(otpVerificationRepository, never()).findTopByUserIdAndPurposeOrderByCreatedAtDesc(7L, "REGISTRATION");
    }

    @Test
    void aWrongLoginCode_countsAnAttempt_andAMissingOneSaysTheSameThing() {
        OtpVerification live = loginCode(OffsetDateTime.now(), OffsetDateTime.now().plusMinutes(5), 1, null);
        latestLoginCodeIs(live);
        when(passwordEncoder.matches("000000", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.verifyLoginCode(user, "000000"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(OtpService.INVALID_CODE_MESSAGE);
        assertThat(live.getAttempts()).isEqualTo(2);

        latestLoginCodeIs(null);
        assertThatThrownBy(() -> service.verifyLoginCode(user, "123456"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(OtpService.INVALID_CODE_MESSAGE);
    }
}
