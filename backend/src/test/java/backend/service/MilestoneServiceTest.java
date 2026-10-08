package backend.service;

import backend.dto.MilestoneRequest;
import backend.entity.Milestone;
import backend.entity.Project;
import backend.entity.User;
import backend.repository.MilestoneRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MilestoneServiceTest {

    @Mock
    private MilestoneRepository milestoneRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private MilestoneService service;
    private User caller;
    private Milestone milestone;

    @BeforeEach
    void setUp() {
        service = new MilestoneService(
                milestoneRepository, projectRepository, projectMemberRepository, userRepository, projectAccessGuard);
        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 1L);
        caller.setUsername("pm.olivia");
        when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));

        milestone = new Milestone();
        ReflectionTestUtils.setField(milestone, "id", 3L);
        milestone.setProject(project(10L));
        milestone.setTitle("Beta");
        when(milestoneRepository.findById(3L)).thenReturn(Optional.of(milestone));
    }

    private Project project(Long id) {
        Project p = new Project();
        ReflectionTestUtils.setField(p, "id", id);
        User manager = new User();
        ReflectionTestUtils.setField(manager, "id", 99L);
        p.setManager(manager);
        return p;
    }

    private MilestoneRequest request(Long projectId, String title) {
        MilestoneRequest r = new MilestoneRequest();
        r.setProjectId(projectId);
        r.setTitle(title);
        r.setDueDate(LocalDate.of(2026, 11, 1));
        return r;
    }

    @Test
    void manager_cannotMoveAMilestoneIntoAProjectTheyDoNotManage() {
        lenient().doThrow(new AccessDeniedException("no")).when(projectAccessGuard).assertCan(caller, 20L, Resource.MILESTONE, Action.EDIT);

        assertThatThrownBy(() -> service.updateMilestone(3L, request(20L, "Beta"), "pm.olivia"))
                .isInstanceOf(AccessDeniedException.class);

        verify(milestoneRepository, never()).save(any());
        assertThat(milestone.getProject().getId()).isEqualTo(10L);
    }

    @Test
    void manager_canEditAMilestoneInPlace() {
        when(milestoneRepository.save(any(Milestone.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(milestone.getProject()));

        service.updateMilestone(3L, request(10L, "Beta renamed"), "pm.olivia");

        verify(projectAccessGuard).assertCan(caller, 10L, Resource.MILESTONE, Action.EDIT);
        verify(projectAccessGuard, never()).assertCan(caller, 20L, Resource.MILESTONE, Action.EDIT);
        assertThat(milestone.getTitle()).isEqualTo("Beta renamed");
    }
}
