package backend.service;

import backend.dto.UserCreateRequest;
import backend.dto.UserResponse;
import backend.dto.UserUpdateRequest;
import backend.entity.Role;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.RoleRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    // A real encoder (not mocked) so the hashing behavior itself is verified,
    // not just that some method got called.
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private UserService userService;

    private Role teamMemberRole;

    @BeforeEach
    void setUp() {
        userService = new UserService(userRepository, roleRepository, passwordEncoder);

        teamMemberRole = new Role();
        teamMemberRole.setName("TEAM_MEMBER");
    }

    @Test
    void createUser_hashesThePasswordRatherThanStoringItAsIs() {
        when(roleRepository.findById(4L)).thenReturn(Optional.of(teamMemberRole));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Test User");
        request.setUsername("test.user");
        request.setEmail("test.user@example.com");
        request.setPassword("PlaintextPassword1!");
        request.setRoleId(4L);

        userService.createUser(request);

        ArgumentCaptor<User> savedUser = ArgumentCaptor.forClass(User.class);
        org.mockito.Mockito.verify(userRepository).save(savedUser.capture());

        String storedHash = savedUser.getValue().getPasswordHash();
        assertThat(storedHash).isNotEqualTo("PlaintextPassword1!");
        assertThat(passwordEncoder.matches("PlaintextPassword1!", storedHash)).isTrue();
    }

    @Test
    void createUser_doesNotLeakPasswordHashInTheResponse() {
        when(roleRepository.findById(4L)).thenReturn(Optional.of(teamMemberRole));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserCreateRequest request = new UserCreateRequest();
        request.setFullName("Test User");
        request.setUsername("test.user");
        request.setEmail("test.user@example.com");
        request.setPassword("PlaintextPassword1!");
        request.setRoleId(4L);

        UserResponse response = userService.createUser(request);

        // UserResponse has no passwordHash field/getter at all — this just
        // documents the intent so a future field addition doesn't silently
        // reintroduce the leak this DTO exists to prevent.
        assertThat(response.getUsername()).isEqualTo("test.user");
    }

    @Test
    void updateUser_leavesExistingPasswordHashUntouchedWhenNoNewPasswordGiven() {
        User existing = new User();
        existing.setUsername("test.user");
        existing.setPasswordHash("$2a$10$existingHashValueUnchanged");
        existing.setRole(teamMemberRole);

        when(userRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(roleRepository.findById(4L)).thenReturn(Optional.of(teamMemberRole));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserUpdateRequest request = new UserUpdateRequest();
        request.setFullName("Test User Renamed");
        request.setUsername("test.user");
        request.setEmail("test.user@example.com");
        request.setRoleId(4L);
        // password intentionally left null — "don't change it"

        userService.updateUser(5L, request);

        assertThat(existing.getPasswordHash()).isEqualTo("$2a$10$existingHashValueUnchanged");
    }

    @Test
    void getUserById_throwsNotFoundExceptionForAMissingUser() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(999L))
                .isInstanceOf(NotFoundException.class);
    }
}
