package backend.service;

import backend.dto.LoginRequest;
import backend.dto.OtpVerifyRequest;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.exception.TooManyRequestsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// An administrator's sign-in has a second step: the right password only starts an e-mailed code, and the
// session (access token + refresh token) exists only after that code is entered. Everyone else signs in
// as before, and the whole step can be switched off.
@ExtendWith(MockitoExtension.class)
class AuthServiceAdminTwoFactorTest {

    private static final String KEY = "127.0.0.1:alex";

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

    private JwtService jwtService;
    private AuthService service;
    private User admin;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService("test-secret-test-secret-test-secret-test-secret-test-secret-test-secret", 900_000L);
        service = new AuthService(authenticationManager, userService, jwtService, loginRateLimiter, otpService, refreshTokenService, true);
        admin = account("alex", "alex.rivera@gmail.com", "ADMINISTRATOR");
    }

    private User account(String username, String email, String roleName) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setAccountStatus("ACTIVE");
        Role role = new Role();
        role.setName(roleName);
        user.setRole(role);
        return user;
    }

    private LoginRequest login(String username) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword("secret");
        return request;
    }

    private OtpVerifyRequest code(String username, String otp) {
        OtpVerifyRequest request = new OtpVerifyRequest();
        request.setUsername(username);
        request.setOtp(otp);
        return request;
    }

    // ---- step one: the password ----

    @Test
    void anAdministratorWithTheRightPassword_getsAChallenge_andNoSession() {
        when(userService.resolveLoginIdentifier("alex")).thenReturn("alex");
        when(userService.getUserEntityByUsername("alex")).thenReturn(admin);

        AuthService.LoginResult result = service.login(login("alex"), KEY);

        assertThat(result.response()).isNull();
        assertThat(result.refreshToken()).isNull();
        assertThat(result.challenge().twoFactorRequired()).isTrue();
        assertThat(result.challenge().username()).isEqualTo("alex");
        assertThat(result.challenge().maskedEmail()).isEqualTo("a***@gmail.com");
        verify(otpService).sendLoginCode(admin);
        verify(refreshTokenService, never()).issue(any());
    }

    @Test
    void aWrongPassword_stillSendsNoCode() {
        when(userService.resolveLoginIdentifier("alex")).thenReturn("alex");
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new org.springframework.security.authentication.BadCredentialsException("bad"));

        assertThatThrownBy(() -> service.login(login("alex"), KEY))
                .isInstanceOf(org.springframework.security.core.AuthenticationException.class);

        verify(otpService, never()).sendLoginCode(any());
    }

    @Test
    void anyoneElse_signsInStraightAwayEvenWhenTheStepIsOn() {
        User member = account("dev.chen", "dev@example.com", "USER");
        when(userService.resolveLoginIdentifier("dev.chen")).thenReturn("dev.chen");
        when(userService.getUserEntityByUsername("dev.chen")).thenReturn(member);
        when(refreshTokenService.issue(member)).thenReturn("raw-refresh");

        AuthService.LoginResult result = service.login(login("dev.chen"), "127.0.0.1:dev.chen");

        assertThat(result.challenge()).isNull();
        assertThat(result.refreshToken()).isEqualTo("raw-refresh");
        verify(otpService, never()).sendLoginCode(any());
    }

    @Test
    void withTheStepSwitchedOff_anAdministratorSignsInStraightAway() {
        AuthService off = new AuthService(authenticationManager, userService, jwtService, loginRateLimiter, otpService, refreshTokenService, false);
        when(userService.resolveLoginIdentifier("alex")).thenReturn("alex");
        when(userService.getUserEntityByUsername("alex")).thenReturn(admin);
        when(refreshTokenService.issue(admin)).thenReturn("raw-refresh");

        AuthService.LoginResult result = off.login(login("alex"), KEY);

        assertThat(result.challenge()).isNull();
        assertThat(result.response().getRole()).isEqualTo("ADMINISTRATOR");
        verify(otpService, never()).sendLoginCode(any());
    }

    // ---- step two: the code ----

    @Test
    void theRightCode_startsTheSession() {
        when(userService.getUserEntityByUsername("alex")).thenReturn(admin);
        when(refreshTokenService.issue(admin)).thenReturn("raw-refresh");

        AuthService.LoginResult result = service.verifyLogin(code("alex", "123456"), KEY);

        verify(otpService).verifyLoginCode(admin, "123456");
        verify(loginRateLimiter).recordSuccess(KEY);
        assertThat(result.refreshToken()).isEqualTo("raw-refresh");
        assertThat(result.response().getToken()).isNotBlank();
        assertThat(result.response().getRole()).isEqualTo("ADMINISTRATOR");
    }

    @Test
    void aWrongCode_isRefused_andCountsTowardTheLockOut() {
        when(userService.getUserEntityByUsername("alex")).thenReturn(admin);
        doThrow(new IllegalArgumentException(OtpService.INVALID_CODE_MESSAGE)).when(otpService).verifyLoginCode(admin, "000000");

        assertThatThrownBy(() -> service.verifyLogin(code("alex", "000000"), KEY))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(OtpService.INVALID_CODE_MESSAGE);

        verify(loginRateLimiter).recordFailure(KEY);
        verify(refreshTokenService, never()).issue(any());
    }

    @Test
    void unknownNames_nonAdministrators_andInactiveAccounts_answerLikeAWrongCode() {
        when(userService.getUserEntityByUsername("ghost")).thenThrow(new NotFoundException("User not found"));
        User member = account("dev.chen", "dev@example.com", "USER");
        when(userService.getUserEntityByUsername("dev.chen")).thenReturn(member);
        admin.setAccountStatus("SUSPENDED");
        when(userService.getUserEntityByUsername("alex")).thenReturn(admin);

        for (String name : new String[] {"ghost", "dev.chen", "alex"}) {
            assertThatThrownBy(() -> service.verifyLogin(code(name, "123456"), "127.0.0.1:" + name))
                    .isInstanceOf(IllegalArgumentException.class).hasMessage(OtpService.INVALID_CODE_MESSAGE);
        }

        verify(otpService, never()).verifyLoginCode(any(), any());
        verify(refreshTokenService, never()).issue(any());
    }

    @Test
    void withTheStepSwitchedOff_noCodeIsAccepted() {
        AuthService off = new AuthService(authenticationManager, userService, jwtService, loginRateLimiter, otpService, refreshTokenService, false);

        assertThatThrownBy(() -> off.verifyLogin(code("alex", "123456"), KEY))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(OtpService.INVALID_CODE_MESSAGE);

        verify(otpService, never()).verifyLoginCode(any(), any());
    }

    @Test
    void aLockedName_cannotTryCodes() {
        doThrow(new TooManyRequestsException("Too many failed login attempts. Try again later."))
                .when(loginRateLimiter).assertNotLocked(KEY);

        assertThatThrownBy(() -> service.verifyLogin(code("alex", "123456"), KEY))
                .isInstanceOf(TooManyRequestsException.class);

        verify(otpService, never()).verifyLoginCode(any(), any());
    }

    @Test
    void maskEmail_keepsTheFirstLetterAndTheDomain() {
        assertThat(AuthService.maskEmail("alex.rivera@gmail.com")).isEqualTo("a***@gmail.com");
        assertThat(AuthService.maskEmail("nodomain")).isEqualTo("***");
        assertThat(AuthService.maskEmail(null)).isEmpty();
    }
}
