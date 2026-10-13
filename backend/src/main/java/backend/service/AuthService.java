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
    private final RefreshTokenService refreshTokenService;

    // What a successful sign-in hands back: the body for the browser and the raw refresh token
    // that goes into the httpOnly cookie (never into the body).
    public record LoginResult(LoginResponse response, String refreshToken) {
    }

    public AuthService(
            AuthenticationManager authenticationManager,
            UserService userService,
            JwtService jwtService,
            LoginRateLimiter loginRateLimiter,
            OtpService otpService,
            RefreshTokenService refreshTokenService) {
        this.authenticationManager = authenticationManager;
        this.userService = userService;
        this.jwtService = jwtService;
        this.loginRateLimiter = loginRateLimiter;
        this.otpService = otpService;
        this.refreshTokenService = refreshTokenService;
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

    public LoginResult login(LoginRequest request, String rateLimitKey) {
        loginRateLimiter.assertNotLocked(rateLimitKey);

        // The form field is still called "username" but accepts the account's
        // e-mail address as well; everything after this works on the username.
        String username = userService.resolveLoginIdentifier(request.getUsername());

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            username,
                            request.getPassword()
                    )
            );
        } catch (AuthenticationException ex) {
            loginRateLimiter.recordFailure(rateLimitKey);
            throw ex;
        }

        loginRateLimiter.recordSuccess(rateLimitKey);

        User user = userService.getUserEntityByUsername(username);
        String roleName = user.getRole() != null ? user.getRole().getName() : null;

        String token = jwtService.generateToken(user.getUsername(), roleName);

        return new LoginResult(new LoginResponse(token, user.getUsername(), roleName), refreshTokenService.issue(user));
    }

    // Trades the refresh cookie for a new access token. The account is looked at again, so a
    // suspended or deleted person is refused here even though their cookie is still unexpired.
    public LoginResponse refresh(String refreshToken) {
        User user = refreshTokenService.validate(refreshToken);
        String roleName = user.getRole() != null ? user.getRole().getName() : null;
        return new LoginResponse(jwtService.generateToken(user.getUsername(), roleName), user.getUsername(), roleName);
    }

    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken);
    }

    public long refreshLifetimeSeconds() {
        return refreshTokenService.getLifetimeMs() / 1000;
    }
}