package backend.controller;

import backend.dto.LoginResponse;
import backend.dto.TwoFactorRequiredResponse;
import backend.service.AuthService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The two HTTP steps of an administrator's sign-in: a right password answers 202 with a challenge and no
// cookie or token; the e-mailed code then answers 200 with the usual session.
@ExtendWith(MockitoExtension.class)
class AuthControllerTwoFactorTest {

    private static final String LOGIN = "{\"username\":\"alex\",\"password\":\"AdminPassword123!\"}";
    private static final String CODE = "{\"username\":\"alex\",\"otp\":\"123456\"}";

    @Mock
    private AuthService authService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = ControllerTestSupport.mvcFor(new AuthController(authService, false));
    }

    @Test
    void login_forAnAdministrator_answers202WithAChallenge_andNoTokenOrCookie() throws Exception {
        when(authService.login(any(), eq("127.0.0.1:alex")))
                .thenReturn(AuthServiceTestAccess.challenge(new TwoFactorRequiredResponse(true, "alex", "a***@gmail.com")));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.twoFactorRequired").value(true))
                .andExpect(jsonPath("$.username").value("alex"))
                .andExpect(jsonPath("$.maskedEmail").value("a***@gmail.com"))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    void loginVerify_withTheRightCode_answers200WithTheSession_andTheRefreshCookie() throws Exception {
        when(authService.verifyLogin(any(), eq("127.0.0.1:alex")))
                .thenReturn(new AuthService.LoginResult(new LoginResponse("jwt-access", "alex", "ADMINISTRATOR"), "raw-refresh"));
        when(authService.refreshLifetimeSeconds()).thenReturn(604_800L);

        mvc.perform(post("/api/auth/login/verify").contentType(MediaType.APPLICATION_JSON).content(CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-access"))
                .andExpect(jsonPath("$.role").value("ADMINISTRATOR"))
                .andExpect(content().string(not(containsString("raw-refresh"))))
                .andExpect(header().string("Set-Cookie", containsString("taskflow_refresh=raw-refresh")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Strict")));
    }

    @Test
    void loginVerify_refusesAMalformedCodeBeforeTheServiceIsAsked() throws Exception {
        mvc.perform(post("/api/auth/login/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alex\",\"otp\":\"12ab\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.otp").exists());

        verify(authService, never()).verifyLogin(any(), any());
    }

    @Test
    void loginVerify_aWrongCodeIs400WithTheGeneralMessage() throws Exception {
        when(authService.verifyLogin(any(), any()))
                .thenThrow(new IllegalArgumentException("The code is incorrect or has expired. Request a new code if needed."));

        mvc.perform(post("/api/auth/login/verify").contentType(MediaType.APPLICATION_JSON).content(CODE))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The code is incorrect or has expired. Request a new code if needed."))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    // LoginResult.challenge(...) is package-private in the service package; tests build the same record.
    private static final class AuthServiceTestAccess {
        static AuthService.LoginResult challenge(TwoFactorRequiredResponse challenge) {
            return new AuthService.LoginResult(null, null, challenge);
        }
    }
}
