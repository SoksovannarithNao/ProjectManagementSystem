package backend.service;

import backend.exception.MailDeliveryException;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Properties;

// Sends the one-time codes. Two routes, picked by configuration:
//   * SMTP (spring.mail.*), the default: Mailpit locally, any SMTP server elsewhere.
//   * The Gmail API over HTTPS, used when GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN are
//     all set. Hosts such as Render's free tier block the outgoing SMTP ports, so the hosted app sends over
//     HTTPS instead: the refresh token (obtained once, for the gmail.send scope) is traded for a short-lived
//     access token, which is cached until shortly before it expires. MAIL_FROM must be that Gmail address.
@Service
public class MailService {

    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    // Renew the access token this long before Google says it expires.
    private static final long TOKEN_SAFETY_SECONDS = 60;

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String fromName;
    private final String clientId;
    private final String clientSecret;
    private final String refreshToken;
    private final RestClient restClient;

    private String accessToken;
    private Instant accessTokenExpiresAt = Instant.EPOCH;

    @Autowired
    public MailService(
            JavaMailSender mailSender,
            @Value("${app.mail.from}") String fromAddress,
            @Value("${app.mail.from-name}") String fromName,
            @Value("${app.mail.gmail.client-id}") String clientId,
            @Value("${app.mail.gmail.client-secret}") String clientSecret,
            @Value("${app.mail.gmail.refresh-token}") String refreshToken) {
        this(mailSender, fromAddress, fromName, clientId, clientSecret, refreshToken, RestClient.builder());
    }

    MailService(
            JavaMailSender mailSender,
            String fromAddress,
            String fromName,
            String clientId,
            String clientSecret,
            String refreshToken,
            RestClient.Builder restClientBuilder) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.refreshToken = refreshToken;
        this.restClient = restClientBuilder.build();
    }

    public void sendOtpEmail(String toEmail, String otp, int expirationMinutes) {
        deliver(toEmail, "Your TaskFlow verification code",
                "Your verification code is: " + otp + "\n\n"
                        + "This code expires in " + expirationMinutes + " minutes. "
                        + "If you didn't request this, you can ignore this email.");
    }

    public void sendLoginCodeEmail(String toEmail, String code, int expirationMinutes) {
        deliver(toEmail, "Your TaskFlow sign-in code",
                "Your sign-in code is: " + code + "\n\n"
                        + "This code expires in " + expirationMinutes + " minutes. "
                        + "If you did not just enter your password to sign in to TaskFlow, someone else may know it: "
                        + "change your password.");
    }

    private boolean gmailApiConfigured() {
        return isSet(clientId) && isSet(clientSecret) && isSet(refreshToken);
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

    private void deliver(String toEmail, String subject, String text) {
        if (gmailApiConfigured()) {
            sendWithGmailApi(toEmail, subject, text);
        } else {
            sendWithSmtp(toEmail, subject, text);
        }
    }

    private void sendWithSmtp(String toEmail, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(text);
        try {
            mailSender.send(message);
        } catch (MailException ex) {
            throw new MailDeliveryException("SMTP send failed", ex);
        }
    }

    private void sendWithGmailApi(String toEmail, String subject, String text) {
        Map<String, String> body = Map.of("raw", rawMessage(toEmail, subject, text));
        try {
            postToGmail(body);
        } catch (HttpClientErrorException.Unauthorized ex) {
            // The cached access token was refused (revoked or expired early): get a new one and try once more.
            forgetAccessToken();
            try {
                postToGmail(body);
            } catch (RestClientException retryEx) {
                throw new MailDeliveryException("Gmail API send failed", retryEx);
            }
        } catch (RestClientException ex) {
            throw new MailDeliveryException("Gmail API send failed", ex);
        }
    }

    private void postToGmail(Map<String, String> body) {
        restClient.post()
                .uri(GMAIL_SEND_URL)
                .header("Authorization", "Bearer " + currentAccessToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    // The message as the Gmail API wants it: an RFC 822 message, base64url-encoded.
    private String rawMessage(String toEmail, String subject, String text) {
        try {
            MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
            message.setFrom(new InternetAddress(fromAddress, fromName, "UTF-8"));
            message.setRecipient(Message.RecipientType.TO, new InternetAddress(toEmail));
            message.setSubject(subject, "UTF-8");
            message.setText(text, "UTF-8");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            message.writeTo(out);
            return Base64.getUrlEncoder().encodeToString(out.toByteArray());
        } catch (MessagingException | IOException ex) {
            throw new MailDeliveryException("Could not build the e-mail", ex);
        }
    }

    private synchronized String currentAccessToken() {
        if (accessToken != null && Instant.now().isBefore(accessTokenExpiresAt)) {
            return accessToken;
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");
        Map<String, Object> answer;
        try {
            answer = restClient.post()
                    .uri(TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() { });
        } catch (RestClientException ex) {
            throw new MailDeliveryException("Google refused the access-token request", ex);
        }
        if (answer == null || !(answer.get("access_token") instanceof String token)) {
            throw new MailDeliveryException("Google sent no access token", null);
        }
        long expiresIn = answer.get("expires_in") instanceof Number n ? n.longValue() : 3600;
        accessToken = token;
        accessTokenExpiresAt = Instant.now().plusSeconds(Math.max(0, expiresIn - TOKEN_SAFETY_SECONDS));
        return accessToken;
    }

    private synchronized void forgetAccessToken() {
        accessToken = null;
        accessTokenExpiresAt = Instant.EPOCH;
    }
}
