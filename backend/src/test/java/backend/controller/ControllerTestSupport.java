package backend.controller;

import backend.exception.GlobalExceptionHandler;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

// What the controller tests share: a MockMvc over one controller with the application's own exception
// handler (so an error is the JSON the browser would get), and a signed-in caller. The security filter
// chain and the permission checks (@PreAuthorize) are not part of it; the services behind are mocks, so
// these tests are about the web layer: which URL, which parameters, which status, which JSON.
final class ControllerTestSupport {

    // The caller every controller method receives as its Authentication.
    static final Authentication CALLER = new UsernamePasswordAuthenticationToken("pm.olivia", "n/a");

    private ControllerTestSupport() {
    }

    static MockMvc mvcFor(Object controller) {
        return MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new GlobalExceptionHandler()).build();
    }
}
