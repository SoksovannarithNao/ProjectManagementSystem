package backend.exception;

// A request that's well-formed but collides with existing state (e.g. a
// project code that's already taken) — mapped to 409 by GlobalExceptionHandler.
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
