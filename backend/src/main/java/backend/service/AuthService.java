package backend.service;

import backend.dto.LoginRequest;
import backend.dto.LoginResponse;
import backend.entity.User;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;
    private final LoginRateLimiter loginRateLimiter;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserService userService,
            JwtService jwtService,
            LoginRateLimiter loginRateLimiter) {
        this.authenticationManager = authenticationManager;
        this.userService = userService;
        this.jwtService = jwtService;
        this.loginRateLimiter = loginRateLimiter;
    }

    public LoginResponse login(LoginRequest request, String rateLimitKey) {
        loginRateLimiter.assertNotLocked(rateLimitKey);

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsername(),
                            request.getPassword()
                    )
            );
        } catch (AuthenticationException ex) {
            loginRateLimiter.recordFailure(rateLimitKey);
            throw ex;
        }

        loginRateLimiter.recordSuccess(rateLimitKey);

        User user = userService.getUserEntityByUsername(request.getUsername());

        String token = jwtService.generateToken(
                user.getUsername(),
                user.getRole().getName()
        );

        return new LoginResponse(
                token,
                user.getUsername(),
                user.getRole().getName()
        );
    }
}