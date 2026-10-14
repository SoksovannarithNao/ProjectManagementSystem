package backend.controller;

import backend.dto.LoginResponse;
import backend.dto.RegisterResponse;
import backend.exception.SessionExpiredException;
import backend.exception.TooManyRequestsException;
import backend.service.AuthService;
import jakarta.servlet.http.Cookie;
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

// The sign-in endpoints as the browser meets them: the refresh token travels only in an httpOnly cookie,
// never in the body; the cookie's attributes; what a bad request, a missing session and a locked name get.
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private static final String LOGIN = "{\"username\":\"dev.chen\",\"password\":\"DevPassword123!\"}";

    @Mock
    private AuthService authService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = ControllerTestSupport.mvcFor(new AuthController(authService, false));
    }

    private void signsIn() {
        when(authService.login(any(), eq("127.0.0.1:dev.chen")))
                .thenReturn(new AuthService.LoginResult(new LoginResponse("jwt-access", "dev.chen", "USER"), "raw-refresh"));
        when(authService.refreshLifetimeSeconds()).thenReturn(604_800L);
    }

    // ---- login ----

    @Test
    void login_answersTheAccessTokenInTheBody_andTheRefreshTokenOnlyInAnHttpOnlyCookie() throws Exception {
        signsIn();

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-access"))
                .andExpect(jsonPath("$.username").value("dev.chen"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(content().string(not(containsString("raw-refresh"))))
                .andExpect(header().string("Set-Cookie", containsString("taskflow_refresh=raw-refresh")))
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
                .andExpect(header().string("Set-Cookie", containsString("SameSite=Strict")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth")))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=604800")))
                .andExpect(header().string("Set-Cookie", not(containsString("Secure"))));
    }

    @Test
    void login_keysTheLimiterOnTheClientAddressAndWhatWasTyped() throws Exception {
        // only this exact key is stubbed: any other key gets no answer from the mock and the request fails
        when(authService.login(any(), eq("203.0.113.9:dev.chen")))
                .thenReturn(new AuthService.LoginResult(new LoginResponse("jwt-access", "dev.chen", "USER"), "raw-refresh"));
        when(authService.refreshLifetimeSeconds()).thenReturn(604_800L);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN)
                .with(request -> { request.setRemoteAddr("203.0.113.9"); return request; }))
                .andExpect(status().isOk());
    }

    @Test
    void theCookieIsSecureWhenTheSiteIsServedOverHttps() throws Exception {
        MockMvc https = ControllerTestSupport.mvcFor(new AuthController(authService, true));
        signsIn();

        https.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(header().string("Set-Cookie", containsString("Secure")));
    }

    @Test
    void login_withoutAPasswordIsRefusedBeforeTheServiceIsAsked() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"dev.chen\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Validation Failed"))
                .andExpect(jsonPath("$.fieldErrors.password").exists());

        verify(authService, never()).login(any(), any());
    }

    @Test
    void login_aLockedNameIs429_andABadBodyIs400() throws Exception {
        when(authService.login(any(), any())).thenThrow(new TooManyRequestsException("Too many failed login attempts. Try again later."));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("Too many failed login attempts. Try again later."));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed request body"));
    }

    // ---- refresh and logout ----

    @Test
    void refresh_tradesTheCookieForANewAccessToken() throws Exception {
        when(authService.refresh("raw-refresh")).thenReturn(new LoginResponse("jwt-new", "dev.chen", "USER"));

        mvc.perform(post("/api/auth/refresh").cookie(new Cookie("taskflow_refresh", "raw-refresh")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-new"));
    }

    @Test
    void refresh_withoutALiveSessionIs401() throws Exception {
        when(authService.refresh(null)).thenThrow(new SessionExpiredException("Session expired"));

        mvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("Session expired"));
    }

    @Test
    void logout_endsTheSession_clearsTheCookie_andAnswersNoContent_evenWithoutOne() throws Exception {
        mvc.perform(post("/api/auth/logout").cookie(new Cookie("taskflow_refresh", "raw-refresh")))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", containsString("taskflow_refresh=;")))
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")))
                .andExpect(header().string("Set-Cookie", containsString("Path=/api/auth")));
        verify(authService).logout("raw-refresh");

        mvc.perform(post("/api/auth/logout")).andExpect(status().isNoContent());
        verify(authService).logout(null);
    }

    // ---- registration and the e-mailed code ----

    @Test
    void register_creates_andRefusesAWeakPasswordOrABadUsername() throws Exception {
        when(authService.register(any())).thenReturn(new RegisterResponse("new.person", "new@example.test", "Verification code sent to your email"));
        String ok = "{\"username\":\"new.person\",\"email\":\"new@example.test\",\"password\":\"Sup3rSecret!pw\",\"confirmPassword\":\"Sup3rSecret!pw\"}";

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(ok))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("new.person"));
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(ok.replace("Sup3rSecret!pw", "password")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(ok.replace("new.person", "no spaces allowed")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.username").exists());
    }

    @Test
    void verifyOtp_needsSixDigits_andAWrongCodeIsA400WithTheOneMessage() throws Exception {
        mvc.perform(post("/api/auth/verify-otp").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new.person\",\"otp\":\"12\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.otp").value("OTP must be 6 digits"));
        verify(authService, never()).verifyOtp(any());

        org.mockito.Mockito.doThrow(new IllegalArgumentException("The code is incorrect or has expired. Request a new code if needed."))
                .when(authService).verifyOtp(any());
        mvc.perform(post("/api/auth/verify-otp").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new.person\",\"otp\":\"000000\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The code is incorrect or has expired. Request a new code if needed."));
    }

    @Test
    void verifyOtpAndResendOtp_answerOkWithNoBody() throws Exception {
        mvc.perform(post("/api/auth/verify-otp").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new.person\",\"otp\":\"123456\"}"))
                .andExpect(status().isOk()).andExpect(content().string(""));
        mvc.perform(post("/api/auth/resend-otp").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new.person\"}"))
                .andExpect(status().isOk()).andExpect(content().string(""));
    }
}
