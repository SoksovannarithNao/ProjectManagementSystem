package backend.controller;

import backend.dto.LoginRequest;
import backend.dto.LoginResponse;
import backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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
}