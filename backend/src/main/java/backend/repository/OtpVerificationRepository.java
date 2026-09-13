package backend.repository;

import backend.entity.OtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {

    // The most recent OTP row for a user/purpose — resend and verify always
    // act on whichever code was issued last, never an older superseded one.
    Optional<OtpVerification> findTopByUserIdAndPurposeOrderByCreatedAtDesc(Long userId, String purpose);
}
