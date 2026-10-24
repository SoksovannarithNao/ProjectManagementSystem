package backend.service;

import backend.dto.GoogleLinkRequest;
import backend.dto.GoogleSetPasswordRequest;
import backend.dto.GoogleSignupRequiredResponse;
import backend.dto.GoogleStatusResponse;
import backend.entity.User;
import backend.entity.UserIdentity;
import backend.repository.UserIdentityRepository;
import backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

// "Sign in with Google" ([ADR-0017] and [ADR-0018]). A Google account is known to TaskFlow by its stable id (sub),
// never by e-mail address: a profile e-mail can be edited without being verified, so matching on it would let
// one person's account capture another's Google sign-in. So a Google account either
//   - was connected earlier to an existing account, from that account's Profile page, by someone who proved they
//     own it with the current password (link), and then signs in to it; or
//   - belongs to nobody yet and, if its e-mail address is verified by Google and used by no account, may create
//     a new account (register); a Google account whose e-mail address an account already uses is told to sign
//     in with the password and connect Google on Profile instead, and is never attached automatically.
@Service
@Transactional
public class GoogleSignInService {

    static final String NO_EMAIL_MESSAGE =
            "Google did not confirm an e-mail address for this Google account, so an account cannot be created from it.";
    static final String EMAIL_TAKEN_MESSAGE =
            "An account with this e-mail address already exists. Sign in with your password, "
                    + "then connect Google on your Profile page.";
    static final String ALREADY_REGISTERED_MESSAGE =
            "This Google account already has a TaskFlow account. Use Sign in with Google.";

    // What a Google ID token turned out to be: the account it is connected to (null when none) and the Google
    // account itself.
    public record Identified(User user, GoogleTokenVerifier.GoogleAccount google) {
    }

    private final GoogleTokenVerifier tokenVerifier;
    private final UserIdentityRepository identityRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;

    public GoogleSignInService(
            GoogleTokenVerifier tokenVerifier,
            UserIdentityRepository identityRepository,
            UserRepository userRepository,
            UserService userService,
            PasswordEncoder passwordEncoder) {
        this.tokenVerifier = tokenVerifier;
        this.identityRepository = identityRepository;
        this.userRepository = userRepository;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
    }

    // The public OAuth client ID for the sign-in page, or null when the feature is off.
    @Transactional(readOnly = true)
    public String clientId() {
        return tokenVerifier.clientId();
    }

    // Checks the ID token and looks the Google account up by its sub. Throws IllegalArgumentException when the
    // token is not good. The caller decides what a missing account means (sign-up) and whether a found one may
    // sign in (status, second step).
    public Identified identify(String credential) {
        GoogleTokenVerifier.GoogleAccount google = tokenVerifier.verify(credential);
        return identityRepository.findByProviderAndSubject(UserIdentity.GOOGLE, google.subject())
                .map(identity -> {
                    identity.setLastLoginAt(OffsetDateTime.now());
                    return new Identified(identity.getUser(), google);
                })
                .orElseGet(() -> new Identified(null, google));
    }

    // A Google account that is connected to nobody: may a new account be made from it? Only when Google vouches
    // for its e-mail address and no account uses that address; otherwise the person is told what to do instead.
    @Transactional(readOnly = true)
    public GoogleSignupRequiredResponse offerSignup(GoogleTokenVerifier.GoogleAccount google) {
        requireFreeEmail(google);
        return new GoogleSignupRequiredResponse(true, google.email(), google.name());
    }

    // Creates the account (the person chose the username; it must not be taken) and connects the Google account
    // to it. The e-mail and name come from the verified token, never from the request.
    public User register(String credential, String username) {
        GoogleTokenVerifier.GoogleAccount google = tokenVerifier.verify(credential);
        if (identityRepository.findByProviderAndSubject(UserIdentity.GOOGLE, google.subject()).isPresent()) {
            throw new IllegalArgumentException(ALREADY_REGISTERED_MESSAGE);
        }
        requireFreeEmail(google);

        User user = userService.registerGoogleUser(username, google.email(), google.name());
        saveIdentity(user, google);
        return user;
    }

