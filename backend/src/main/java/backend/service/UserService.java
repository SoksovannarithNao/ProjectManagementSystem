package backend.service;

import backend.dto.SelfProfileUpdateRequest;
import backend.dto.UserCreateRequest;
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
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }

        return new UserResponse(userRepository.save(user));
    }

    public void deleteUser(Long id) {
        User user = getUserEntityById(id);
        userRepository.delete(user);
    }
}
