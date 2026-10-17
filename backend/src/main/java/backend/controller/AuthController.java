package backend.controller;

import backend.dto.LoginRequest;
import backend.dto.LoginResponse;
import backend.dto.OtpResendRequest;
import backend.dto.OtpVerifyRequest;
import backend.dto.RegisterRequest;
import backend.dto.RegisterResponse;
import backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    // The refresh token travels only in this cookie: httpOnly (scripts cannot read it),
    // SameSite=Strict (never sent from another site) and limited to the /api/auth endpoints
    // that use it. REFRESH_COOKIE_SECURE=true adds Secure for an HTTPS deployment.
    static final String REFRESH_COOKIE = "taskflow_refresh";
    private static final String REFRESH_COOKIE_PATH = "/api/auth";

    private final AuthService authService;
    private final boolean cookieSecure;

    public AuthController(AuthService authService, @Value("${app.refresh.cookie-secure}") boolean cookieSecure) {
        this.authService = authService;
        this.cookieSecure = cookieSecure;
    }

    // 200 with the session, or 202 with a challenge when an administrator still has to enter the
    // e-mailed code (see verifyLogin).
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String rateLimitKey = httpRequest.getRemoteAddr() + ":" + request.getUsername();
        AuthService.LoginResult result = authService.login(request, rateLimitKey);
        if (result.challenge() != null) {
            return ResponseEntity.accepted().body(result.challenge());
        }
        return session(result);
    }

    @PostMapping("/login/verify")
    public ResponseEntity<LoginResponse> verifyLogin(@Valid @RequestBody OtpVerifyRequest request, HttpServletRequest httpRequest) {
        String rateLimitKey = httpRequest.getRemoteAddr() + ":" + request.getUsername();
        return session(authService.verifyLogin(request, rateLimitKey));
    }

    private ResponseEntity<LoginResponse> session(AuthService.LoginResult result) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken(), authService.refreshLifetimeSeconds()).toString())
                .body(result.response());
    }

    // A new access token from the refresh cookie; 401 when there is no live session.
    @PostMapping("/refresh")
    public LoginResponse refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        return authService.refresh(refreshToken);
    }

    // Ends this browser's session on the server and clears the cookie. Open to everyone: it
    // only ever acts on the cookie it is sent, so a signed-out person can call it harmlessly.
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, refreshCookie("", 0).toString())
                .build();
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/register")
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/verify-otp")
    public void verifyOtp(@Valid @RequestBody OtpVerifyRequest request) {
        authService.verifyOtp(request);
    }

    @PostMapping("/resend-otp")
    public void resendOtp(@Valid @RequestBody OtpResendRequest request) {
        authService.resendOtp(request);
    }

    private ResponseCookie refreshCookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path(REFRESH_COOKIE_PATH)
                .maxAge(maxAgeSeconds)
                .build();
    }
}
