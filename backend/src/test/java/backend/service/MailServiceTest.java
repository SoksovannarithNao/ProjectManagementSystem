package backend.service;

import backend.exception.MailDeliveryException;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

// Codes go out over SMTP by default and through the Gmail API over HTTPS when the three GMAIL_* values are
// set (hosts that block the SMTP ports). Either way a failed hand-over becomes one MailDeliveryException,
// never a raw provider error.
@ExtendWith(MockitoExtension.class)
class MailServiceTest {

    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    private static final String TOKEN_ANSWER = "{\"access_token\":\"ya29.test\",\"expires_in\":3599,\"token_type\":\"Bearer\"}";

    @Mock
    private JavaMailSender mailSender;

    private MailService smtpService() {
        return new MailService(mailSender, "no-reply@taskflow.dev", "TaskFlow", "", "", "", RestClient.builder());
    }

    private MailService gmailService(RestClient.Builder builder) {
        return new MailService(mailSender, "me@gmail.com", "TaskFlow", "client-id", "client-secret", "refresh-token", builder);
    }

    // ---- SMTP (the default) ----

    @Test
    void withoutGmailSettings_theCodeGoesOverSmtp() {
        smtpService().sendLoginCodeEmail("alex@gmail.com", "123456", 10);

        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(sent.capture());
        assertThat(sent.getValue().getTo()).containsExactly("alex@gmail.com");
        assertThat(sent.getValue().getFrom()).isEqualTo("no-reply@taskflow.dev");
        assertThat(sent.getValue().getSubject()).isEqualTo("Your TaskFlow sign-in code");
        assertThat(sent.getValue().getText()).contains("123456").contains("10 minutes");
    }

    @Test
    void withOnlySomeGmailSettings_itStaysOnSmtp() {
        MailService partial = new MailService(mailSender, "me@gmail.com", "TaskFlow", "client-id", "", "refresh-token", RestClient.builder());

        partial.sendOtpEmail("alex@gmail.com", "123456", 10);

        verify(mailSender).send(any(SimpleMailMessage.class));
    }

    @Test
    void anSmtpFailure_isReportedAsADeliveryFailure() {
        doThrow(new MailSendException("connect timed out")).when(mailSender).send(any(SimpleMailMessage.class));

        assertThatThrownBy(() -> smtpService().sendOtpEmail("alex@gmail.com", "123456", 10))
                .isInstanceOf(MailDeliveryException.class);
    }

    // ---- the Gmail API ----

    @Test
    void withGmailSettings_theCodeIsSentThroughTheGmailApi_andNotOverSmtp() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer google = MockRestServiceServer.bindTo(builder).build();
        google.expect(requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("grant_type=refresh_token")))
                .andExpect(content().string(containsString("refresh_token=refresh-token")))
                .andExpect(content().string(containsString("client_id=client-id")))
                .andRespond(withSuccess(TOKEN_ANSWER, MediaType.APPLICATION_JSON));
        google.expect(requestTo(SEND_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer ya29.test"))
                .andRespond(withSuccess("{\"id\":\"1\"}", MediaType.APPLICATION_JSON));

        gmailService(builder).sendLoginCodeEmail("alex@gmail.com", "123456", 10);

        google.verify();
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void theRawMessage_carriesTheRecipient_theSender_theSubjectAndTheCode() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer google = MockRestServiceServer.bindTo(builder).build();
        google.expect(requestTo(TOKEN_URL)).andRespond(withSuccess(TOKEN_ANSWER, MediaType.APPLICATION_JSON));
        String[] body = new String[1];
        google.expect(requestTo(SEND_URL))
                .andExpect(request -> body[0] = ((org.springframework.mock.http.client.MockClientHttpRequest) request).getBodyAsString())
                .andRespond(withSuccess("{\"id\":\"1\"}", MediaType.APPLICATION_JSON));

        gmailService(builder).sendLoginCodeEmail("alex@gmail.com", "123456", 10);

        Matcher raw = Pattern.compile("\"raw\"\\s*:\\s*\"([^\"]+)\"").matcher(body[0]);
        assertThat(raw.find()).isTrue();
        String mime = new String(Base64.getUrlDecoder().decode(raw.group(1)), StandardCharsets.UTF_8);
        assertThat(mime).contains("To: alex@gmail.com").contains("me@gmail.com").contains("TaskFlow")
                .contains("Subject: Your TaskFlow sign-in code").contains("123456");
    }

    @Test
    void theAccessToken_isCachedBetweenSends() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer google = MockRestServiceServer.bindTo(builder).build();
        google.expect(requestTo(TOKEN_URL)).andRespond(withSuccess(TOKEN_ANSWER, MediaType.APPLICATION_JSON));
        google.expect(requestTo(SEND_URL)).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        google.expect(requestTo(SEND_URL)).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        MailService service = gmailService(builder);

        service.sendOtpEmail("a@gmail.com", "111111", 10);
        service.sendOtpEmail("b@gmail.com", "222222", 10);

        google.verify(); // exactly one token request, two sends
    }

    @Test
    void aRefusedAccessToken_isRenewedOnce_andTheSendRetried() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer google = MockRestServiceServer.bindTo(builder).build();
        google.expect(requestTo(TOKEN_URL)).andRespond(withSuccess(TOKEN_ANSWER, MediaType.APPLICATION_JSON));
        google.expect(requestTo(SEND_URL)).andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        google.expect(requestTo(TOKEN_URL)).andRespond(withSuccess(TOKEN_ANSWER, MediaType.APPLICATION_JSON));
        google.expect(requestTo(SEND_URL)).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        gmailService(builder).sendOtpEmail("alex@gmail.com", "123456", 10);

        google.verify();
    }

    @Test
    void whenGoogleRefusesTheRefreshToken_theSendIsReportedAsADeliveryFailure() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer google = MockRestServiceServer.bindTo(builder).build();
        google.expect(requestTo(TOKEN_URL)).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\":\"invalid_grant\"}"));

        assertThatThrownBy(() -> gmailService(builder).sendOtpEmail("alex@gmail.com", "123456", 10))
                .isInstanceOf(MailDeliveryException.class);
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void whenTheGmailApiRefusesTheMessage_theSendIsReportedAsADeliveryFailure() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer google = MockRestServiceServer.bindTo(builder).build();
        google.expect(requestTo(TOKEN_URL)).andRespond(withSuccess(TOKEN_ANSWER, MediaType.APPLICATION_JSON));
        google.expect(requestTo(SEND_URL)).andRespond(withStatus(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> gmailService(builder).sendOtpEmail("alex@gmail.com", "123456", 10))
                .isInstanceOf(MailDeliveryException.class);
    }
}