    private void requireFreeEmail(GoogleTokenVerifier.GoogleAccount google) {
        if (google.email() == null) {
            throw new IllegalArgumentException(NO_EMAIL_MESSAGE);
        }
        if (userRepository.existsByEmailIgnoreCase(google.email())) {
            throw new IllegalArgumentException(EMAIL_TAKEN_MESSAGE);
        }
    }

    @Transactional(readOnly = true)
    public GoogleStatusResponse status(String username) {
        User user = userService.getUserEntityByUsername(username);
        return identityRepository.findByUserIdAndProvider(user.getId(), UserIdentity.GOOGLE)
                .map(identity -> new GoogleStatusResponse(tokenVerifier.isEnabled(), true, identity.getEmail()))
                .orElseGet(() -> new GoogleStatusResponse(tokenVerifier.isEnabled(), false, null));
    }

    // Requires the current password (like changing it does), so a stolen-but-still-valid access token
    // alone cannot attach the thief's Google account and keep access after the token expires.
    public GoogleStatusResponse link(String username, GoogleLinkRequest request) {
        User user = userService.getUserEntityByUsername(username);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        GoogleTokenVerifier.GoogleAccount google = tokenVerifier.verify(request.credential());
        if (identityRepository.findByUserIdAndProvider(user.getId(), UserIdentity.GOOGLE).isPresent()) {
            throw new IllegalArgumentException("A Google account is already connected. Disconnect it first.");
        }
        if (identityRepository.findByProviderAndSubject(UserIdentity.GOOGLE, google.subject()).isPresent()) {
            throw new IllegalArgumentException("This Google account is already connected to another TaskFlow account");
        }

        saveIdentity(user, google);
        return new GoogleStatusResponse(true, true, google.email());
    }

    private void saveIdentity(User user, GoogleTokenVerifier.GoogleAccount google) {
        UserIdentity identity = new UserIdentity();
        identity.setUser(user);
        identity.setProvider(UserIdentity.GOOGLE);
        identity.setSubject(google.subject());
        identity.setEmail(google.email());
        identityRepository.save(identity);
    }

    // The first password of an account Google created. There is no current password to ask for, so the person
    // proves who they are with a fresh Google ID token, which must be for the Google account connected to
    // this very account. An account that already has a password changes it the usual way.
    public void setPassword(String username, GoogleSetPasswordRequest request) {
        User user = userService.getUserEntityByUsername(username);
        if (user.isPasswordSet()) {
            throw new IllegalArgumentException("This account already has a password. Change it with your current password");
        }
        if (!request.newPassword().equals(request.confirmNewPassword())) {
            throw new IllegalArgumentException("New password and confirmation do not match");
        }
        GoogleTokenVerifier.GoogleAccount google = tokenVerifier.verify(request.credential());
        boolean theConnectedAccount = identityRepository.findByUserIdAndProvider(user.getId(), UserIdentity.GOOGLE)
                .filter(identity -> identity.getSubject().equals(google.subject()))
                .isPresent();
        if (!theConnectedAccount) {
            throw new IllegalArgumentException("Confirm with the Google account connected to this account");
        }
        userService.setInitialPassword(username, request.newPassword());
    }

    // Allowed whenever the account has a password it can sign in with; an account Google created and that has
    // no password yet keeps its connection, or it would have no way to sign in at all.
    public void unlink(String username) {
        User user = userService.getUserEntityByUsername(username);
        if (!user.isPasswordSet()) {
            throw new IllegalArgumentException("Set a password first, or you would have no way to sign in.");
        }
        identityRepository.findByUserIdAndProvider(user.getId(), UserIdentity.GOOGLE)
                .ifPresent(identityRepository::delete);
    }
}
