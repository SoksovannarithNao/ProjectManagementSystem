package backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public MailService(JavaMailSender mailSender, @Value("${app.mail.from}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void sendOtpEmail(String toEmail, String otp, int expirationMinutes) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject("Your TaskFlow verification code");
        message.setText(
                "Your verification code is: " + otp + "\n\n"
                        + "This code expires in " + expirationMinutes + " minutes. "
                        + "If you didn't request this, you can ignore this email."
        );
        mailSender.send(message);
    }
}
