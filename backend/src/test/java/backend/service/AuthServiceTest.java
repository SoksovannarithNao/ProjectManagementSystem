package backend.service;

import backend.dto.LoginRequest;
import backend.dto.LoginResponse;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.SessionExpiredException;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Sign-in hands back an access token plus the raw refresh token for the cookie; refresh trades the
// cookie for a new access token (checklist risk R-4).
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

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
    private User user;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService("test-secret-test-secret-test-secret-test-secret-test-secret-test-secret", 900_000L);
        service = new AuthService(authenticationManager, userService, jwtService, loginRateLimiter, otpService, refreshTokenService, false);

        user = new User();
        user.setUsername("dev.chen");
        Role role = new Role();
        role.setName("USER");
        user.setRole(role);
    }

    @Test
    void loginReturnsAnAccessTokenInTheBodyAndTheRefreshTokenSeparately() {
        LoginRequest request = new LoginRequest();
        request.setUsername("dev.chen");
        request.setPassword("secret");
        when(userService.resolveLoginIdentifier("dev.chen")).thenReturn("dev.chen");
        when(userService.getUserEntityByUsername("dev.chen")).thenReturn(user);
        when(refreshTokenService.issue(user)).thenReturn("raw-refresh-token");

        AuthService.LoginResult result = service.login(request, "127.0.0.1:dev.chen");

        assertThat(result.refreshToken()).isEqualTo("raw-refresh-token");
        assertThat(result.response().getToken()).isNotBlank().isNotEqualTo("raw-refresh-token");
        assertThat(result.response().getUsername()).isEqualTo("dev.chen");
        assertThat(result.response().getRole()).isEqualTo("USER");
        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
    }

    // ---- the code endpoints reveal nothing about which usernames exist (issue I-08) ----

    private backend.dto.OtpVerifyRequest verifyRequest(String username) {
        backend.dto.OtpVerifyRequest request = new backend.dto.OtpVerifyRequest();
        request.setUsername(username);
        request.setOtp("123456");
        return request;
    }

    private backend.dto.OtpResendRequest resendRequest(String username) {
        backend.dto.OtpResendRequest request = new backend.dto.OtpResendRequest();
        request.setUsername(username);
        return request;
    }

    @Test
    void verifyingAnUnknownUsername_andAnAlreadyVerifiedOne_answerLikeAWrongCode() {
        when(userService.getUserEntityByUsername("ghost")).thenThrow(new backend.exception.NotFoundException("User not found"));
        user.setAccountStatus("ACTIVE");
        when(userService.getUserEntityByUsername("dev.chen")).thenReturn(user);

        assertThatThrownBy(() -> service.verifyOtp(verifyRequest("ghost")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(OtpService.INVALID_CODE_MESSAGE);
        assertThatThrownBy(() -> service.verifyOtp(verifyRequest("dev.chen")))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(OtpService.INVALID_CODE_MESSAGE);
        verify(otpService, never()).verify(any(), any());
        verify(userService, never()).activateUser(any());
    }

    @Test
    void verifyingAPendingAccount_checksTheCodeThenActivatesIt() {
        user.setAccountStatus("PENDING_VERIFICATION");
        when(userService.getUserEntityByUsername("dev.chen")).thenReturn(user);

        service.verifyOtp(verifyRequest("dev.chen"));

        verify(otpService).verify(user, "123456");
        verify(userService).activateUser("dev.chen");
    }

    @Test
    void askingForANewCode_forAnUnknownOrAlreadyVerifiedAccount_quietlyDoesNothing() {
        when(userService.getUserEntityByUsername("ghost")).thenThrow(new backend.exception.NotFoundException("User not found"));
        user.setAccountStatus("ACTIVE");
        when(userService.getUserEntityByUsername("dev.chen")).thenReturn(user);

        service.resendOtp(resendRequest("ghost"));
        service.resendOtp(resendRequest("dev.chen"));

        verify(otpService, never()).resendOtp(any());
    }

    @Test
    void askingForANewCode_forAPendingAccount_sendsOne() {
        user.setAccountStatus("PENDING_VERIFICATION");
        when(userService.getUserEntityByUsername("dev.chen")).thenReturn(user);

        service.resendOtp(resendRequest("dev.chen"));

        verify(otpService).resendOtp(user);
    }

    @Test
    void refreshIssuesANewAccessTokenForTheAccountBehindTheCookie() {
        when(refreshTokenService.validate("raw")).thenReturn(user);

        LoginResponse response = service.refresh("raw");

        assertThat(response.getToken()).isNotBlank();
        assertThat(response.getUsername()).isEqualTo("dev.chen");
        assertThat(response.getRole()).isEqualTo("USER");
    }

    @Test
    void refreshWithoutALiveSessionIsRefused() {
        when(refreshTokenService.validate("gone")).thenThrow(new SessionExpiredException("Session expired"));

        assertThatThrownBy(() -> service.refresh("gone")).isInstanceOf(SessionExpiredException.class);
    }

    @Test
    void logoutRevokesTheSession() {
        service.logout("raw");

        verify(refreshTokenService).revoke("raw");
    }

    @Test
    void theCookieLivesAsLongAsTheRefreshToken() {
        when(refreshTokenService.getLifetimeMs()).thenReturn(604_800_000L);

        assertThat(service.refreshLifetimeSeconds()).isEqualTo(604_800L);
    }
}
