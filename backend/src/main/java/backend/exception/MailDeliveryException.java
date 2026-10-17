package backend.exception;

// An e-mail (a registration or sign-in code) could not be handed to the mail provider: SMTP unreachable,
// bad credentials, a rejected sender. Answered with 503 and a message that does not expose the provider.
public class MailDeliveryException extends RuntimeException {

    public MailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
