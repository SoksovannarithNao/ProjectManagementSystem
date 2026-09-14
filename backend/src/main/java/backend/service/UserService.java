package backend.service;

import backend.dto.ChangePasswordRequest;
import backend.dto.MemberAttributesRequest;
import backend.dto.PasswordPolicy;
import backend.dto.RegisterRequest;
import backend.dto.SelfProfileUpdateRequest;
import backend.dto.UserCreateRequest;
import backend.dto.UserPreferencesRequest;
import backend.dto.UserResponse;
import backend.dto.UserUpdateRequest;
import backend.entity.Department;
import backend.entity.Position;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.DepartmentRepository;
import backend.repository.PositionRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.RoleRepository;
import backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional
public class UserService {

    // Content types accepted for a profile photo upload — deliberately
    // narrow (real image formats only), checked server-side since a
    // client-side accept="image/*" is only a UI hint, not a security
    // boundary.
    private static final Set<String> ALLOWED_PHOTO_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PositionRepository positionRepository;
    private final DepartmentRepository departmentRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PositionRepository positionRepository,
            DepartmentRepository departmentRepository,
            ProjectMemberRepository projectMemberRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.positionRepository = positionRepository;
        this.departmentRepository = departmentRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // Scoped like every other directory in the app: a system ADMINISTRATOR
    // sees everyone; everyone else sees only themselves plus users who
    // share an ACTIVE project membership with them (i.e. people an OWNER/
    // ADMIN actually invited them alongside) — not the whole org. Mirrors
    // ProjectAccessGuard's "your visibility comes from project_members"
    // principle, which this endpoint previously ignored entirely.
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers(String callerUsername) {
        User caller = getUserEntityByUsername(callerUsername);
        List<User> users = userRepository.findAllWithRoles();
        if (isSystemAdministrator(caller)) {
            return users.stream().map(UserResponse::new).toList();
        }

        Set<Long> visibleIds = new HashSet<>(projectMemberRepository.findActiveCoMemberUserIds(caller.getId()));
        visibleIds.add(caller.getId());
        return users.stream()
                .filter(u -> visibleIds.contains(u.getId()))
                .map(UserResponse::new)
                .toList();
    }

    private boolean isSystemAdministrator(User user) {
        return user.getRole() != null && "ADMINISTRATOR".equals(user.getRole().getName());
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
        User user = new User();
        user.setFullName(request.getFullName());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setGender(request.getGender());
        user.setDateOfBirth(request.getDateOfBirth());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setPosition(resolvePosition(request.getPositionId()));
        user.setDepartment(resolveDepartment(request.getDepartmentId()));
        user.setRole(resolveRole(request.getRoleId()));
        if (request.getAccountStatus() != null) {
            user.setAccountStatus(request.getAccountStatus());
        }

        return new UserResponse(userRepository.save(user));
    }

    public UserResponse updateUser(Long id, UserUpdateRequest request) {
        User user = getUserEntityById(id);

        user.setFullName(request.getFullName());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setGender(request.getGender());
        user.setDateOfBirth(request.getDateOfBirth());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setPosition(resolvePosition(request.getPositionId()));
        user.setDepartment(resolveDepartment(request.getDepartmentId()));
        user.setRole(resolveRole(request.getRoleId()));
        if (request.getAccountStatus() != null) {
            if (!"ACTIVE".equals(request.getAccountStatus()) && "ACTIVE".equals(user.getAccountStatus())) {
                assertNotSoleOwnerOfAnyProject(user.getId());
            }
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
        // Deliberately does NOT touch position/department (Team-Admin-managed
        // only, via updateMemberPositionDepartment below) or profilePhotoUrl
        // (managed only via uploadOwnProfilePhoto/deleteOwnProfilePhoto below).

        return new UserResponse(userRepository.save(user));
    }

    // Stores the bytes directly in the database (see User.profilePhoto) —
    // not on local disk — so the photo travels with a pg_dump/restore or a
    // managed-Postgres migration instead of being left behind on whichever
    // host originally received the upload. Generates a fresh random token
    // each time, which both replaces the old public URL (so nothing can
    // serve a stale cached copy after a re-upload) and is itself the public
    // lookup key (see PhotoController) — never the user id, which would
    // make every user's photo enumerable.
    public UserResponse uploadOwnProfilePhoto(String username, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file was uploaded");
        }
        if (!ALLOWED_PHOTO_TYPES.contains(file.getContentType())) {
            throw new IllegalArgumentException("Photo must be a JPEG, PNG, WEBP, or GIF image");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to read the uploaded photo", ex);
        }

        User user = getUserEntityByUsername(username);
        user.setProfilePhoto(bytes);
        user.setProfilePhotoContentType(file.getContentType());
        user.setProfilePhotoToken(UUID.randomUUID());
        return new UserResponse(userRepository.save(user));
    }

    public UserResponse deleteOwnProfilePhoto(String username) {
        User user = getUserEntityByUsername(username);
        user.setProfilePhoto(null);
        user.setProfilePhotoContentType(null);
        user.setProfilePhotoToken(null);
        return new UserResponse(userRepository.save(user));
    }

