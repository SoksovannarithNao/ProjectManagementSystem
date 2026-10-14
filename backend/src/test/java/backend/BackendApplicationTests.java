package backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// The scheduler would write notifications into whichever database the test points at.
@SpringBootTest(properties = "app.deadlines.enabled=false")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
