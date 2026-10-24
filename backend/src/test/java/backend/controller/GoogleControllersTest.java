package backend.controller;

import backend.dto.GoogleStatusResponse;
import backend.dto.LoginResponse;
import backend.dto.GoogleSignupRequiredResponse;
import backend.dto.TwoFactorRequiredResponse;
import backend.service.AuthService;
import backend.service.GoogleSignInService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The Google endpoints as the browser meets them: the sign-in page's config, the sign-in itself (the same
// httpOnly refresh cookie, or the administrator's 202 challenge), and the Profile page's connect/disconnect.
@ExtendWith(MockitoExtension.class)
class GoogleControllersTest {

    private static final String CREDENTIAL = "{\"credential\":\"id-token\"}";

    @Mock
    private AuthService authService;
    @Mock
    private GoogleSignInService googleSignInService;

    private MockMvc auth;
    private MockMvc account;

    @BeforeEach
    void setUp() {
        auth = ControllerTestSupport.mvcFor(new AuthController(authService, googleSignInService, false));
        account = ControllerTestSupport.mvcFor(new GoogleAccountController(googleSignInService));
    }

    @Test
    void config_givesThePublicClientId_orNullWhenOff() throws Exception {
        when(googleSignInService.clientId()).thenReturn("1234.apps.googleusercontent.com", (String) null);

        auth.perform(get("/api/auth/google/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").value("1234.apps.googleusercontent.com"));
        auth.perform(get("/api/auth/google/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientId").doesNotExist());
    }

    @Test
    void signIn_answers200WithTheSession_andTheRefreshCookieOnly() throws Exception {
        when(authService.loginWithGoogle(eq("id-token"), eq("127.0.0.1:google")))
                .thenReturn(new AuthService.LoginResult(new LoginResponse("jwt-access", "dev.chen", "USER"), "raw-refresh"));
        when(authService.refreshLifetimeSeconds()).thenReturn(604_800L);

        auth.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(CREDENTIAL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-access"))
                .andExpect(content().string(not(containsString("raw-refresh"))))
                .andExpect(header().string("Set-Cookie", containsString("taskflow_refresh=raw-refresh")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")));
    }

    @Test
    void signIn_forAnAdministrator_answers202WithAChallenge_andNoCookie() throws Exception {
        when(authService.loginWithGoogle(eq("id-token"), any()))
                .thenReturn(new AuthService.LoginResult(null, null, new TwoFactorRequiredResponse(true, "alex", "a***@gmail.com")));

        auth.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(CREDENTIAL))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.twoFactorRequired").value(true))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void signIn_forAGoogleAccountConnectedToNobody_answers200WithTheSignupOffer_andNoCookie() throws Exception {
        when(authService.loginWithGoogle(eq("id-token"), any()))
                .thenReturn(new AuthService.LoginResult(null, null, null, new GoogleSignupRequiredResponse(true, "sam@gmail.com", "Sam Lee")));

        auth.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(CREDENTIAL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signupRequired").value(true))
                .andExpect(jsonPath("$.email").value("sam@gmail.com"))
                .andExpect(jsonPath("$.name").value("Sam Lee"))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void register_createsTheAccount_answers201WithTheSession_andTheRefreshCookieOnly() throws Exception {
        when(authService.registerWithGoogle(eq("id-token"), eq("sam.lee"), eq("127.0.0.1:google")))
                .thenReturn(new AuthService.LoginResult(new LoginResponse("jwt-access", "sam.lee", "USER"), "raw-refresh"));
        when(authService.refreshLifetimeSeconds()).thenReturn(604_800L);

        auth.perform(post("/api/auth/google/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"id-token\",\"username\":\"sam.lee\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("jwt-access"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(content().string(not(containsString("raw-refresh"))))
                .andExpect(header().string("Set-Cookie", containsString("taskflow_refresh=raw-refresh")));
    }

    @Test
    void register_rejectsABadUsernameBeforeAnythingElse() throws Exception {
        for (String username : new String[] {"ab", "has space", "a@b.com", ""}) {
            auth.perform(post("/api/auth/google/register").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"credential\":\"id-token\",\"username\":\"" + username + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        verify(authService, never()).registerWithGoogle(any(), any(), any());
    }

    @Test
    void register_withATakenUsername_is400WithTheMessage_andNoCookie() throws Exception {
        when(authService.registerWithGoogle(any(), any(), any())).thenThrow(new IllegalArgumentException("Username is already taken"));

        auth.perform(post("/api/auth/google/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"id-token\",\"username\":\"taken\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Username is already taken"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void setPassword_isA204_andNeedsTheTokenAndAPolicyPassword() throws Exception {
        account.perform(post("/api/users/me/google/password").principal(ControllerTestSupport.CALLER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"id-token\",\"newPassword\":\"Password123!\",\"confirmNewPassword\":\"Password123!\"}"))
                .andExpect(status().isNoContent());
        verify(googleSignInService).setPassword(eq("pm.olivia"), any());

        account.perform(post("/api/users/me/google/password").principal(ControllerTestSupport.CALLER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"id-token\",\"newPassword\":\"weak\",\"confirmNewPassword\":\"weak\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void signIn_withoutACredential_is400() throws Exception {
        auth.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void signIn_whenRefused_is400WithTheMessage_andNoCookie() throws Exception {
        when(authService.loginWithGoogle(any(), any())).thenThrow(new IllegalArgumentException("not connected"));

        auth.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content(CREDENTIAL))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("not connected"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void profile_status_connect_and_disconnect() throws Exception {
        when(googleSignInService.status("pm.olivia")).thenReturn(new GoogleStatusResponse(true, false, null));
        when(googleSignInService.link(eq("pm.olivia"), any())).thenReturn(new GoogleStatusResponse(true, true, "o@gmail.com"));

        account.perform(get("/api/users/me/google").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(false));
        account.perform(post("/api/users/me/google").principal(ControllerTestSupport.CALLER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"id-token\",\"currentPassword\":\"Password123!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("o@gmail.com"));
        account.perform(delete("/api/users/me/google").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isNoContent());
        verify(googleSignInService).unlink("pm.olivia");
    }

    @Test
    void connect_needsBothTheCredentialAndThePassword() throws Exception {
        account.perform(post("/api/users/me/google").principal(ControllerTestSupport.CALLER)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"credential\":\"id-token\"}"))
                .andExpect(status().isBadRequest());
    }
}
