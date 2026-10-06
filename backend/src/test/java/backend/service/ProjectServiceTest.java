package backend.service;

import backend.dto.ProjectRequest;
import backend.dto.ProjectResponse;
import backend.entity.Project;
import backend.entity.User;
import backend.exception.ConflictException;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private ProjectService projectService;

    private User caller;

    @BeforeEach
    void setUp() {
        projectService = new ProjectService(projectRepository, projectMemberRepository, userRepository, projectAccessGuard);
        caller = new User();
        ReflectionTestUtils.setField(caller, "id", 7L);
        caller.setUsername("pm.olivia");
        when(userRepository.findByUsername("pm.olivia")).thenReturn(Optional.of(caller));
    }

    private ProjectRequest request(String code) {
        ProjectRequest r = new ProjectRequest();
        r.setProjectCode(code);
        r.setName("Demo");
        r.setStartDate(LocalDate.of(2026, 10, 1));
        r.setEndDate(LocalDate.of(2026, 12, 31));
        return r;
    }

    private Project existingProject() {
        Project existing = new Project();
        ReflectionTestUtils.setField(existing, "id", 5L);
        existing.setProjectCode("PRJ-2005");
        existing.setManager(caller);
        return existing;
    }

    private void stubSave() {
        when(projectRepository.save(any(Project.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectMemberRepository.existsByProjectIdAndUserId(any(), any())).thenReturn(true);
    }

    @Test
    void create_withACodeThatAlreadyExists_isRejectedWith409AndNothingIsSaved() {
        when(projectRepository.existsByProjectCode("PRJ-2001")).thenReturn(true);

        assertThatThrownBy(() -> projectService.createProject(request("PRJ-2001"), "pm.olivia"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Project code already exists.");
        verify(projectRepository, never()).save(any());
    }

    @Test
    void create_trimsTheCodeBeforeCheckingAndSaving() {
        when(projectRepository.existsByProjectCode("WEB-RD")).thenReturn(false);
        stubSave();

        ProjectResponse response = projectService.createProject(request("  WEB-RD  "), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("WEB-RD");
    }

    @Test
    void create_withoutACode_generatesTheNextPrjNumber() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of("PRJ-2001", "PRJ-2010", "PRJ-0003"));
        stubSave();

        ProjectResponse response = projectService.createProject(request(null), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("PRJ-2011");
    }

    @Test
    void create_withABlankCode_isTreatedAsNoCode() {
        when(projectRepository.findAutoProjectCodes()).thenReturn(List.of());
        stubSave();

        ProjectResponse response = projectService.createProject(request("   "), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("PRJ-0001");
        verify(projectRepository, never()).existsByProjectCode(any());
    }

    @Test
    void update_toACodeUsedByAnotherProject_isRejectedWith409() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2001", 5L)).thenReturn(true);

        assertThatThrownBy(() -> projectService.updateProject(5L, request("PRJ-2001"), "pm.olivia"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Project code already exists.");
        verify(projectRepository, never()).save(any());
    }

    @Test
    void update_keepingItsOwnCode_isAllowed() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        when(projectRepository.existsByProjectCodeAndIdNot("PRJ-2005", 5L)).thenReturn(false);
        stubSave();

        ProjectResponse response = projectService.updateProject(5L, request("PRJ-2005"), "pm.olivia");

        assertThat(response.getProjectCode()).isEqualTo("PRJ-2005");
    }

    @Test
    void update_withABlankCode_keepsTheExistingOne() {
        when(projectRepository.findById(5L)).thenReturn(Optional.of(existingProject()));
        stubSave();

        ProjectResponse response = projectService.updateProject(5L, request(null), "pm.olivia");

        ArgumentCaptor<Project> saved = ArgumentCaptor.forClass(Project.class);
        verify(projectRepository).save(saved.capture());
        assertThat(saved.getValue().getProjectCode()).isEqualTo("PRJ-2005");
        assertThat(response.getProjectCode()).isEqualTo("PRJ-2005");
    }
}
