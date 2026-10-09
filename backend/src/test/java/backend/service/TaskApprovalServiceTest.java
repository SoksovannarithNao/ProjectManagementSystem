package backend.service;

import backend.dto.ApprovalDecisionRequest;
import backend.dto.TaskApprovalResponse;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskApproval;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.SubtaskRepository;
import backend.repository.TaskApprovalRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// The approval workflow (assignment-brief.md B3.8, D-05): who may submit and
// decide, what each decision does to the task, and the activity and
// notification that every step leaves.
@ExtendWith(MockitoExtension.class)
class TaskApprovalServiceTest {

    @Mock
    private TaskApprovalRepository approvalRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private TaskAssigneeRepository taskAssigneeRepository;
    @Mock
    private SubtaskRepository subtaskRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private NotificationService notificationService;
    @Mock
    private ActivityLogService activityLogService;

    private TaskApprovalService service;

    private User doer;       // a Team Member who did the work
    private User leader;     // a Team Leader (project role ADMIN) who may approve
    private User owner;      // the project Owner
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        service = new TaskApprovalService(approvalRepository, taskRepository, userRepository, projectMemberRepository,
                taskAssigneeRepository, subtaskRepository, projectAccessGuard, notificationService, activityLogService);

        doer = user(1L, "dev.chen", "Chen Doer");
        leader = user(2L, "lead.owen", "Owen Leader");
        owner = user(3L, "pm.olivia", "Olivia Owner");

        project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        project.setName("Website Redesign");
        project.setManager(owner);

        task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setProject(project);
        task.setTitle("Build the homepage");
        task.setStatus("IN_PROGRESS");

