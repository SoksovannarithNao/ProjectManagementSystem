package backend.service;

import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Role;
import backend.entity.User;
import backend.repository.ProjectMemberRepository;
import backend.repository.RolePermissionRepository;
import backend.repository.RolePermissionRepository.GrantRow;
import backend.repository.RoleRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

// The role x resource x action matrix is data (role_permissions), so the test
// reads the SAME matrix the database is built from - the VALUES list in
// migration V10 (the two-level role model, ADR-0015) - and checks PermissionService answers every one of the
// roles x scopes x resources x actions exactly as that list says. If the SQL
// and the enforcement ever disagree, this fails. A handful of hand-written
// assertions below it pin the intent, so a wrong edit to the SQL cannot make
// the generated check pass by accident.
@ExtendWith(MockitoExtension.class)
class PermissionServiceTest {

    // The matrix is V10's, plus the resources later migrations added (V13: ATTACHMENT, CHECKLIST_ITEM).
    private static final List<Path> MATRIX_SQL = List.of(
            Path.of("..", "database", "taskmanager", "migrations", "V10__two_level_roles.sql"),
            Path.of("..", "database", "taskmanager", "migrations", "V13__attachments_checklists.sql"));

    private static final Pattern ROW = Pattern.compile(
            "\\('(\\w+)',\\s*'(SYSTEM|PROJECT)',\\s*'(\\w+)',\\s*ARRAY\\[([^\\]]*)\\]\\)");

    // role -> project role, as in the roles table. System roles have none;
    // each project role stands for itself.
    private static final String[][] ROLES = {
            {"ADMINISTRATOR", null}, {"PROJECT_MANAGER", null}, {"USER", null},
            {"OWNER", "OWNER"}, {"ADMIN", "ADMIN"}, {"MEMBER", "MEMBER"}, {"VIEWER", "VIEWER"}};

    private record Row(String role, String scope, String resource, String permission) {
    }

    @Mock
    private RolePermissionRepository rolePermissionRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;

    private PermissionService service;
    private List<Row> matrix;

    @BeforeEach
    void setUp() throws IOException {
        matrix = readMatrix();
        List<GrantRow> grantRows = new ArrayList<>();
        for (Row r : matrix) {
            grantRows.add(new GrantRow() {
                public String getRoleName() { return r.role(); }
                public String getScope() { return r.scope(); }
                public String getResource() { return r.resource(); }
                public String getPermissionCode() { return r.permission(); }
            });
        }
        lenient().when(rolePermissionRepository.findAllGrants()).thenReturn(grantRows);

        List<Role> roles = new ArrayList<>();
        for (String[] r : ROLES) {
            Role role = new Role();
            role.setName(r[0]);
            role.setProjectRole(r[1]);
            roles.add(role);
        }
        lenient().when(roleRepository.findAll()).thenReturn(roles);

        service = new PermissionService(rolePermissionRepository, roleRepository, projectMemberRepository);
    }

    private static List<Row> readMatrix() throws IOException {
        List<Row> rows = new ArrayList<>();
        for (Path file : MATRIX_SQL) {
            Matcher m = ROW.matcher(Files.readString(file));
            while (m.find()) {
                for (String perm : m.group(4).split(",")) {
                    rows.add(new Row(m.group(1), m.group(2), m.group(3), perm.replace("'", "").trim()));
                }
            }
        }
        return rows;
    }

