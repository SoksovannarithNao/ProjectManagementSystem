package backend.security;

import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.UserRepository;
import backend.service.ProjectAccessGuard;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// Lets @PreAuthorize ask the permission table instead of naming a role:
//
//     @PreAuthorize("@permissions.require(authentication, 'USER', 'CREATE')")
//
// It returns true when the caller's system role holds that grant and otherwise
// THROWS, so the 403 carries a clear sentence (see GlobalExceptionHandler)
// instead of Spring's bare "Access Denied". Only for permissions that are not
// about one project; project-scoped checks go through ProjectAccessGuard.
@Component("permissions")
public class PermissionChecker {

    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public PermissionChecker(UserRepository userRepository, ProjectAccessGuard projectAccessGuard) {
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    @Transactional(readOnly = true)
    public boolean require(Authentication authentication, String resource, String action) {
        Resource r = Resource.parse(resource)
                .orElseThrow(() -> new IllegalArgumentException("Unknown resource " + resource));
        Action a = Action.parse(action)
                .orElseThrow(() -> new IllegalArgumentException("Unknown action " + action));
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (!projectAccessGuard.systemCan(user, r, a)) {
            throw new AccessDeniedException(
                    "You do not have permission to " + a.verb() + " " + r.label());
        }
        return true;
    }
}