        lenient().when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        lenient().when(taskRepository.saveAndFlush(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(approvalRepository.save(any(TaskApproval.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(taskAssigneeRepository.findByTaskId(5L)).thenReturn(List.of());
        lenient().when(projectAccessGuard.hasAccess(any(User.class), eq(10L))).thenReturn(true);
    }

    private User user(Long id, String username, String fullName) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        u.setFullName(fullName);
        u.setAccountStatus("ACTIVE");
        lenient().when(userRepository.findByUsername(username)).thenReturn(Optional.of(u));
        lenient().when(userRepository.findById(id)).thenReturn(Optional.of(u));
        return u;
    }

    private void canApprove(User u, boolean allowed) {
        lenient().when(projectAccessGuard.can(u, 10L, Resource.TASK, Action.APPROVE)).thenReturn(allowed);
    }

    private void role(User u, String projectRole) {
        lenient().when(projectAccessGuard.activeRole(u, 10L)).thenReturn(Optional.ofNullable(projectRole));
    }

    private TaskApproval pendingRequestedBy(User requester) {
        TaskApproval a = new TaskApproval();
        a.setTask(task);
        a.setRequestedBy(requester);
        when(approvalRepository.findFirstByTaskIdAndDecision(5L, TaskApproval.PENDING)).thenReturn(Optional.of(a));
        return a;
    }

    private ApprovalDecisionRequest decision(String decision, String comment, String nextStatus) {
        ApprovalDecisionRequest r = new ApprovalDecisionRequest();
        r.setDecision(decision);
        r.setComment(comment);
        r.setNextStatus(nextStatus);
        return r;
    }

    // ---- submitting for review -----------------------------------------------

    @Test
    void anAssignedMember_submitsATaskForReview_andTheApproversAreTold() {
        when(projectAccessGuard.can(doer, 10L, Resource.TASK, Action.EDIT)).thenReturn(false);
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(true);
        when(approvalRepository.findFirstByTaskIdAndDecision(5L, TaskApproval.PENDING)).thenReturn(Optional.empty());
        ProjectMember leaderMembership = new ProjectMember();
        leaderMembership.setUser(leader);
        ProjectMember doerMembership = new ProjectMember();
        doerMembership.setUser(doer);
        when(projectMemberRepository.findByProjectIdAndStatus(10L, "ACTIVE"))
                .thenReturn(List.of(leaderMembership, doerMembership));
        canApprove(leader, true);
        canApprove(doer, false);

        TaskApprovalResponse response = service.submitForReview(5L, "dev.chen");

        assertThat(task.getStatus()).isEqualTo("IN_REVIEW");
        assertThat(response.getDecision()).isEqualTo("PENDING");
        assertThat(response.getRequestedBy().getUsername()).isEqualTo("dev.chen");
        verify(activityLogService).record(eq(doer), eq(task), eq("TASK_APPROVAL_REQUESTED"), any());
        verify(notificationService).notifyApprovalRequested(task, doer, List.of(leader));
    }

    @Test
    void whenAnApproverIsNamed_onlyTheyAreTold() {
        task.setApprover(owner);
        when(projectAccessGuard.can(doer, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);
        when(approvalRepository.findFirstByTaskIdAndDecision(5L, TaskApproval.PENDING)).thenReturn(Optional.empty());

        service.submitForReview(5L, "dev.chen");

        verify(notificationService).notifyApprovalRequested(task, doer, List.of(owner));
        verify(projectMemberRepository, never()).findByProjectIdAndStatus(any(), any());
    }

    @Test
    void onlyATaskInProgressCanBeSubmitted() {
        task.setStatus("TODO");
        when(projectAccessGuard.can(doer, 10L, Resource.TASK, Action.EDIT)).thenReturn(true);

        assertThatThrownBy(() -> service.submitForReview(5L, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("in progress");
        verify(approvalRepository, never()).save(any());
    }

    @Test
    void aMemberWhoIsNotAssigned_cannotSubmit() {
        when(projectAccessGuard.can(doer, 10L, Resource.TASK, Action.EDIT)).thenReturn(false);
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 1L)).thenReturn(false);

        assertThatThrownBy(() -> service.submitForReview(5L, "dev.chen"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("not assigned");
        assertThat(task.getStatus()).isEqualTo("IN_PROGRESS");
    }

    // ---- deciding --------------------------------------------------------------

    @Test
    void approving_completesTheTask_recordsTheDecision_andTellsTheRequester() {
        task.setStatus("IN_REVIEW");
        TaskApproval pending = pendingRequestedBy(doer);
        canApprove(leader, true);
        role(leader, "ADMIN");

        TaskApprovalResponse response = service.decide(5L, decision("APPROVED", "Looks good", null), "lead.owen");

        assertThat(task.getStatus()).isEqualTo("COMPLETED");
        assertThat(task.getProgress()).isEqualByComparingTo(new BigDecimal("100"));
        assertThat(pending.getDecision()).isEqualTo("APPROVED");
        assertThat(pending.getDecidedBy()).isSameAs(leader);
        assertThat(pending.getDecidedAt()).isNotNull();
        assertThat(response.getComment()).isEqualTo("Looks good");
        verify(activityLogService).record(eq(leader), eq(task), eq("TASK_APPROVED"), any());
        verify(notificationService).notifyApprovalDecided(task, doer, leader, "APPROVED", "Looks good");
    }

    @Test
    void approving_isRefusedWhileASubtaskIsOpen() {
        task.setStatus("IN_REVIEW");
        pendingRequestedBy(doer);
        canApprove(leader, true);
        role(leader, "ADMIN");
        when(subtaskRepository.existsByTaskIdAndStatusNot(5L, "COMPLETED")).thenReturn(true);

        assertThatThrownBy(() -> service.decide(5L, decision("APPROVED", null, null), "lead.owen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Complete all subtasks");
        assertThat(task.getStatus()).isEqualTo("IN_REVIEW");
    }

    @Test
    void requestingChanges_sendsTheTaskBackToInProgress_andNeedsAComment() {
        task.setStatus("IN_REVIEW");
        TaskApproval pending = pendingRequestedBy(doer);
        canApprove(leader, true);
        role(leader, "ADMIN");

        assertThatThrownBy(() -> service.decide(5L, decision("CHANGES_REQUESTED", "  ", null), "lead.owen"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(pending.getDecision()).isEqualTo("PENDING");

        service.decide(5L, decision("CHANGES_REQUESTED", "Fix the header", null), "lead.owen");

        assertThat(task.getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(pending.getDecision()).isEqualTo("CHANGES_REQUESTED");
        assertThat(pending.getComment()).isEqualTo("Fix the header");
        verify(activityLogService).record(eq(leader), eq(task), eq("TASK_CHANGES_REQUESTED"), any());
    }

    @Test
    void rejecting_needsAComment_andTheApproversChoiceOfWhatHappensNext() {
        task.setStatus("IN_REVIEW");
        TaskApproval pending = pendingRequestedBy(doer);
        canApprove(leader, true);
        role(leader, "ADMIN");

        assertThatThrownBy(() -> service.decide(5L, decision("REJECTED", null, "CANCELLED"), "lead.owen"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.decide(5L, decision("REJECTED", "Out of scope", null), "lead.owen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("In Progress or Cancelled");

        service.decide(5L, decision("REJECTED", "Out of scope", "CANCELLED"), "lead.owen");

        assertThat(task.getStatus()).isEqualTo("CANCELLED");
        assertThat(pending.getDecision()).isEqualTo("REJECTED");
        verify(activityLogService).record(eq(leader), eq(task), eq("TASK_REJECTED"), any());
        verify(notificationService).notifyApprovalDecided(task, doer, leader, "REJECTED", "Out of scope");
    }

    @Test
    void aRejectedTask_canBeReopenedInstead() {
        task.setStatus("IN_REVIEW");
        pendingRequestedBy(doer);
        canApprove(leader, true);
        role(leader, "ADMIN");

        service.decide(5L, decision("REJECTED", "Redo it", "IN_PROGRESS"), "lead.owen");

        assertThat(task.getStatus()).isEqualTo("IN_PROGRESS");
    }

    @Test
    void thereMustBeAnOpenRequestToDecide() {
        task.setStatus("IN_PROGRESS");
        when(approvalRepository.findFirstByTaskIdAndDecision(5L, TaskApproval.PENDING)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.decide(5L, decision("APPROVED", null, null), "lead.owen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no pending approval request");
    }

    // ---- who may decide ---------------------------------------------------------

    @Test
    void aMemberWithoutApprove_cannotDecide() {
        task.setStatus("IN_REVIEW");
        pendingRequestedBy(leader);
        canApprove(doer, false);

        assertThatThrownBy(() -> service.decide(5L, decision("APPROVED", null, null), "dev.chen"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("approve");
        assertThat(task.getStatus()).isEqualTo("IN_REVIEW");
    }

    @Test
    void aTeamLeader_cannotApproveTheirOwnRequest_butTheOwnerCan() {
        task.setStatus("IN_REVIEW");
        TaskApproval pending = pendingRequestedBy(leader);
        canApprove(leader, true);
        role(leader, "ADMIN");

        assertThatThrownBy(() -> service.decide(5L, decision("APPROVED", null, null), "lead.owen"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("your own work");
        assertThat(pending.getDecision()).isEqualTo("PENDING");

        // The Owner may approve work they asked for themselves.
        TaskApproval ownersOwn = pendingRequestedBy(owner);
        canApprove(owner, true);
        role(owner, "OWNER");
        service.decide(5L, decision("APPROVED", null, null), "pm.olivia");
        assertThat(ownersOwn.getDecision()).isEqualTo("APPROVED");
    }

    @Test
    void anAssigneeWhoIsATeamLeader_cannotApproveTheTaskTheyWorkOn() {
        task.setStatus("IN_REVIEW");
        pendingRequestedBy(doer);
        canApprove(leader, true);
        role(leader, "ADMIN");
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 2L)).thenReturn(true);

        assertThatThrownBy(() -> service.decide(5L, decision("APPROVED", null, null), "lead.owen"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("your own work");
    }

    @Test
    void whenAnApproverIsNamed_othersCannotDecide_exceptTheOwnerAndAdministrators() {
        task.setStatus("IN_REVIEW");
        task.setApprover(leader);
        TaskApproval pending = pendingRequestedBy(doer);
        User otherLeader = user(4L, "lead.priya", "Priya Leader");
        canApprove(otherLeader, true);
        role(otherLeader, "ADMIN");
        canApprove(owner, true);
        role(owner, "OWNER");

        assertThatThrownBy(() -> service.decide(5L, decision("APPROVED", null, null), "lead.priya"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Owen Leader is the approver named");

        service.decide(5L, decision("APPROVED", null, null), "pm.olivia");
        assertThat(pending.getDecision()).isEqualTo("APPROVED");
        assertThat(pending.getDecidedBy()).isSameAs(owner);
    }

    @Test
    void anAdministratorCanAlwaysDecide() {
        task.setStatus("IN_REVIEW");
        task.setApprover(leader);
        TaskApproval pending = pendingRequestedBy(leader);
        User admin = user(9L, "admin.system", "Ada Admin");
        canApprove(admin, true);
        when(projectAccessGuard.isAdmin(admin)).thenReturn(true);

        service.decide(5L, decision("APPROVED", null, null), "admin.system");

        assertThat(pending.getDecision()).isEqualTo("APPROVED");
    }

    @Test
    void decidingOnATaskInAProjectYouCannotSee_looksLikeAMissingProject() {
        task.setStatus("IN_REVIEW");
        org.mockito.Mockito.doThrow(new NotFoundException("Project not found"))
                .when(projectAccessGuard).assertAccess(leader, 10L);

        assertThatThrownBy(() -> service.decide(5L, decision("APPROVED", null, null), "lead.owen"))
                .isInstanceOf(NotFoundException.class);
    }

    // ---- hooks used by TaskService.updateTask ------------------------------------

    @Test
    void completingDirectly_withNoRequest_isRecordedAsTheApproversApproval() {
        when(approvalRepository.findFirstByTaskIdAndDecision(5L, TaskApproval.PENDING)).thenReturn(Optional.empty());

        service.recordDirectCompletion(task, owner);

        ArgumentCaptor<TaskApproval> saved = ArgumentCaptor.forClass(TaskApproval.class);
        verify(approvalRepository).save(saved.capture());
        assertThat(saved.getValue().getDecision()).isEqualTo("APPROVED");
        assertThat(saved.getValue().getDecidedBy()).isSameAs(owner);
        assertThat(saved.getValue().getRequestedBy()).isSameAs(owner);
        verify(activityLogService).record(eq(owner), eq(task), eq("TASK_APPROVED"), org.mockito.ArgumentMatchers.contains("completed directly"));
    }

    @Test
    void completingDirectly_closesTheOpenRequest() {
        TaskApproval pending = pendingRequestedBy(doer);

        service.recordDirectCompletion(task, owner);

        assertThat(pending.getDecision()).isEqualTo("APPROVED");
        assertThat(pending.getDecidedBy()).isSameAs(owner);
        verify(notificationService).notifyApprovalDecided(task, doer, owner, "APPROVED", null);
    }

    @Test
    void anOpenRequest_isWithdrawnWhenTheTaskLeavesReview() {
        TaskApproval pending = pendingRequestedBy(doer);

        service.withdrawPending(task, doer);

        assertThat(pending.getDecision()).isEqualTo("WITHDRAWN");
        assertThat(pending.getDecidedAt()).isNotNull();
        verify(notificationService, never()).notifyApprovalDecided(any(), any(), any(), any(), any());
    }

    @Test
    void openRequest_doesNotDuplicateAnExistingOne() {
        TaskApproval existing = pendingRequestedBy(doer);

        assertThat(service.openRequest(task, doer)).isSameAs(existing);
        verify(approvalRepository, never()).save(any());
    }

    @Test
    void assertMayDecide_appliesTheSameRulesToACompletionMadeThroughTheTaskEdit() {
        when(approvalRepository.findFirstByTaskIdAndDecision(5L, TaskApproval.PENDING)).thenReturn(Optional.empty());
        canApprove(leader, true);
        role(leader, "ADMIN");
        when(taskAssigneeRepository.existsByTaskIdAndUserId(5L, 2L)).thenReturn(true);

        assertThatThrownBy(() -> service.assertMayDecide(leader, task))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("your own work");
    }

    // ---- designating the approver --------------------------------------------------

    @Test
    void anOwnerOrLeader_namesAnApprover_whoMustBeAbleToApprove() {
        canApprove(leader, true);
        ProjectMember membership = new ProjectMember();
        membership.setUser(leader);
        membership.setStatus("ACTIVE");
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 2L)).thenReturn(Optional.of(membership));
        when(approvalRepository.findFirstByTaskIdAndDecision(5L, TaskApproval.PENDING)).thenReturn(Optional.empty());

        var response = service.designateApprover(5L, 2L, "pm.olivia");

        assertThat(task.getApprover()).isSameAs(leader);
        assertThat(response.getApprover().getUsername()).isEqualTo("lead.owen");
        verify(projectAccessGuard).assertCan(owner, 10L, Resource.TASK, Action.ASSIGN);
        verify(activityLogService).record(eq(owner), eq(task), eq("TASK_APPROVER_SET"), any());
    }

    @Test
    void aPersonWhoCannotApprove_cannotBeNamed() {
        canApprove(doer, false);
        ProjectMember membership = new ProjectMember();
        membership.setUser(doer);
        membership.setStatus("ACTIVE");
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 1L)).thenReturn(Optional.of(membership));

        assertThatThrownBy(() -> service.designateApprover(5L, 1L, "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot approve tasks");
        assertThat(task.getApprover()).isNull();
    }

    @Test
    void aNonMember_cannotBeNamed() {
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.designateApprover(5L, 2L, "pm.olivia"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void namingNobody_clearsTheApprover() {
        task.setApprover(leader);

        service.designateApprover(5L, null, "pm.olivia");

        assertThat(task.getApprover()).isNull();
    }

    @Test
    void namingAnApprover_forATaskAlreadyWaiting_tellsThem() {
        TaskApproval pending = pendingRequestedBy(doer);
        canApprove(leader, true);
        ProjectMember membership = new ProjectMember();
        membership.setUser(leader);
        membership.setStatus("ACTIVE");
        when(projectMemberRepository.findByProjectIdAndUserId(10L, 2L)).thenReturn(Optional.of(membership));

        service.designateApprover(5L, 2L, "pm.olivia");

        verify(notificationService).notifyApprovalRequested(eq(task), eq(pending.getRequestedBy()), anyList());
    }

    // ---- the approver's inbox ---------------------------------------------------------

    @Test
    void theInboxHoldsOnlyTheRequestsTheCallerMayDecide() {
        task.setStatus("IN_REVIEW");
        TaskApproval mine = new TaskApproval();
        mine.setTask(task);
        mine.setRequestedBy(doer);
        TaskApproval ownRequest = new TaskApproval();
        ownRequest.setTask(task);
        ownRequest.setRequestedBy(leader);
        canApprove(leader, true);
        role(leader, "ADMIN");
        when(approvalRepository.findByDecisionOrderByRequestedAtAsc(TaskApproval.PENDING))
                .thenReturn(List.of(mine, ownRequest));

        List<TaskApprovalResponse> inbox = service.getPendingForApprover("lead.owen");

        assertThat(inbox).hasSize(1);
        assertThat(inbox.get(0).getRequestedBy().getUsername()).isEqualTo("dev.chen");
        assertThat(inbox.get(0).getTaskTitle()).isEqualTo("Build the homepage");
    }
}
