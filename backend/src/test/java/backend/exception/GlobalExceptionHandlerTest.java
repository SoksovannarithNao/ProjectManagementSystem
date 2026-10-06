package backend.exception;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
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
    void conflictException_mapsTo409WithTheOriginalMessage() {
        ResponseEntity<ErrorResponse> response =
                handler.handleConflict(new ConflictException("Project code already exists."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().message()).isEqualTo("Project code already exists.");
    }

    @Test
    void duplicateProjectCodeConstraint_mapsTo409WithoutLeakingThePostgresError() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "could not execute statement",
                new RuntimeException("ERROR: duplicate key value violates unique constraint \"projects_project_code_key\"\n"
                        + "  Detail: Key (project_code)=(PRJ-2001) already exists."));

        ResponseEntity<ErrorResponse> response = handler.handleDataIntegrityViolation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().message()).isEqualTo("Project code already exists.");
        assertThat(response.getBody().message())
                .doesNotContain("duplicate key")
                .doesNotContain("projects_project_code_key");
    }

    @Test
    void otherDataIntegrityViolations_stayA400() {
        DataIntegrityViolationException ex = new DataIntegrityViolationException(
                "could not execute statement",
                new RuntimeException("ERROR: Project 11 must keep at least one active owner"));

        ResponseEntity<ErrorResponse> response = handler.handleDataIntegrityViolation(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message()).isEqualTo("Project 11 must keep at least one active owner");
    }

    @Test
    void unexpectedException_mapsTo500WithoutLeakingTheRawExceptionMessage() {
        ResponseEntity<ErrorResponse> response =
                handler.handleUnexpected(new RuntimeException("some internal detail that shouldn't reach the client"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().message()).doesNotContain("internal detail");
    }
}
