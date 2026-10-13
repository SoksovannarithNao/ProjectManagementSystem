package backend.service;

import backend.dto.AuditLogPageResponse;
import backend.dto.AuditLogResponse;
import backend.entity.AuditLog;
import backend.entity.User;
import backend.repository.AuditLogRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The administrator audit log (#44): who is recorded as the actor, who may read it, and the
// page limits. What each audited action records is tested with the service that does it.
@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private AuditLogService service;
    private User admin;
    private User stranger;

    @BeforeEach
    void setUp() {
        service = new AuditLogService(auditLogRepository, userRepository, projectAccessGuard);
        admin = user(1L, "admin.system", "System Administrator");
        stranger = user(2L, "dev.chen", "Chen Wu");
        lenient().when(projectAccessGuard.isAdmin(admin)).thenReturn(true);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private User user(Long id, String username, String fullName) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        u.setFullName(fullName);
        lenient().when(userRepository.findByUsername(username)).thenReturn(Optional.of(u));
        return u;
    }

    private AuditLog saved() {
        ArgumentCaptor<AuditLog> entry = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogRepository).save(entry.capture());
        return entry.getValue();
    }

    @Test
    void anActionIsRecordedAgainstWhoeverIsSignedIn_withTheValuesBeforeAndAfter() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("admin.system", "n/a", List.of()));

        service.record(AuditLogService.USER_ROLE_CHANGED, AuditLogService.USER, 50L, "Bob (@bob)", null, "USER", "PROJECT_MANAGER");

        AuditLog entry = saved();
        assertThat(entry.getActorId()).isEqualTo(1L);
        assertThat(entry.getActorName()).isEqualTo("System Administrator");
        assertThat(entry.getAction()).isEqualTo("USER_ROLE_CHANGED");
        assertThat(entry.getTargetType()).isEqualTo("USER");
        assertThat(entry.getTargetId()).isEqualTo(50L);
        assertThat(entry.getTargetLabel()).isEqualTo("Bob (@bob)");
        assertThat(entry.getBeforeValue()).isEqualTo("USER");
        assertThat(entry.getAfterValue()).isEqualTo("PROJECT_MANAGER");
    }

    @Test
    void withNobodySignedIn_theActorIsTheSystem() {
        service.record(AuditLogService.ACCOUNT_DELETED, AuditLogService.USER, 50L, "Bob", null, "x", null);

        AuditLog entry = saved();
        assertThat(entry.getActorId()).isNull();
        assertThat(entry.getActorName()).isEqualTo("System");
    }

    @Test
    void anExplicitActorIsUsed_forActionsWithoutASession() {
        service.record(stranger, AuditLogService.ACCOUNT_CREATED, AuditLogService.USER, 2L, "Chen Wu", null, null, "role USER");

        assertThat(saved().getActorName()).isEqualTo("Chen Wu");
    }

    @Test
    void aLongTargetLabel_isCutToFitTheColumn() {
        service.record(AuditLogService.ROLE_CREATED, AuditLogService.ROLE, 9L, "x".repeat(400), null, null, null);

        assertThat(saved().getTargetLabel()).hasSize(255);
    }

    @Test
    void onlyAnAdministratorCanSearchTheLog() {
        assertThatThrownBy(() -> service.search("dev.chen", null, null, null, null, null, 0, 25))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Only an Administrator");
        verify(auditLogRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void thePageSizeIsCapped_andTheTotalIsReported() {
        AuditLog row = new AuditLog();
        row.setActorName("System Administrator");
        row.setAction("ACCOUNT_DELETED");
        row.setTargetType("USER");
        when(auditLogRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<>(List.of(row), inv.getArgument(1), 500));

        AuditLogPageResponse page = service.search("admin.system", "ACCOUNT_DELETED", "USER", "bob", null, null, -3, 5000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(auditLogRepository).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(page.getTotal()).isEqualTo(500);
        assertThat(page.getItems()).hasSize(1);
        assertThat(page.getItems().get(0).getAction()).isEqualTo("ACCOUNT_DELETED");
    }

    @Test
    @SuppressWarnings("unchecked")
    void aProjectsLog_isForAnAdministratorOrTheProjectsOwner_andNobodyElse() {
        when(auditLogRepository.findAll(any(Specification.class), any(org.springframework.data.domain.Sort.class)))
                .thenReturn(List.of());
        lenient().when(projectAccessGuard.activeRole(stranger, 10L)).thenReturn(Optional.of("ADMIN"));

        assertThat(service.forProject(10L, "admin.system")).isEmpty();
        assertThatThrownBy(() -> service.forProject(10L, "dev.chen")).isInstanceOf(AccessDeniedException.class);

        User owner = user(3L, "pm.olivia", "Olivia Bennett");
        lenient().when(projectAccessGuard.activeRole(owner, 10L)).thenReturn(Optional.of("OWNER"));
        List<AuditLogResponse> ownersView = service.forProject(10L, "pm.olivia");
        assertThat(ownersView).isEmpty();
    }
}
