package backend.service;

import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Role;
import backend.entity.User;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// A project has exactly one OWNER and that person is also its manager
// (ADR-0015). ProjectOwnership is the single place that moves ownership.
@ExtendWith(MockitoExtension.class)
class ProjectOwnershipTest {

    @Mock
    private ProjectMemberRepository memberRepository;
    @Mock
    private ProjectRepository projectRepository;

    private ProjectOwnership ownership;
    private Project project;

    @BeforeEach
    void setUp() {
        ownership = new ProjectOwnership(memberRepository, projectRepository);
        project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        lenient().when(memberRepository.save(any(ProjectMember.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(Long id, String name, String systemRole) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setFullName(name);
        u.setUsername(name);
        if (systemRole != null) {
            Role role = new Role();
            role.setName(systemRole);
            u.setRole(role);
        }
        return u;
    }

    private ProjectMember member(Long id, User user, String projectRole, String status) {
        ProjectMember m = new ProjectMember();
        ReflectionTestUtils.setField(m, "id", id);
        m.setProject(project);
        m.setUser(user);
        m.setProjectRole(projectRole);
        m.setStatus(status);
        return m;
    }

    @Test
    void onlyAProjectManagerOrAnAdministratorCanOwnAProject() {
        assertThat(ProjectOwnership.canOwnProjects(user(1L, "a", "PROJECT_MANAGER"))).isTrue();
        assertThat(ProjectOwnership.canOwnProjects(user(2L, "b", "ADMINISTRATOR"))).isTrue();
        assertThat(ProjectOwnership.canOwnProjects(user(3L, "c", "USER"))).isFalse();
        assertThat(ProjectOwnership.canOwnProjects(user(4L, "d", null))).isFalse();
    }

    @Test
    void assignOwner_addsTheCreatorAsAnActiveOwner_andAsManager() {
        User creator = user(1L, "pm.olivia", "PROJECT_MANAGER");
        when(memberRepository.findByProjectIdAndUserId(10L, 1L)).thenReturn(Optional.empty());
        when(memberRepository.findFirstByProjectIdAndProjectRoleAndStatus(10L, "OWNER", "ACTIVE")).thenReturn(Optional.empty());

        ProjectMember owner = ownership.assignOwner(project, creator);

        assertThat(owner.getProjectRole()).isEqualTo("OWNER");
        assertThat(owner.getStatus()).isEqualTo("ACTIVE");
        assertThat(project.getManager()).isSameAs(creator);
    }

    @Test
    void transfer_demotesThePreviousOwnerToTeamLeader() {
        User oldOwner = user(1L, "pm.olivia", "PROJECT_MANAGER");
        User next = user(2L, "pm.marcus", "PROJECT_MANAGER");
        ProjectMember oldRow = member(5L, oldOwner, "OWNER", "ACTIVE");
        ProjectMember nextRow = member(7L, next, "MEMBER", "ACTIVE");
        when(memberRepository.findFirstByProjectIdAndProjectRoleAndStatus(10L, "OWNER", "ACTIVE")).thenReturn(Optional.of(oldRow));

        ownership.transfer(project, nextRow);

        assertThat(oldRow.getProjectRole()).isEqualTo("ADMIN");
        assertThat(nextRow.getProjectRole()).isEqualTo("OWNER");
        assertThat(project.getManager()).isSameAs(next);
    }

    @Test
    void transfer_toTheCurrentOwner_changesNothing() {
        User owner = user(1L, "pm.olivia", "PROJECT_MANAGER");
        ProjectMember row = member(5L, owner, "OWNER", "ACTIVE");
        when(memberRepository.findFirstByProjectIdAndProjectRoleAndStatus(10L, "OWNER", "ACTIVE")).thenReturn(Optional.of(row));

        ownership.transfer(project, row);

        assertThat(row.getProjectRole()).isEqualTo("OWNER");
        verify(memberRepository, never()).save(any());
    }

    @Test
    void transfer_refusesAPlainUser_andAPendingMember() {
        ProjectMember plain = member(7L, user(3L, "dev.chen", "USER"), "ADMIN", "ACTIVE");
        assertThatThrownBy(() -> ownership.transfer(project, plain))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot own a project");

        ProjectMember pending = member(8L, user(4L, "pm.priya", "PROJECT_MANAGER"), "MEMBER", "PENDING");
        assertThatThrownBy(() -> ownership.transfer(project, pending))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("active member");
        verify(memberRepository, never()).save(any());
    }
}
