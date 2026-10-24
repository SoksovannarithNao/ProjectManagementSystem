package backend.service;

import backend.dto.GoogleLinkRequest;
import backend.dto.GoogleSetPasswordRequest;
import backend.dto.GoogleSignupRequiredResponse;
import backend.dto.GoogleStatusResponse;
import backend.entity.User;
import backend.entity.UserIdentity;
import backend.repository.UserIdentityRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// A Google account is known by its stable id (sub), never by e-mail: it signs in to the account it was connected
// to (by someone who knew that account's password), or it may create a new account when its verified e-mail is
// used by nobody; an e-mail an account already uses is refused, never attached.
@ExtendWith(MockitoExtension.class)
class GoogleSignInServiceTest {

    private static final GoogleTokenVerifier.GoogleAccount GOOGLE =
            new GoogleTokenVerifier.GoogleAccount("sub-1", "alex@gmail.com", "Alex Rivera");

    @Mock
    private GoogleTokenVerifier tokenVerifier;
    @Mock
    private UserIdentityRepository identityRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserService userService;
    @Mock
    private PasswordEncoder passwordEncoder;

    private GoogleSignInService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new GoogleSignInService(tokenVerifier, identityRepository, userRepository, userService, passwordEncoder);
        user = new User();
        user.setUsername("alex");
        user.setPasswordHash("hash");
    }

    private UserIdentity identityOf(User owner, String subject) {
        UserIdentity identity = new UserIdentity();
        identity.setUser(owner);
        identity.setProvider(UserIdentity.GOOGLE);
        identity.setSubject(subject);
        identity.setEmail("alex@gmail.com");
        return identity;
    }

    private GoogleLinkRequest linkRequest() {
        return new GoogleLinkRequest("id-token", "Password123!");
    }

    // ---- signing in ----

    @Test
    void identify_findsTheAccountByGoogleSubject_andNotesTheTime() {
        UserIdentity identity = identityOf(user, "sub-1");
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByProviderAndSubject("GOOGLE", "sub-1")).thenReturn(Optional.of(identity));

        GoogleSignInService.Identified identified = service.identify("id-token");

        assertThat(identified.user()).isSameAs(user);
        assertThat(identified.google()).isEqualTo(GOOGLE);
        assertThat(identity.getLastLoginAt()).isNotNull();
    }

    @Test
    void identify_aGoogleAccountConnectedToNobody_hasNoUser_evenIfAnAccountHasTheSameEmail() {
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByProviderAndSubject("GOOGLE", "sub-1")).thenReturn(Optional.empty());

        assertThat(service.identify("id-token").user()).isNull();
        verify(userService, never()).getUserEntityByUsername(any());
    }

    // ---- creating an account from Google ----

    @Test
    void offerSignup_forAVerifiedEmailNobodyUses_offersTheEmailAndName() {
        when(userRepository.existsByEmailIgnoreCase("alex@gmail.com")).thenReturn(false);

        GoogleSignupRequiredResponse offer = service.offerSignup(GOOGLE);

        assertThat(offer).isEqualTo(new GoogleSignupRequiredResponse(true, "alex@gmail.com", "Alex Rivera"));
    }

    @Test
    void offerSignup_forAnEmailAnAccountAlreadyUses_tellsThemToSignInAndConnect_neverAttaches() {
        when(userRepository.existsByEmailIgnoreCase("alex@gmail.com")).thenReturn(true);

        assertThatThrownBy(() -> service.offerSignup(GOOGLE))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(GoogleSignInService.EMAIL_TAKEN_MESSAGE);
        verify(identityRepository, never()).save(any());
    }

    @Test
    void offerSignup_withoutAnEmailGoogleVouchesFor_isRefused() {
        GoogleTokenVerifier.GoogleAccount noEmail = new GoogleTokenVerifier.GoogleAccount("sub-1", null, "Alex");

        assertThatThrownBy(() -> service.offerSignup(noEmail))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(GoogleSignInService.NO_EMAIL_MESSAGE);
    }

    @Test
    void register_createsTheAccountFromTheTokenNotTheRequest_andConnectsTheGoogleAccount() {
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByProviderAndSubject("GOOGLE", "sub-1")).thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("alex@gmail.com")).thenReturn(false);
        when(userService.registerGoogleUser("alex.r", "alex@gmail.com", "Alex Rivera")).thenReturn(user);

        User created = service.register("id-token", "alex.r");

        assertThat(created).isSameAs(user);
        ArgumentCaptor<UserIdentity> saved = ArgumentCaptor.forClass(UserIdentity.class);
        verify(identityRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(user);
        assertThat(saved.getValue().getSubject()).isEqualTo("sub-1");
        assertThat(saved.getValue().getEmail()).isEqualTo("alex@gmail.com");
    }

    @Test
    void register_refusesAGoogleAccountThatAlreadyHasAnAccount_andAnEmailAlreadyUsed() {
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByProviderAndSubject("GOOGLE", "sub-1"))
                .thenReturn(Optional.of(identityOf(user, "sub-1")))
                .thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("alex@gmail.com")).thenReturn(true);

        assertThatThrownBy(() -> service.register("id-token", "alex.r"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(GoogleSignInService.ALREADY_REGISTERED_MESSAGE);
        assertThatThrownBy(() -> service.register("id-token", "alex.r"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage(GoogleSignInService.EMAIL_TAKEN_MESSAGE);
        verify(userService, never()).registerGoogleUser(any(), any(), any());
        verify(identityRepository, never()).save(any());
    }

    @Test
    void register_withATakenUsername_createsNothing() {
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByProviderAndSubject("GOOGLE", "sub-1")).thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("alex@gmail.com")).thenReturn(false);
        when(userService.registerGoogleUser("taken", "alex@gmail.com", "Alex Rivera"))
                .thenThrow(new IllegalArgumentException("Username is already taken"));

        assertThatThrownBy(() -> service.register("id-token", "taken"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Username is already taken");
        verify(identityRepository, never()).save(any());
    }

    // ---- connecting ----

    @Test
    void link_withTheRightPassword_connectsTheGoogleAccount() {
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(passwordEncoder.matches("Password123!", "hash")).thenReturn(true);
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByUserIdAndProvider(any(), any())).thenReturn(Optional.empty());
        when(identityRepository.findByProviderAndSubject("GOOGLE", "sub-1")).thenReturn(Optional.empty());

        GoogleStatusResponse status = service.link("alex", linkRequest());

        ArgumentCaptor<UserIdentity> saved = ArgumentCaptor.forClass(UserIdentity.class);
        verify(identityRepository).save(saved.capture());
        assertThat(saved.getValue().getUser()).isSameAs(user);
        assertThat(saved.getValue().getSubject()).isEqualTo("sub-1");
        assertThat(saved.getValue().getEmail()).isEqualTo("alex@gmail.com");
        assertThat(status.linked()).isTrue();
        assertThat(status.email()).isEqualTo("alex@gmail.com");
    }

    @Test
    void link_withTheWrongPassword_isRefused_andNothingIsSaved() {
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(passwordEncoder.matches("Password123!", "hash")).thenReturn(false);

        assertThatThrownBy(() -> service.link("alex", linkRequest()))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Current password is incorrect");
        verify(tokenVerifier, never()).verify(any());
        verify(identityRepository, never()).save(any());
    }

    @Test
    void link_whenAnotherAccountAlreadyHoldsThatGoogleAccount_isRefused() {
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(passwordEncoder.matches("Password123!", "hash")).thenReturn(true);
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByUserIdAndProvider(any(), any())).thenReturn(Optional.empty());
        when(identityRepository.findByProviderAndSubject("GOOGLE", "sub-1")).thenReturn(Optional.of(identityOf(new User(), "sub-1")));

        assertThatThrownBy(() -> service.link("alex", linkRequest()))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("another TaskFlow account");
        verify(identityRepository, never()).save(any());
    }

    @Test
    void link_whenTheAccountAlreadyHasAGoogleAccount_asksToDisconnectFirst() {
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(passwordEncoder.matches("Password123!", "hash")).thenReturn(true);
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByUserIdAndProvider(any(), any())).thenReturn(Optional.of(identityOf(user, "sub-1")));

        assertThatThrownBy(() -> service.link("alex", linkRequest()))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Disconnect it first");
        verify(identityRepository, never()).save(any());
    }

    // ---- status and disconnecting ----

    @Test
    void status_saysWhetherAGoogleAccountIsConnected() {
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(tokenVerifier.isEnabled()).thenReturn(true);
        when(identityRepository.findByUserIdAndProvider(any(), any()))
                .thenReturn(Optional.of(identityOf(user, "sub-1")))
                .thenReturn(Optional.empty());

        assertThat(service.status("alex")).isEqualTo(new GoogleStatusResponse(true, true, "alex@gmail.com"));
        assertThat(service.status("alex")).isEqualTo(new GoogleStatusResponse(true, false, null));
    }

    @Test
    void unlink_removesTheConnection_andDoesNothingWhenThereIsNone() {
        UserIdentity identity = identityOf(user, "sub-1");
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(identityRepository.findByUserIdAndProvider(any(), any()))
                .thenReturn(Optional.of(identity))
                .thenReturn(Optional.empty());

        service.unlink("alex");
        service.unlink("alex");

        verify(identityRepository).delete(identity);
    }

    @Test
    void unlink_isRefusedWhileTheAccountHasNoPassword_soItCannotLockItselfOut() {
        user.setPasswordSet(false);
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);

        assertThatThrownBy(() -> service.unlink("alex"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Set a password first");
        verify(identityRepository, never()).delete(any());
    }

    // ---- the first password of an account Google created ----

    private GoogleSetPasswordRequest setPasswordRequest(String confirm) {
        return new GoogleSetPasswordRequest("id-token", "Password123!", confirm);
    }

    @Test
    void setPassword_withTheConnectedGoogleAccount_setsTheFirstPassword() {
        user.setPasswordSet(false);
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByUserIdAndProvider(any(), any())).thenReturn(Optional.of(identityOf(user, "sub-1")));

        service.setPassword("alex", setPasswordRequest("Password123!"));

        verify(userService).setInitialPassword("alex", "Password123!");
    }

    @Test
    void setPassword_isRefusedForAnotherGoogleAccount_aMismatchedConfirmation_andAnAccountThatHasAPassword() {
        user.setPasswordSet(false);
        when(userService.getUserEntityByUsername("alex")).thenReturn(user);
        when(tokenVerifier.verify("id-token")).thenReturn(GOOGLE);
        when(identityRepository.findByUserIdAndProvider(any(), any())).thenReturn(Optional.of(identityOf(user, "another-sub")));

        assertThatThrownBy(() -> service.setPassword("alex", setPasswordRequest("Password123!")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("connected to this account");
        assertThatThrownBy(() -> service.setPassword("alex", setPasswordRequest("Different123!")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("do not match");

        user.setPasswordSet(true);
        assertThatThrownBy(() -> service.setPassword("alex", setPasswordRequest("Password123!")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("already has a password");
        verify(userService, never()).setInitialPassword(any(), any());
    }
}
