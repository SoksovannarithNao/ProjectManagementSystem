package backend.service;

import backend.dto.LoginRequest;
import backend.dto.LoginResponse;
import backend.dto.OtpResendRequest;
import backend.dto.OtpVerifyRequest;
import backend.dto.RegisterRequest;
import backend.dto.RegisterResponse;
import backend.dto.TwoFactorRequiredResponse;
import backend.entity.User;
import backend.exception.NotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private static final String ADMINISTRATOR_ROLE = "ADMINISTRATOR";

    private final AuthenticationManager authenticationManager;
    private final UserService userService;
    private final JwtService jwtService;
    private final LoginRateLimiter loginRateLimiter;
    private final OtpService otpService;
    private final RefreshTokenService refreshTokenService;
    private final boolean adminTwoFactorEnabled;

    // What a sign-in hands back: either the body for the browser plus the raw refresh token that goes
    // into the httpOnly cookie (never into the body), or, when an administrator still has to enter the
    // e-mailed code, a challenge and no session at all.
    public record LoginResult(LoginResponse response, String refreshToken, TwoFactorRequiredResponse challenge) {

        public LoginResult(LoginResponse response, String refreshToken) {
            this(response, refreshToken, null);
        }

        static LoginResult challenge(TwoFactorRequiredResponse challenge) {
            return new LoginResult(null, null, challenge);
        }
    }

    public AuthService(
            AuthenticationManager authenticationManager,
            UserService userService,
            JwtService jwtService,
            LoginRateLimiter loginRateLimiter,
            OtpService otpService,
            RefreshTokenService refreshTokenService,
            @Value("${app.auth.admin-2fa-enabled}") boolean adminTwoFactorEnabled) {
        this.authenticationManager = authenticationManager;
        this.adminTwoFactorEnabled = adminTwoFactorEnabled;
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

    // An unknown username and an account that is already verified answer exactly like a wrong code, and
    // asking for a new code for either quietly does nothing (issue I-08): these two endpoints must not
    // tell a caller which usernames exist. Registration still says a username or e-mail is taken: a
    // person signing up has to be told.
    public void verifyOtp(OtpVerifyRequest request) {
        User user = pendingAccount(request.getUsername());
        if (user == null) {
            throw new IllegalArgumentException(OtpService.INVALID_CODE_MESSAGE);
        }
        otpService.verify(user, request.getOtp());
        userService.activateUser(user.getUsername());
    }

    public void resendOtp(OtpResendRequest request) {
        User user = pendingAccount(request.getUsername());
        if (user != null) {
            otpService.resendOtp(user);
        }
    }

    // The account waiting for its code, or null when there is none (unknown, or already verified).
    private User pendingAccount(String username) {
        User user;
        try {
            user = userService.getUserEntityByUsername(username);
        } catch (NotFoundException e) {
            return null;
        }
        return "PENDING_VERIFICATION".equals(user.getAccountStatus()) ? user : null;
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
        if (requiresSecondStep(user)) {
            // The password was right but no session starts yet: the e-mailed code comes first.
            otpService.sendLoginCode(user);
            return LoginResult.challenge(
                    new TwoFactorRequiredResponse(true, user.getUsername(), maskEmail(user.getEmail())));
        }
        return signIn(user);
    }

    // Second step of an administrator's sign-in: the e-mailed code, then the same session as any
    // other sign-in. Wrong, expired or used codes (and a name that is not an administrator awaiting a
    // code) all answer alike, and every miss counts toward the same lock-out as a wrong password.
    public LoginResult verifyLogin(OtpVerifyRequest request, String rateLimitKey) {
        loginRateLimiter.assertNotLocked(rateLimitKey);

        User user = adminAwaitingCode(request.getUsername());
        if (user == null) {
            loginRateLimiter.recordFailure(rateLimitKey);
            throw new IllegalArgumentException(OtpService.INVALID_CODE_MESSAGE);
        }
        try {
            otpService.verifyLoginCode(user, request.getOtp());
        } catch (IllegalArgumentException ex) {
            loginRateLimiter.recordFailure(rateLimitKey);
            throw ex;
        }
        loginRateLimiter.recordSuccess(rateLimitKey);
        return signIn(user);
    }

    private boolean requiresSecondStep(User user) {
        return adminTwoFactorEnabled && user.getRole() != null && ADMINISTRATOR_ROLE.equals(user.getRole().getName());
    }

    // The administrator behind a sign-in code, or null when the name is unknown, is not an
    // administrator, the account is not active, or the second step is switched off.
    private User adminAwaitingCode(String username) {
        if (!adminTwoFactorEnabled || username == null) {
            return null;
        }
        User user;
        try {
            user = userService.getUserEntityByUsername(username.trim());
        } catch (NotFoundException e) {
            return null;
        }
        return requiresSecondStep(user) && "ACTIVE".equals(user.getAccountStatus()) ? user : null;
    }

    private LoginResult signIn(User user) {
        String roleName = user.getRole() != null ? user.getRole().getName() : null;
        String token = jwtService.generateToken(user.getUsername(), roleName);
        return new LoginResult(new LoginResponse(token, user.getUsername(), roleName), refreshTokenService.issue(user));
    }

    // a***@gmail.com: enough to recognise the mailbox, not enough to publish the address.
    static String maskEmail(String email) {
        if (email == null) {
            return "";
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
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