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
        service = new AuthService(authenticationManager, userService, jwtService, loginRateLimiter, otpService, refreshTokenService);

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
