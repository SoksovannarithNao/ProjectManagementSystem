package backend.service;

import backend.dto.ChangePasswordRequest;
import backend.dto.PasswordPolicy;
import backend.dto.RegisterRequest;
import backend.dto.SelfProfileUpdateRequest;
import backend.dto.UserCreateRequest;
import backend.dto.UserPreferencesRequest;
import backend.dto.UserResponse;
import backend.dto.UserUpdateRequest;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.RoleRepository;
import backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        return userRepository.findAllWithRoles()
                .stream()
                .map(UserResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {
        return new UserResponse(getUserEntityById(id));
    }

    @Transactional(readOnly = true)
    public UserResponse getUserByUsername(String username) {
        return new UserResponse(getUserEntityByUsername(username));
    }

    /** For internal callers (e.g. CustomUserDetailsService) that need the entity itself. */
    @Transactional(readOnly = true)
    public User getUserEntityById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    /** For internal callers (e.g. CustomUserDetailsService) that need the entity itself. */
    @Transactional(readOnly = true)
    public User getUserEntityByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    public UserResponse createUser(UserCreateRequest request) {
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new NotFoundException("Role not found"));

        User user = new User();
        user.setFullName(request.getFullName());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setGender(request.getGender());
        user.setDateOfBirth(request.getDateOfBirth());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setProfilePhotoUrl(request.getProfilePhotoUrl());
        user.setPosition(request.getPosition());
        user.setDepartment(request.getDepartment());
        user.setRole(role);
        if (request.getAccountStatus() != null) {
            user.setAccountStatus(request.getAccountStatus());
        }

        return new UserResponse(userRepository.save(user));
    }

    public UserResponse updateUser(Long id, UserUpdateRequest request) {
        User user = getUserEntityById(id);
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new NotFoundException("Role not found"));

        user.setFullName(request.getFullName());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setGender(request.getGender());
        user.setDateOfBirth(request.getDateOfBirth());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setProfilePhotoUrl(request.getProfilePhotoUrl());
        user.setPosition(request.getPosition());
        user.setDepartment(request.getDepartment());
        user.setRole(role);
        if (request.getAccountStatus() != null) {
            user.setAccountStatus(request.getAccountStatus());
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            if (!request.getPassword().matches(PasswordPolicy.REGEX)) {
                throw new IllegalArgumentException(PasswordPolicy.MESSAGE);
            }
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        return new UserResponse(userRepository.save(user));
    }

    // Self-service variant of updateUser: no roleId/accountStatus (a user
    // can't change their own role or activation status) and no username.
    public UserResponse updateOwnProfile(String username, SelfProfileUpdateRequest request) {
        User user = getUserEntityByUsername(username);

        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setGender(request.getGender());
        user.setDateOfBirth(request.getDateOfBirth());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setProfilePhotoUrl(request.getProfilePhotoUrl());
        user.setPosition(request.getPosition());
        user.setDepartment(request.getDepartment());

        return new UserResponse(userRepository.save(user));
    }

    // Requires the current password (unlike updateOwnProfile before this),
    // so a stolen-but-still-valid JWT alone isn't enough to lock the real
    // owner out of their account.
    public void changeOwnPassword(String username, ChangePasswordRequest request) {
        User user = getUserEntityByUsername(username);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            // IllegalArgumentException (not AccessDeniedException) because
            // GlobalExceptionHandler's AccessDeniedException handler always
            // returns a generic "no permission" message to the client —
            // this needs the specific message to actually reach the user.
            throw new IllegalArgumentException("Current password is incorrect");
        }
        if (!request.getNewPassword().equals(request.getConfirmNewPassword())) {
            throw new IllegalArgumentException("New password and confirmation do not match");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    // Appearance/notification preferences — separate from updateOwnProfile
    // so the Settings page (app preferences) never touches personal-info
    // fields and vice versa.
    public UserResponse updateOwnPreferences(String username, UserPreferencesRequest request) {
        User user = getUserEntityByUsername(username);
        user.setThemePreference(request.getThemePreference());
        user.setTaskNotificationsEnabled(request.getTaskNotificationsEnabled());
        return new UserResponse(userRepository.save(user));
    }

    public void deleteUser(Long id) {
        User user = getUserEntityById(id);
        userRepository.delete(user);
    }

    // Self-registration: unlike createUser (admin-only, full field set),
    // this only collects username/email/password. fullName defaults to the
    // username — the user fills in the rest later via Profile. Always
    // TEAM_MEMBER (the lowest-privilege role) and PENDING_VERIFICATION
    // (CustomUserDetailsService already treats anything but ACTIVE as
    // disabled, so this account can't log in until OtpService.verify flips
    // it to ACTIVE — see AuthService.verifyOtp).
    public User registerSelfServiceUser(RegisterRequest request) {
        if (userRepository.existsByUsernameIgnoreCase(request.getUsername())) {
            throw new IllegalArgumentException("Username is already taken");
        }
        if (userRepository.existsByEmailIgnoreCase(request.getEmail())) {
            throw new IllegalArgumentException("Email is already registered");
        }
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Password and confirmation do not match");
        }

        Role role = roleRepository.findByName("TEAM_MEMBER")
                .orElseThrow(() -> new IllegalStateException("Default TEAM_MEMBER role is not configured"));

        User user = new User();
        user.setFullName(request.getUsername());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(role);
        user.setAccountStatus("PENDING_VERIFICATION");

        return userRepository.save(user);
    }

    public void activateUser(String username) {
        User user = getUserEntityByUsername(username);
        user.setAccountStatus("ACTIVE");
        userRepository.save(user);
    }
}
