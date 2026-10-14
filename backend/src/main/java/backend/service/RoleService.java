package backend.service;

import backend.dto.RoleRequest;
import backend.entity.Role;
import backend.exception.ConflictException;
import backend.exception.NotFoundException;
import backend.repository.RoleRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

// Extra SYSTEM roles an administrator makes up (D-14). They are never built in,
// have no project role and start with no grants; what they may do is chosen on the
// Roles & Permissions screen (RolePermissionService). The seven built-in roles can
// have their description edited but not their name, and cannot be deleted.
@Service
@Transactional
public class RoleService {

    // Stored the way the built-in names are (QUALITY_AUDITOR); the screen turns it
    // back into "Quality Auditor".
    private static final Pattern STORED_NAME = Pattern.compile("[A-Z][A-Z0-9_]{1,49}");

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;

    public RoleService(RoleRepository roleRepository, UserRepository userRepository, PermissionService permissionService,
                       AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.permissionService = permissionService;
    }

    @Transactional(readOnly = true)
    public List<Role> getAllRoles() {
        return roleRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Role getRoleById(Long id) {
        return roleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Role not found"));
    }

    public Role createRole(RoleRequest request) {
        String name = storedName(request.getName());
        if (roleRepository.findByName(name).isPresent()) {
            throw new ConflictException("A role named " + display(name) + " already exists");
        }
        Role role = new Role();
        role.setName(name);
        role.setDescription(blankToNull(request.getDescription()));
        Role saved = roleRepository.save(role);
        permissionService.refresh();
        auditLogService.record(AuditLogService.ROLE_CREATED, AuditLogService.ROLE, saved.getId(), saved.getName(), null,
                null, describe(saved.getName(), saved.getDescription()));
        return saved;
    }

    public Role updateRole(Long id, RoleRequest request) {
        Role role = getRoleById(id);
        String name = role.isBuiltIn() ? request.getName() : storedName(request.getName());
        if (role.isBuiltIn() && !role.getName().equals(name)) {
            throw new IllegalArgumentException("Built-in roles cannot be renamed");
        }
        if (!role.getName().equals(name) && roleRepository.findByName(name).isPresent()) {
            throw new ConflictException("A role named " + display(name) + " already exists");
        }
        String before = describe(role.getName(), role.getDescription());
        role.setName(name);
        role.setDescription(blankToNull(request.getDescription()));
        Role saved = roleRepository.save(role);
        permissionService.refresh();
        String after = describe(saved.getName(), saved.getDescription());
        if (!before.equals(after)) {
            auditLogService.record(AuditLogService.ROLE_UPDATED, AuditLogService.ROLE, saved.getId(), saved.getName(), null,
                    before, after);
        }
        return saved;
    }

    public void deleteRole(Long id) {
        Role role = getRoleById(id);
        if (role.isBuiltIn()) {
            throw new IllegalArgumentException("Built-in roles cannot be deleted");
        }
        long holders = userRepository.countByRoleName(role.getName());
        if (holders > 0) {
            throw new ConflictException(display(role.getName()) + " is given to " + holders
                    + " account(s). Give them another role before deleting it");
        }
        auditLogService.record(AuditLogService.ROLE_DELETED, AuditLogService.ROLE, role.getId(), role.getName(), null,
                describe(role.getName(), role.getDescription()), null);
        roleRepository.delete(role);
        permissionService.refresh();
    }

    private static String describe(String name, String description) {
        return name + (description == null ? "" : " - " + description);
    }

    // "Quality auditor" -> QUALITY_AUDITOR. Letters, digits, spaces, hyphens and
    // underscores only, starting with a letter.
    private static String storedName(String typed) {
        String name = typed == null ? "" : typed.trim().replaceAll("[\\s-]+", "_").toUpperCase(Locale.ROOT);
        if (!STORED_NAME.matcher(name).matches()) {
            throw new IllegalArgumentException(
                    "A role name needs 2 to 50 letters, digits, spaces or hyphens and must start with a letter");
        }
        return name;
    }

    private static String display(String storedName) {
        StringBuilder out = new StringBuilder();
        for (String word : storedName.toLowerCase(Locale.ROOT).split("_")) {
            if (!out.isEmpty()) {
                out.append(' ');
            }
            out.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return out.toString();
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
