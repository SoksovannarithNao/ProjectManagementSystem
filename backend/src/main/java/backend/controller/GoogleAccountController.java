package backend.controller;

import backend.dto.GoogleLinkRequest;
import backend.dto.GoogleSetPasswordRequest;
import backend.dto.GoogleStatusResponse;
import backend.service.GoogleSignInService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// The signed-in person's own Google connection (Profile page): connect, disconnect, and set a first password for
// an account Google created. The Google SIGN-IN and SIGN-UP themselves are POST /api/auth/google and
// /google/register in AuthController.
@RestController
@RequestMapping("/api/users/me/google")
public class GoogleAccountController {

    private final GoogleSignInService googleSignInService;

    public GoogleAccountController(GoogleSignInService googleSignInService) {
        this.googleSignInService = googleSignInService;
    }

    @GetMapping
    public GoogleStatusResponse status(Authentication authentication) {
        return googleSignInService.status(authentication.getName());
    }

    // Needs the Google ID token and the account's current password.
    @PostMapping
    public GoogleStatusResponse link(Authentication authentication, @Valid @RequestBody GoogleLinkRequest request) {
        return googleSignInService.link(authentication.getName(), request);
    }

    // The first password of an account Google created, confirmed with a fresh Google ID token instead of a
    // current password. 400 when the account already has a password.
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PostMapping("/password")
    public void setPassword(Authentication authentication, @Valid @RequestBody GoogleSetPasswordRequest request) {
        googleSignInService.setPassword(authentication.getName(), request);
    }

    // Refused (400) while the account has no password: it would have no way to sign in.
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping
    public void unlink(Authentication authentication) {
        googleSignInService.unlink(authentication.getName());
    }
}
