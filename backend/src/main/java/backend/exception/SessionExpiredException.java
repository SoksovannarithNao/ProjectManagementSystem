package backend.exception;

// The refresh cookie is missing, unknown, expired, or belongs to an account that is no longer
// active: the person has to sign in again (401).
public class SessionExpiredException extends RuntimeException {

    public SessionExpiredException(String message) {
        super(message);
    }
}
