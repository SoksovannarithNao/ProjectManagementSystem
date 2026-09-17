package backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void notFoundException_mapsTo404WithTheOriginalMessage() {
        ResponseEntity<ErrorResponse> response =
                handler.handleNotFound(new NotFoundException("Project not found"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().message()).isEqualTo("Project not found");
    }

    @Test
    void authenticationException_mapsTo401NotTheGeneric500() {
        ResponseEntity<ErrorResponse> response =
                handler.handleAuthenticationException(new BadCredentialsException("Bad credentials"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unexpectedException_mapsTo500WithoutLeakingTheRawExceptionMessage() {
        ResponseEntity<ErrorResponse> response =
                handler.handleUnexpected(new RuntimeException("some internal detail that shouldn't reach the client"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().message()).doesNotContain("internal detail");
    }
}
