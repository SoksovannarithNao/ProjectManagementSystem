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
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String rateLimitKey = httpRequest.getRemoteAddr() + ":" + request.getUsername();
        return authService.login(request, rateLimitKey);
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
}