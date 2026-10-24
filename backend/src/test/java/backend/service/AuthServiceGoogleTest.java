package backend.service;

import backend.dto.GoogleSignupRequiredResponse;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.TooManyRequestsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

// "Sign in with Google" follows the same rules as a password sign-in: only an ACTIVE account, the same
// lock-out, and an administrator still gets the e-mailed code instead of a session. A Google account that is
// connected to nobody gets an offer to create an account, which then starts a session like any other sign-in.
@ExtendWith(MockitoExtension.class)
class AuthServiceGoogleTest {

    private static final String KEY = "127.0.0.1:google";
    private static final GoogleTokenVerifier.GoogleAccount GOOGLE =
            new GoogleTokenVerifier.GoogleAccount("sub-1", "dev.chen@gmail.com", "Dev Chen");

    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private UserService userService;
    @Mock
    private LoginRateLimiter loginRateLimiter;
    @Mock
    private OtpService otpService;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private GoogleSignInService googleSignInService;

    private AuthService service;

    @BeforeEach
    void setUp() {
        JwtService jwtService = new JwtService("test-secret-test-secret-test-secret-test-secret-test-secret-test-secret", 900_000L);
        service = new AuthService(authenticationManager, userService, jwtService, loginRateLimiter, otpService, refreshTokenService, googleSignInService, true);
    }

    private User account(String username, String roleName, String status) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(username + "@gmail.com");
        user.setAccountStatus(status);
        Role role = new Role();
        role.setName(roleName);
        user.setRole(role);
        return user;
    }

    private void connectedTo(User user) {
        when(googleSignInService.identify("id-token")).thenReturn(new GoogleSignInService.Identified(user, GOOGLE));
    }

    @Test
    void anActiveLinkedAccount_getsASession_withoutAnyPasswordCheck() {
        User user = account("dev.chen", "USER", "ACTIVE");
        connectedTo(user);
        when(refreshTokenService.issue(user)).thenReturn("raw-refresh");

        AuthService.LoginResult result = service.loginWithGoogle("id-token", KEY);

        assertThat(result.challenge()).isNull();
        assertThat(result.signup()).isNull();
        assertThat(result.refreshToken()).isEqualTo("raw-refresh");
        assertThat(result.response().getUsername()).isEqualTo("dev.chen");
        assertThat(result.response().getToken()).isNotBlank();
        verify(loginRateLimiter).recordSuccess(KEY);
        verifyNoInteractions(authenticationManager);
    }

    @Test
    void anAdministrator_getsTheEmailedCode_notASession() {
        User admin = account("alex", "ADMINISTRATOR", "ACTIVE");
        connectedTo(admin);

        AuthService.LoginResult result = service.loginWithGoogle("id-token", KEY);

        assertThat(result.response()).isNull();
        assertThat(result.refreshToken()).isNull();
        assertThat(result.challenge().twoFactorRequired()).isTrue();
        assertThat(result.challenge().username()).isEqualTo("alex");
        assertThat(result.challenge().maskedEmail()).isEqualTo("a***@gmail.com");
        verify(otpService).sendLoginCode(admin);
        verify(refreshTokenService, never()).issue(admin);
    }

    @Test
    void aSuspendedAccount_isRefused_andNoSessionStarts() {
        User user = account("dev.chen", "USER", "SUSPENDED");
        connectedTo(user);

        assertThatThrownBy(() -> service.loginWithGoogle("id-token", KEY))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not active");
        verify(loginRateLimiter).recordFailure(KEY);
        verify(refreshTokenService, never()).issue(user);
    }

    @Test
    void aTokenThatIsNotGood_countsTowardTheLockout() {
        when(googleSignInService.identify("bad")).thenThrow(new IllegalArgumentException("nope"));

        assertThatThrownBy(() -> service.loginWithGoogle("bad", KEY)).isInstanceOf(IllegalArgumentException.class);
        verify(loginRateLimiter).recordFailure(KEY);
    }

    @Test
    void whenLockedOut_googleIsNotEvenTried() {
        doThrow(new TooManyRequestsException("Too many")).when(loginRateLimiter).assertNotLocked(KEY);

        assertThatThrownBy(() -> service.loginWithGoogle("id-token", KEY)).isInstanceOf(TooManyRequestsException.class);
        verifyNoInteractions(googleSignInService);
    }

    // ---- a Google account connected to nobody ----

    @Test
    void aGoogleAccountConnectedToNobody_isOfferedAnAccount_withNoSessionAndNoCookie() {
        GoogleSignupRequiredResponse offer = new GoogleSignupRequiredResponse(true, "dev.chen@gmail.com", "Dev Chen");
        when(googleSignInService.identify("id-token")).thenReturn(new GoogleSignInService.Identified(null, GOOGLE));
        when(googleSignInService.offerSignup(GOOGLE)).thenReturn(offer);

        AuthService.LoginResult result = service.loginWithGoogle("id-token", KEY);

        assertThat(result.signup()).isEqualTo(offer);
        assertThat(result.response()).isNull();
        assertThat(result.refreshToken()).isNull();
        assertThat(result.challenge()).isNull();
        verify(refreshTokenService, never()).issue(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void anEmailAnAccountAlreadyUses_isRefusedWithItsExplanation_notAttached() {
        when(googleSignInService.identify("id-token")).thenReturn(new GoogleSignInService.Identified(null, GOOGLE));
        when(googleSignInService.offerSignup(GOOGLE)).thenThrow(new IllegalArgumentException(GoogleSignInService.EMAIL_TAKEN_MESSAGE));

        assertThatThrownBy(() -> service.loginWithGoogle("id-token", KEY))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(GoogleSignInService.EMAIL_TAKEN_MESSAGE);
        verify(refreshTokenService, never()).issue(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void registeringWithGoogle_createsTheAccount_andStartsASession() {
        User created = account("alex.r", "USER", "ACTIVE");
        when(googleSignInService.register("id-token", "alex.r")).thenReturn(created);
        when(refreshTokenService.issue(created)).thenReturn("raw-refresh");

        AuthService.LoginResult result = service.registerWithGoogle("id-token", "alex.r", KEY);

        assertThat(result.response().getUsername()).isEqualTo("alex.r");
        assertThat(result.response().getRole()).isEqualTo("USER");
        assertThat(result.refreshToken()).isEqualTo("raw-refresh");
        verifyNoInteractions(otpService);
    }

    @Test
    void registeringWithGoogle_whenTheUsernameIsTaken_startsNoSession_andDoesNotCountAsAFailure() {
        when(googleSignInService.register("id-token", "taken")).thenThrow(new IllegalArgumentException("Username is already taken"));

        assertThatThrownBy(() -> service.registerWithGoogle("id-token", "taken", KEY))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Username is already taken");
        verify(loginRateLimiter, never()).recordFailure(KEY);
        verifyNoInteractions(refreshTokenService);
    }

    @Test
    void registeringWithGoogle_whenLockedOut_createsNothing() {
        doThrow(new TooManyRequestsException("Too many")).when(loginRateLimiter).assertNotLocked(KEY);

        assertThatThrownBy(() -> service.registerWithGoogle("id-token", "alex.r", KEY)).isInstanceOf(TooManyRequestsException.class);
        verifyNoInteractions(googleSignInService);
    }
}
