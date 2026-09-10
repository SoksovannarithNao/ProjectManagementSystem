package backend.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NotFoundException ex) {
        log.warn("Not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(HttpStatus.NOT_FOUND.value(), "Not Found", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        log.warn("Validation failed: {}", fieldErrors);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(
                        HttpStatus.BAD_REQUEST.value(),
                        "Validation Failed",
                        "One or more fields are invalid",
                        fieldErrors
                ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        // Covers Postgres CHECK/UNIQUE/FK violations and the trigger-raised
        // exceptions from database/init/01-init.sql (cycle prevention,
        // due-date-within-project, etc.) — all surface here as a 400 instead
        // of an unhandled 500 with a raw stack trace.
        String rootMessage = ex.getMostSpecificCause().getMessage();
        String cleanMessage = cleanPostgresMessage(rootMessage);
        log.warn("Data integrity violation: {}", cleanMessage);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse(HttpStatus.BAD_REQUEST.value(), "Data Integrity Violation", cleanMessage));
    }

    // The trigger-raised messages in database/init/01-init.sql (RAISE
    // EXCEPTION '...') are already clear, specific sentences written for a
    // human — e.g. "Task due_date (2026-09-18) cannot be later than its
    // project end_date (2026-07-01)". The JDBC driver just wraps that first
    // line in an "ERROR: " prefix and appends a "Where: PL/pgSQL function
    // ..." line pointing at the trigger internals, which isn't meaningful to
    // an end user — strip both so only the actual reason reaches the client.
    private String cleanPostgresMessage(String message) {
        if (message == null || message.isBlank()) {
            return "One or more fields are invalid";
        }
        String firstLine = message.split("\\r?\\n", 2)[0].trim();
        return firstLine.startsWith("ERROR: ") ? firstLine.substring("ERROR: ".length()) : firstLine;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse(HttpStatus.FORBIDDEN.value(), "Forbidden", "You do not have permission to perform this action"));
    }

    // Bad username/password (or a disabled/non-ACTIVE account) from
    // AuthenticationManager.authenticate() in AuthService.login() — without
    // this, it fell through to the generic 500 handler below instead of a
    // proper 401.
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(AuthenticationException ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErrorResponse(HttpStatus.UNAUTHORIZED.value(), "Unauthorized", "Invalid username or password"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Internal Server Error", "An unexpected error occurred"));
    }
}
