package backend.service;

import backend.dto.LoginRequest;
import backend.dto.LoginResponse;
import backend.dto.OtpResendRequest;
import backend.dto.OtpVerifyRequest;
import backend.dto.RegisterRequest;
import backend.dto.RegisterResponse;
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
    private final OtpService otpService;

    public AuthService(
            AuthenticationManager authenticationManager,
            UserService userService,
            JwtService jwtService,
            LoginRateLimiter loginRateLimiter,
            OtpService otpService) {
        this.authenticationManager = authenticationManager;
        this.userService = userService;
        this.jwtService = jwtService;
        this.loginRateLimiter = loginRateLimiter;
        this.otpService = otpService;
    }

    public RegisterResponse register(RegisterRequest request) {
        User user = userService.registerSelfServiceUser(request);
        otpService.sendNewOtp(user);
        return new RegisterResponse(
                user.getUsername(), user.getEmail(), "Verification code sent to your email");
    }

    public void verifyOtp(OtpVerifyRequest request) {
        User user = userService.getUserEntityByUsername(request.getUsername());
        assertPendingVerification(user);
        otpService.verify(user, request.getOtp());
        userService.activateUser(user.getUsername());
    }

    public void resendOtp(OtpResendRequest request) {
        User user = userService.getUserEntityByUsername(request.getUsername());
        assertPendingVerification(user);
        otpService.resendOtp(user);
    }

    private void assertPendingVerification(User user) {
        if (!"PENDING_VERIFICATION".equals(user.getAccountStatus())) {
            throw new IllegalArgumentException("This account is already verified");
        }
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
        String roleName = user.getRole() != null ? user.getRole().getName() : null;

        String token = jwtService.generateToken(user.getUsername(), roleName);

        return new LoginResponse(token, user.getUsername(), roleName);
    }
}