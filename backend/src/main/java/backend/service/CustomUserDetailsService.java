package backend.service;

import backend.entity.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

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

        return org.springframework.security.core.userdetails.User
                .withUsername(user.getUsername())
                .password(user.getPasswordHash())
                .roles(user.getRole().getName())
                .disabled(!enabled)
                .build();
    }
}