    private User userWithSystemRole(Long id, String roleName) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        if (roleName != null) {
            Role role = new Role();
            role.setName(roleName);
            u.setRole(role);
        }
        return u;
    }

    private void memberOf(User user, Long projectId, String projectRole, String status) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", projectId);
        ProjectMember pm = new ProjectMember();
        pm.setProject(p);
        pm.setUser(user);
        pm.setProjectRole(projectRole);
        pm.setStatus(status);
        lenient().when(projectMemberRepository.findByProjectIdAndUserId(projectId, user.getId()))
                .thenReturn(Optional.of(pm));
    }

    // ---- the whole matrix, generated from the SQL ------------------------

    @Test
    void theMatrixInTheMigrationIsLoadedAndNotEmpty() {
        assertThat(matrix).hasSizeGreaterThan(150);
    }

    @Test
    void everyProjectGrantInTheMatrix_isAllowedExactlyAsListed() {
        Set<String> listed = new HashSet<>();
        matrix.stream().filter(r -> r.scope().equals("PROJECT"))
                .forEach(r -> listed.add(r.role() + "|" + r.resource() + "|" + r.permission()));

        for (String[] role : ROLES) {
            if (role[1] == null) {
                continue; // ADMINISTRATOR has no project role: it bypasses membership
            }
            User user = userWithSystemRole(100L, null);
            memberOf(user, 10L, role[1], "ACTIVE");
            for (Resource resource : Resource.values()) {
                for (Action action : Action.values()) {
                    boolean expected = listed.contains(role[0] + "|" + resource + "|" + action);
                    assertThat(service.projectCan(user, 10L, resource, action))
                            .as("%s in a project: %s %s", role[0], action, resource)
                            .isEqualTo(expected);
                }
            }
        }
    }

    @Test
    void everySystemGrantInTheMatrix_isAllowedExactlyAsListed() {
        Set<String> listed = new HashSet<>();
        matrix.stream().filter(r -> r.scope().equals("SYSTEM"))
                .forEach(r -> listed.add(r.role() + "|" + r.resource() + "|" + r.permission()));

        for (String[] role : ROLES) {
            if (role[0].equals("ADMINISTRATOR") || role[1] != null) {
                continue; // administrator is allowed everything; project roles are not system roles
            }
            User user = userWithSystemRole(101L, role[0]);
            for (Resource resource : Resource.values()) {
                for (Action action : Action.values()) {
                    boolean expected = listed.contains(role[0] + "|" + resource + "|" + action);
                    assertThat(service.systemCan(user, resource, action))
                            .as("%s system-wide: %s %s", role[0], action, resource)
                            .isEqualTo(expected);
                }
            }
        }
    }

    // ---- intent, written by hand so a bad edit to the SQL cannot hide ----

    @Test
    void administrator_canDoEverythingEverywhere_withoutAnyMembership() {
        User admin = userWithSystemRole(1L, "ADMINISTRATOR");
        for (Resource resource : Resource.values()) {
            for (Action action : Action.values()) {
                assertThat(service.systemCan(admin, resource, action)).isTrue();
                assertThat(service.projectCan(admin, 999L, resource, action)).isTrue();
            }
        }
    }

    @Test
    void onlyProjectManagerAndAdministrator_canCreateAProject() {
        assertThat(service.systemCan(userWithSystemRole(2L, "PROJECT_MANAGER"), Resource.PROJECT, Action.CREATE)).isTrue();
        assertThat(service.systemCan(userWithSystemRole(4L, "USER"), Resource.PROJECT, Action.CREATE)).isFalse();
        assertThat(service.systemCan(userWithSystemRole(5L, null), Resource.PROJECT, Action.CREATE)).isFalse();
    }

    @Test
    void teamMember_canWorkButNotPlanOrApprove() {
        User member = userWithSystemRole(6L, "USER");
        memberOf(member, 10L, "MEMBER", "ACTIVE");

        assertThat(service.projectCan(member, 10L, Resource.TASK_STATUS, Action.EDIT)).isTrue();
        assertThat(service.projectCan(member, 10L, Resource.SUBTASK, Action.CREATE)).isTrue();
        assertThat(service.projectCan(member, 10L, Resource.WORK_LOG, Action.CREATE)).isTrue();

        assertThat(service.projectCan(member, 10L, Resource.TASK, Action.CREATE)).as("Team Members do not create tasks").isFalse();
        assertThat(service.projectCan(member, 10L, Resource.SUBTASK, Action.DELETE)).isFalse();
        assertThat(service.projectCan(member, 10L, Resource.REPORT, Action.GENERATE_REPORTS)).isFalse();
        assertThat(service.projectCan(member, 10L, Resource.TASK, Action.APPROVE)).isFalse();
        assertThat(service.projectCan(member, 10L, Resource.TASK, Action.EDIT)).isFalse();
        assertThat(service.projectCan(member, 10L, Resource.TASK, Action.ASSIGN)).isFalse();
        assertThat(service.projectCan(member, 10L, Resource.MILESTONE, Action.CREATE)).isFalse();
        assertThat(service.projectCan(member, 10L, Resource.MEMBER, Action.CREATE)).isFalse();
        assertThat(service.projectCan(member, 10L, Resource.PROJECT, Action.EDIT)).isFalse();
    }

    @Test
    void teamLeader_canApproveAndAssign_butNotDeleteTheProjectOrGrantProjectManager() {
        User leader = userWithSystemRole(7L, "USER"); // the system role does not matter inside a project
        memberOf(leader, 10L, "ADMIN", "ACTIVE");

        assertThat(service.projectCan(leader, 10L, Resource.TASK, Action.APPROVE)).isTrue();
        assertThat(service.projectCan(leader, 10L, Resource.TASK, Action.ASSIGN)).isTrue();
        assertThat(service.projectCan(leader, 10L, Resource.MILESTONE, Action.CREATE)).isTrue();
        assertThat(service.projectCan(leader, 10L, Resource.PROJECT, Action.EDIT)).isTrue();
        // may delete work items and remove members (D-01), and generate reports for the project
        assertThat(service.projectCan(leader, 10L, Resource.TASK, Action.DELETE)).isTrue();
        assertThat(service.projectCan(leader, 10L, Resource.MEMBER, Action.DELETE)).isTrue();
        assertThat(service.projectCan(leader, 10L, Resource.REPORT, Action.GENERATE_REPORTS)).isTrue();

        assertThat(service.projectCan(leader, 10L, Resource.PROJECT, Action.DELETE)).isFalse();
        assertThat(service.projectCan(leader, 10L, Resource.PROJECT, Action.ASSIGN)).isFalse();
    }

    @Test
    void projectManager_holdsEverythingInTheirProject() {
        User manager = userWithSystemRole(8L, "PROJECT_MANAGER");
        memberOf(manager, 10L, "OWNER", "ACTIVE");

        assertThat(service.projectCan(manager, 10L, Resource.PROJECT, Action.DELETE)).isTrue();
        assertThat(service.projectCan(manager, 10L, Resource.PROJECT, Action.ASSIGN)).isTrue();
        assertThat(service.projectCan(manager, 10L, Resource.TASK, Action.APPROVE)).isTrue();
    }

    @Test
    void viewer_canOnlyView() {
        User viewer = userWithSystemRole(9L, "USER");
        memberOf(viewer, 10L, "VIEWER", "ACTIVE");

        assertThat(service.projectCan(viewer, 10L, Resource.TASK, Action.VIEW)).isTrue();
        for (Resource resource : Resource.values()) {
            for (Action action : Action.values()) {
                if (action != Action.VIEW) {
                    assertThat(service.projectCan(viewer, 10L, resource, action))
                            .as("viewer %s %s", action, resource).isFalse();
                }
            }
        }
    }

    @Test
    void aPendingInvitation_andNonMembership_grantNothing() {
        User invitee = userWithSystemRole(10L, "USER");
        memberOf(invitee, 10L, "ADMIN", "PENDING");
        User stranger = userWithSystemRole(11L, "USER");

        assertThat(service.projectCan(invitee, 10L, Resource.TASK, Action.VIEW)).isFalse();
        assertThat(service.projectCan(stranger, 10L, Resource.TASK, Action.VIEW)).isFalse();
        assertThat(service.projectCan(stranger, 99L, Resource.TASK, Action.CREATE)).isFalse();
    }

    @Test
    void theSameUserHasDifferentPowerInDifferentProjects() {
        User user = userWithSystemRole(12L, "PROJECT_MANAGER");
        memberOf(user, 10L, "OWNER", "ACTIVE");
        memberOf(user, 20L, "VIEWER", "ACTIVE");

        assertThat(service.projectCan(user, 10L, Resource.TASK, Action.DELETE)).isTrue();
        assertThat(service.projectCan(user, 20L, Resource.TASK, Action.DELETE)).isFalse();
    }

    @Test
    void reportsNeedGenerateReports_throughTheSystemRoleOrTheProjectRole() {
        // cross-project reports: Project Manager (and Administrator)
        assertThat(service.systemCan(userWithSystemRole(13L, "PROJECT_MANAGER"), Resource.REPORT, Action.GENERATE_REPORTS)).isTrue();
        assertThat(service.systemCan(userWithSystemRole(15L, "USER"), Resource.REPORT, Action.GENERATE_REPORTS)).isFalse();
        // a Team Leader gets reports through the project role, not through a system role
        User leader = userWithSystemRole(14L, "USER");
        memberOf(leader, 10L, "ADMIN", "ACTIVE");
        assertThat(service.systemCan(leader, Resource.REPORT, Action.GENERATE_REPORTS)).isFalse();
        assertThat(service.projectCan(leader, 10L, Resource.REPORT, Action.GENERATE_REPORTS)).isTrue();
    }

    @Test
    void aSystemRoleNeverWidensAProjectRole() {
        // A Project Manager who is only a Viewer of a project can read it and nothing else (D-02).
        User manager = userWithSystemRole(18L, "PROJECT_MANAGER");
        memberOf(manager, 20L, "VIEWER", "ACTIVE");
        assertThat(service.projectCan(manager, 20L, Resource.TASK, Action.VIEW)).isTrue();
        assertThat(service.projectCan(manager, 20L, Resource.TASK, Action.EDIT)).isFalse();
        assertThat(service.projectCan(manager, 20L, Resource.PROJECT, Action.DELETE)).isFalse();
    }

    @Test
    void effectivePermissions_listWhatTheUserHoldsPerProject() {
        User user = userWithSystemRole(16L, "USER");
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", 10L);
        ProjectMember pm = new ProjectMember();
        pm.setProject(p);
        pm.setUser(user);
        pm.setProjectRole("MEMBER");
        pm.setStatus("ACTIVE");
        lenient().when(projectMemberRepository.findByUserId(16L)).thenReturn(List.of(pm));

        var response = service.effectiveFor(user);

        assertThat(response.isAdministrator()).isFalse();
        assertThat(response.getRole()).isEqualTo("USER");
        assertThat(response.getProjects()).hasSize(1);
        assertThat(response.getProjects().get(0).getRoleName()).isEqualTo("MEMBER");
        assertThat(response.getProjects().get(0).getGrants())
                .contains("SUBTASK:CREATE").doesNotContain("TASK:CREATE", "TASK:APPROVE");
    }

    @Test
    void refresh_makesTheNextAnswerReadTheMatrixAgain() {
        User manager = userWithSystemRole(17L, "PROJECT_MANAGER");
        assertThat(service.systemCan(manager, Resource.PROJECT, Action.CREATE)).isTrue();

        lenient().when(rolePermissionRepository.findAllGrants()).thenReturn(List.of());
        assertThat(service.systemCan(manager, Resource.PROJECT, Action.CREATE)).as("cached until refreshed").isTrue();

        service.refresh();
        assertThat(service.systemCan(manager, Resource.PROJECT, Action.CREATE)).isFalse();
    }
}
