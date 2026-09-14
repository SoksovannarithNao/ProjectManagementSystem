package backend.service;

import backend.entity.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserService userService;

    public CustomUserDetailsService(UserService userService) {
        this.userService = userService;
    }

    @Override
    public UserDetails loadUserByUsername(String username)
            throws UsernameNotFoundException {

        User user;

        try {
            user = userService.getUserEntityByUsername(username);
        } catch (RuntimeException ex) {
            throw new UsernameNotFoundException("User not found");
        }

        boolean enabled = "ACTIVE".equalsIgnoreCase(user.getAccountStatus());

        var builder = org.springframework.security.core.userdetails.User
                .withUsername(user.getUsername())
                .password(user.getPasswordHash())
                .disabled(!enabled);

        // user.getRole() is null for an ordinary user (no system-level role
        // — see User.role) — .roles(...) can't take an empty/null varargs,
        // so grant no authorities at all rather than a fake role.
        if (user.getRole() != null) {
            builder.roles(user.getRole().getName());
        } else {
            builder.authorities(List.of());
        }

        return builder.build();
    }
}