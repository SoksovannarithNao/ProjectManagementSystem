package backend.service;

import backend.dto.AuditLogPageResponse;
import backend.dto.AuditLogResponse;
import backend.entity.AuditLog;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.AuditLogRepository;
import backend.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

// The administrator audit log (assignment-brief.md B10, workflow A7, D-11): a record of the
// sensitive things done to accounts, roles, permissions, project roles, ownership and
// projects, each with the value before and after. It is written inside the transaction of the
// action it describes, so an action that is rolled back leaves no entry, and it is never
// edited or deleted. Not the same as ActivityLogService, which is the project members' feed.
@Service
@Transactional
public class AuditLogService {

    public static final String USER_ROLE_CHANGED = "USER_ROLE_CHANGED";
    public static final String PERMISSIONS_CHANGED = "PERMISSIONS_CHANGED";
    public static final String PROJECT_ROLE_CHANGED = "PROJECT_ROLE_CHANGED";
    public static final String OWNERSHIP_TRANSFERRED = "OWNERSHIP_TRANSFERRED";
    public static final String ACCOUNT_CREATED = "ACCOUNT_CREATED";
    public static final String ACCOUNT_STATUS_CHANGED = "ACCOUNT_STATUS_CHANGED";
    public static final String ACCOUNT_DELETED = "ACCOUNT_DELETED";
    public static final String PROJECT_DELETED = "PROJECT_DELETED";
    public static final String ROLE_CREATED = "ROLE_CREATED";
    public static final String ROLE_UPDATED = "ROLE_UPDATED";
    public static final String ROLE_DELETED = "ROLE_DELETED";

    public static final String USER = "USER";
    public static final String ROLE = "ROLE";
    public static final String PROJECT = "PROJECT";

    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String SYSTEM_ACTOR = "System";
    private static final char LIKE_ESCAPE = '\\';

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public AuditLogService(
            AuditLogRepository auditLogRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    // Records an action done by whoever is signed in on this request ("System" when nobody is).
    public void record(String action, String targetType, Long targetId, String targetLabel, Long projectId,
                       String before, String after) {
        record(currentUser(), action, targetType, targetId, targetLabel, projectId, before, after);
    }

    // Records an action done by `actor` (for the few that happen without a signed-in session,
    // such as a person registering their own account).
    public void record(User actor, String action, String targetType, Long targetId, String targetLabel,
                       Long projectId, String before, String after) {
        AuditLog entry = new AuditLog();
        entry.setActorId(actor != null ? actor.getId() : null);
        entry.setActorName(actor != null ? actor.getFullName() : SYSTEM_ACTOR);
        entry.setAction(action);
        entry.setTargetType(targetType);
        entry.setTargetId(targetId);
        entry.setTargetLabel(truncate(targetLabel, 255));
        entry.setProjectId(projectId);
        entry.setBeforeValue(before);
        entry.setAfterValue(after);
        auditLogRepository.save(entry);
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null || "anonymousUser".equals(auth.getName())) {
            return null;
        }
        return userRepository.findByUsername(auth.getName()).orElse(null);
    }

    // The whole log for an Administrator, newest first, narrowed by the optional filters.
    @Transactional(readOnly = true)
    public AuditLogPageResponse search(String callerUsername, String action, String targetType, String text,
                                       LocalDate from, LocalDate to, int page, int size) {
        User caller = requireUser(callerUsername);
        if (!projectAccessGuard.isAdmin(caller)) {
            throw new AccessDeniedException("Only an Administrator can read the audit log");
        }
        List<Specification<AuditLog>> parts = new ArrayList<>();
        if (action != null && !action.isBlank()) {
            parts.add((root, q, cb) -> cb.equal(root.get("action"), action.trim()));
        }
        if (targetType != null && !targetType.isBlank()) {
            parts.add((root, q, cb) -> cb.equal(root.get("targetType"), targetType.trim()));
        }
        if (text != null && !text.isBlank()) {
            String like = "%" + escapeLike(text.trim().toLowerCase(Locale.ROOT)) + "%";
            parts.add((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.<String>get("actorName")), like, LIKE_ESCAPE),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("targetLabel"), "")), like, LIKE_ESCAPE),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("beforeValue"), "")), like, LIKE_ESCAPE),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("afterValue"), "")), like, LIKE_ESCAPE)));
        }
        if (from != null) {
            OffsetDateTime start = from.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
            parts.add((root, q, cb) -> cb.greaterThanOrEqualTo(root.<OffsetDateTime>get("createdAt"), start));
        }
        if (to != null) {
            OffsetDateTime end = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
            parts.add((root, q, cb) -> cb.lessThan(root.<OffsetDateTime>get("createdAt"), end));
        }
        Specification<AuditLog> spec = Specification.allOf(parts);

        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        Page<AuditLog> result = auditLogRepository.findAll(spec,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return new AuditLogPageResponse(
                result.getContent().stream().map(AuditLogResponse::new).toList(),
                result.getTotalElements(), safePage, safeSize);
    }

    // The entries about one project: everything for an Administrator; for the project's Owner
    // only the ownership transfers (D-11). Anyone else is refused.
    @Transactional(readOnly = true)
    public List<AuditLogResponse> forProject(Long projectId, String callerUsername) {
        User caller = requireUser(callerUsername);
        boolean admin = projectAccessGuard.isAdmin(caller);
        boolean owner = projectAccessGuard.activeRole(caller, projectId).map("OWNER"::equals).orElse(false);
        if (!admin && !owner) {
            throw new AccessDeniedException("Only an Administrator or the project's Owner can read this");
        }
        Specification<AuditLog> spec = (root, q, cb) -> cb.equal(root.get("projectId"), projectId);
        if (!admin) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("action"), OWNERSHIP_TRANSFERRED));
        }
        return auditLogRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt", "id")).stream()
                .map(AuditLogResponse::new)
                .toList();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String truncate(String text, int max) {
        return text != null && text.length() > max ? text.substring(0, max) : text;
    }
}
