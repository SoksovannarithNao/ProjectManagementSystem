package backend.service;

import backend.exception.NotFoundException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// The checks that stand between a Google ID token and an account: signature, expiry, issuer, audience. The
// tokens are signed here with a throw-away RSA key standing in for Google's, so no network is used.
class GoogleTokenVerifierTest {

    private static final String CLIENT_ID = "1234-abc.apps.googleusercontent.com";
    private static final String GOOGLE = "https://accounts.google.com";

    private static KeyPair signingKey;
    private GoogleTokenVerifier verifier;

    @BeforeAll
    static void generateKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        signingKey = generator.generateKeyPair();
    }

    @BeforeEach
    void setUp() {
        verifier = new GoogleTokenVerifier(CLIENT_ID,
                NimbusJwtDecoder.withPublicKey((RSAPublicKey) signingKey.getPublic()).build());
    }

    private String token(String issuer, String audience, Instant expires, Map<String, Object> claims, KeyPair key) throws Exception {
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .audience(audience)
                .subject("110169484474386276334")
                .issueTime(Date.from(Instant.now().minusSeconds(60)))
                .expirationTime(Date.from(expires));
        claims.forEach(builder::claim);
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), builder.build());
        jwt.sign(new RSASSASigner(key.getPrivate()));
        return jwt.serialize();
    }

    private String goodToken(Map<String, Object> claims) throws Exception {
        return token(GOOGLE, CLIENT_ID, Instant.now().plusSeconds(600), claims, signingKey);
    }

    @Test
    void aGoodToken_givesGoogleSubjectAndTheVerifiedEmail() throws Exception {
        GoogleTokenVerifier.GoogleAccount account =
                verifier.verify(goodToken(Map.of("email", "alex@gmail.com", "email_verified", true, "name", "Alex Rivera")));

        assertThat(account.subject()).isEqualTo("110169484474386276334");
        assertThat(account.email()).isEqualTo("alex@gmail.com");
        assertThat(account.name()).isEqualTo("Alex Rivera");
    }

    @Test
    void aTokenWithoutAName_hasNullName() throws Exception {
        assertThat(verifier.verify(goodToken(Map.of("email", "alex@gmail.com", "email_verified", true))).name()).isNull();
    }

    @Test
    void anEmailGoogleDoesNotVouchFor_isNotKept() throws Exception {
        assertThat(verifier.verify(goodToken(Map.of("email", "alex@gmail.com", "email_verified", false))).email()).isNull();
        assertThat(verifier.verify(goodToken(Map.of("email", "alex@gmail.com"))).email()).isNull();
    }

    @Test
    void theOtherSpellingOfGoogleAsIssuer_isAccepted() throws Exception {
        String token = token("accounts.google.com", CLIENT_ID, Instant.now().plusSeconds(600), Map.of(), signingKey);

        assertThat(verifier.verify(token).subject()).isEqualTo("110169484474386276334");
    }

    @Test
    void aTokenMadeForAnotherApplication_isRefused() throws Exception {
        String token = token(GOOGLE, "someone-elses.apps.googleusercontent.com", Instant.now().plusSeconds(600), Map.of(), signingKey);

        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(GoogleTokenVerifier.INVALID_TOKEN_MESSAGE);
    }

    @Test
    void aTokenNotIssuedByGoogle_isRefused() throws Exception {
        String token = token("https://evil.example.com", CLIENT_ID, Instant.now().plusSeconds(600), Map.of(), signingKey);

        assertThatThrownBy(() -> verifier.verify(token)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void anExpiredToken_isRefused() throws Exception {
        String token = token(GOOGLE, CLIENT_ID, Instant.now().minusSeconds(3600), Map.of(), signingKey);

        assertThatThrownBy(() -> verifier.verify(token)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aTokenSignedWithAnotherKey_isRefused() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        String forged = token(GOOGLE, CLIENT_ID, Instant.now().plusSeconds(600), Map.of(), generator.generateKeyPair());

        assertThatThrownBy(() -> verifier.verify(forged)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void garbage_isRefused() {
        assertThatThrownBy(() -> verifier.verify("not-a-token")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void withoutAClientId_theFeatureIsOff() {
        GoogleTokenVerifier off = new GoogleTokenVerifier("");

        assertThat(off.isEnabled()).isFalse();
        assertThat(off.clientId()).isNull();
        assertThatThrownBy(() -> off.verify("anything")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void withAClientId_thePageGetsIt() {
        assertThat(verifier.isEnabled()).isTrue();
        assertThat(verifier.clientId()).isEqualTo(CLIENT_ID);
    }
}
