package backend.service;

import backend.entity.OtpVerification;
import backend.entity.User;
import backend.exception.TooManyRequestsException;
import backend.repository.OtpVerificationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;

// Registration OTP: a 6-digit code, bcrypt-hashed at rest (never stored or
// returned in plaintext — the only place the plaintext code appears is the
// outgoing email), with an expiry, a capped number of verify attempts, and a
// resend cooldown. All state lives in otp_verifications; see
// docs/database.md for the schema.
@Service
@Transactional
public class OtpService {

    // The one thing a failed verification says, whatever the reason (no code, used, expired, too many
    // attempts, wrong) and whether or not the username exists, so it reveals nothing (issue I-08).
    public static final String INVALID_CODE_MESSAGE = "The code is incorrect or has expired. Request a new code if needed.";

    private static final String PURPOSE = "REGISTRATION";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OtpVerificationRepository otpVerificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final int expirationMinutes;
    private final int maxAttempts;
    private final int resendCooldownSeconds;

    public OtpService(
            OtpVerificationRepository otpVerificationRepository,
            PasswordEncoder passwordEncoder,
            MailService mailService,
            @Value("${app.otp.expiration-minutes}") int expirationMinutes,
            @Value("${app.otp.max-attempts}") int maxAttempts,
            @Value("${app.otp.resend-cooldown-seconds}") int resendCooldownSeconds) {
        this.otpVerificationRepository = otpVerificationRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.expirationMinutes = expirationMinutes;
        this.maxAttempts = maxAttempts;
        this.resendCooldownSeconds = resendCooldownSeconds;
    }

    public void sendNewOtp(User user) {
        String code = generateCode();

        OtpVerification otp = new OtpVerification();
        otp.setUser(user);
        otp.setPurpose(PURPOSE);
        otp.setOtpHash(passwordEncoder.encode(code));
        otp.setExpiresAt(OffsetDateTime.now().plusMinutes(expirationMinutes));
        otp.setMaxAttempts(maxAttempts);
        otp.setLastSentAt(OffsetDateTime.now());
        otpVerificationRepository.save(otp);

        mailService.sendOtpEmail(user.getEmail(), code, expirationMinutes);
    }

    public void resendOtp(User user) {
        otpVerificationRepository.findTopByUserIdAndPurposeOrderByCreatedAtDesc(user.getId(), PURPOSE)
                .ifPresent(latest -> {
                    Duration sinceLastSend = Duration.between(latest.getLastSentAt(), OffsetDateTime.now());
                    long remaining = resendCooldownSeconds - sinceLastSend.getSeconds();
                    if (remaining > 0) {
                        throw new TooManyRequestsException(
                                "Please wait " + remaining + "s before requesting another code");
                    }
                });
        sendNewOtp(user);
    }

    // Throws IllegalArgumentException (-> 400, with a client-facing message)
    // on any failure: no OTP on file, expired, attempts exhausted, or wrong
    // code. The caller (AuthService) is responsible for activating the
    // account once this returns normally.
    //
    // noRollbackFor is required: the class is @Transactional, and Spring's
    // default rule rolls back the whole transaction on any unchecked
    // exception — without this, the attempts increment saved just before
    // the "incorrect code" throw below would be silently undone every time,
    // so the counter would never actually advance past 1.
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void verify(User user, String code) {
        OtpVerification otp = otpVerificationRepository
                .findTopByUserIdAndPurposeOrderByCreatedAtDesc(user.getId(), PURPOSE)
                .orElseThrow(() -> new IllegalArgumentException(INVALID_CODE_MESSAGE));

        if (otp.getConsumedAt() != null
                || otp.getExpiresAt().isBefore(OffsetDateTime.now())
                || otp.getAttempts() >= otp.getMaxAttempts()) {
            throw new IllegalArgumentException(INVALID_CODE_MESSAGE);
        }

        if (!passwordEncoder.matches(code, otp.getOtpHash())) {
            otp.setAttempts(otp.getAttempts() + 1);
            otpVerificationRepository.save(otp);
            throw new IllegalArgumentException(INVALID_CODE_MESSAGE);
        }

        otp.setConsumedAt(OffsetDateTime.now());
        otpVerificationRepository.save(otp);
    }

    private String generateCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }
}
