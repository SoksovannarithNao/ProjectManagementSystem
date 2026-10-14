package backend.controller;

import backend.dto.PendingInvitationCountResponse;
import backend.exception.NotFoundException;
import backend.service.MilestoneService;
import backend.service.ProjectMemberService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The milestone window the calendar asks for, and the team endpoints behind inviting, listing and
// cancelling an invitation.
@ExtendWith(MockitoExtension.class)
class MembersAndMilestonesControllerTest {

    @Mock
    private MilestoneService milestoneService;
    @Mock
    private ProjectMemberService projectMemberService;

    private MockMvc milestones;
    private MockMvc members;

    @BeforeEach
    void setUp() {
        milestones = ControllerTestSupport.mvcFor(new MilestoneController(milestoneService));
        members = ControllerTestSupport.mvcFor(new ProjectMemberController(projectMemberService));
    }

    // ---- milestones ----

    @Test
    void milestones_withoutAWindowAreAllOfThem_withOneTheDatesArePassedOn() throws Exception {
        when(milestoneService.getAllMilestones(any(), any(), any())).thenReturn(List.of());

        milestones.perform(get("/api/milestones").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        verify(milestoneService).getAllMilestones("pm.olivia", null, null);

        milestones.perform(get("/api/milestones?dueFrom=2026-10-12&dueTo=2026-10-18").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk());
        verify(milestoneService).getAllMilestones("pm.olivia", LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 18));

        milestones.perform(get("/api/milestones?dueFrom=2026-10-12").principal(ControllerTestSupport.CALLER)).andExpect(status().isOk());
        verify(milestoneService).getAllMilestones("pm.olivia", LocalDate.of(2026, 10, 12), null);
    }

    @Test
    void milestones_aBadDateIs400_andABackwardsWindowToo() throws Exception {
        milestones.perform(get("/api/milestones?dueFrom=soon").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid value for 'dueFrom'"));
        milestones.perform(get("/api/milestones?dueTo=2026-02-30").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest());
        verify(milestoneService, never()).getAllMilestones(any(), any(), any());

        when(milestoneService.getAllMilestones("pm.olivia", LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 10)))
                .thenThrow(new IllegalArgumentException("Invalid range: dueTo is before dueFrom"));
        milestones.perform(get("/api/milestones?dueFrom=2026-10-20&dueTo=2026-10-10").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid range: dueTo is before dueFrom"));
    }

    // ---- the team ----

    @Test
    void cancellingAnInvitation_isADeleteOfThePendingRow_andAnswersNoContent() throws Exception {
        members.perform(delete("/api/project-members/8").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        verify(projectMemberService).deleteProjectMember(8L, "pm.olivia");
    }

    @Test
    void cancellingSomethingThatIsNotThere_isA404_andANonNumberA400() throws Exception {
        doThrow(new NotFoundException("Project member not found")).when(projectMemberService).deleteProjectMember(99L, "pm.olivia");

        members.perform(delete("/api/project-members/99").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Project member not found"));
        members.perform(delete("/api/project-members/abc").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pendingInvitations_areListedAndCounted() throws Exception {
        when(projectMemberService.getPendingInvitations(10L, "pm.olivia")).thenReturn(List.of());
        when(projectMemberService.countPendingInvitations(10L, "pm.olivia")).thenReturn(new PendingInvitationCountResponse(3));

        members.perform(get("/api/project-members/project/10/invitations").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        members.perform(get("/api/project-members/project/10/invitations/count").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(3));
    }

    @Test
    void inviting_needsAProjectAndAUsername_andAKnownRole() throws Exception {
        members.perform(post("/api/project-members/invite").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectId\":10}").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.username").exists());
        members.perform(post("/api/project-members/invite").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projectId\":10,\"username\":\"dev.raj\",\"projectRole\":\"BOSS\"}").principal(ControllerTestSupport.CALLER))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.projectRole").value("Role must be OWNER, ADMIN, MEMBER or VIEWER"));
        verify(projectMemberService, never()).inviteMember(any(), any());
    }
}