    // Public read path for PhotoController — no authentication, since an
    // <img> tag can't attach the JWT this API otherwise requires everywhere
    // else. Safe to expose that way because the token is an unguessable
    // UUID, not a sequential user id.
    @Transactional(readOnly = true)
    public ProfilePhoto getProfilePhotoByToken(String token) {
        UUID parsed;
        try {
            parsed = UUID.fromString(token);
        } catch (IllegalArgumentException ex) {
            throw new NotFoundException("Photo not found");
        }
        User user = userRepository.findByProfilePhotoToken(parsed)
                .orElseThrow(() -> new NotFoundException("Photo not found"));
        if (user.getProfilePhoto() == null) {
            throw new NotFoundException("Photo not found");
        }
        return new ProfilePhoto(user.getProfilePhoto(), user.getProfilePhotoContentType());
    }

    public record ProfilePhoto(byte[] bytes, String contentType) {
    }

    // Team-Admin-only: sets another user's Position/Department. "Team Admin"
    // here means a system ADMINISTRATOR, or an ACTIVE OWNER/ADMIN member of
    // at least one project the target user is also an ACTIVE member of —
    // i.e. someone who actually administers a project/team the target
    // belongs to, not just any elevated role holder. See ProjectMemberService
    // for the same "team admin" notion used to gate invites. Deliberately
    // refuses self-targeting (even for ADMINISTRATOR) — these fields must be
    // set by someone else, or a Team Admin could just set their own at will,
    // defeating the "not user-controlled" requirement.
    public UserResponse updateMemberPositionDepartment(
            String callerUsername, Long targetUserId, MemberAttributesRequest request) {
        User caller = getUserEntityByUsername(callerUsername);
        User target = getUserEntityById(targetUserId);

        if (caller.getId().equals(target.getId())) {
            throw new AccessDeniedException("You cannot change your own position/department");
        }

        if (!isSystemAdministrator(caller)) {
            List<Long> callerAdminProjectIds = projectMemberRepository.findActiveAdminProjectIds(caller.getId());
            List<Long> targetProjectIds = projectMemberRepository.findProjectIdsByUserId(target.getId());
            boolean sharesAdministeredTeam = callerAdminProjectIds.stream().anyMatch(targetProjectIds::contains);
            if (!sharesAdministeredTeam) {
                throw new AccessDeniedException("You are not a Team Admin for this member");
            }
        }

        target.setPosition(resolvePosition(request.getPositionId()));
        target.setDepartment(resolveDepartment(request.getDepartmentId()));
        return new UserResponse(userRepository.save(target));
    }

    // Optional — an admin-created/edited account may have no system-level
    // role at all (the common case; see User.role), or be explicitly
    // granted one (currently only ADMINISTRATOR exists).
    private Role resolveRole(Long roleId) {
        if (roleId == null) {
            return null;
        }
        return roleRepository.findById(roleId)
                .orElseThrow(() -> new NotFoundException("Role not found"));
    }

    private Position resolvePosition(Long positionId) {
        if (positionId == null) {
            return null;
        }
        return positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position not found"));
    }

    private Department resolveDepartment(Long departmentId) {
        if (departmentId == null) {
            return null;
        }
        return departmentRepository.findById(departmentId)
                .orElseThrow(() -> new NotFoundException("Department not found"));
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
        assertNotSoleOwnerOfAnyProject(id);
        User user = getUserEntityById(id);
        userRepository.delete(user);
    }

    // Refuses to deactivate/delete an account that is the sole ACTIVE OWNER
    // of any project — otherwise that project would be permanently
    // orphaned (granting OWNER requires already being one; see
    // ProjectAccessGuard.assertIsOwner), mirroring the same invariant
    // ProjectMemberService enforces when a member is demoted/removed
    // directly. Ownership must be transferred to another member first.
    private void assertNotSoleOwnerOfAnyProject(Long userId) {
        List<Long> soleOwnerProjectIds = projectMemberRepository.findProjectIdsWhereSoleActiveOwner(userId);
        if (!soleOwnerProjectIds.isEmpty()) {
            throw new IllegalArgumentException(
                    "This user is the sole owner of " + soleOwnerProjectIds.size()
                            + " project(s) — transfer ownership to another member before deactivating or deleting this account");
        }
    }

    // Self-registration: unlike createUser (admin-only, full field set),
    // this only collects username/email/password. fullName defaults to the
    // username — the user fills in the rest later via Profile. Every
    // self-registered account gets the global USER role (see User.role) —
    // that role carries no permission bypass of any kind, it's purely an
    // account-level label; a self-registered account is still just a plain
    // user and gains project-level authority only by creating or being
    // added to a project (see ProjectService/ProjectMemberService), never
    // from a global role. ADMINISTRATOR is never assigned here — only by an
    // existing admin promoting an account later. PENDING_VERIFICATION
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

        User user = new User();
        user.setFullName(request.getUsername());
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setAccountStatus("PENDING_VERIFICATION");
        user.setRole(defaultUserRole());

        return userRepository.save(user);
    }

    // The USER role seeded in database/init/01-init.sql (see V7 migration
    // for the delta on existing databases). Failing loudly here rather than
    // leaving role_id NULL if it's somehow missing, since a missing seed row
    // means the database wasn't migrated correctly.
    private Role defaultUserRole() {
        return roleRepository.findByName("USER")
                .orElseThrow(() -> new IllegalStateException(
                        "Default USER role is missing — check database seed data / run pending migrations"));
    }

    public void activateUser(String username) {
        User user = getUserEntityByUsername(username);
        user.setAccountStatus("ACTIVE");
        userRepository.save(user);
    }
}
