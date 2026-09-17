package backend.exception;

import java.time.OffsetDateTime;
import java.util.Map;

public record ErrorResponse(
        OffsetDateTime timestamp,
        int status,
        String error,
        String message,
        Map<String, String> fieldErrors
) {

    public ErrorResponse(int status, String error, String message) {
        this(OffsetDateTime.now(), status, error, message, null);
    }

    public ErrorResponse(int status, String error, String message, Map<String, String> fieldErrors) {
        this(OffsetDateTime.now(), status, error, message, fieldErrors);
    }
}
