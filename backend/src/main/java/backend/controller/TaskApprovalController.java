package backend.controller;

import backend.dto.ApprovalDecisionRequest;
import backend.dto.ApproverRequest;
import backend.dto.TaskApprovalResponse;
import backend.dto.TaskResponse;
import backend.service.TaskApprovalService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// The approval workflow of a task (assignment-brief.md B3.8). Every rule -
// who may submit, who may decide, the named approver - is enforced in
// TaskApprovalService; the controller only routes.
@RestController
@RequestMapping("/api")
public class TaskApprovalController {

    private final TaskApprovalService approvalService;

    public TaskApprovalController(TaskApprovalService approvalService) {
        this.approvalService = approvalService;
    }

    // Every request and decision on the task, newest first.
    @GetMapping("/tasks/{taskId}/approvals")
    public List<TaskApprovalResponse> getHistory(@PathVariable Long taskId, Authentication authentication) {
        return approvalService.getHistory(taskId, authentication.getName());
    }

    // Move an In Progress task to In Review and ask for a decision.
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/tasks/{taskId}/approval/submit")
    public TaskApprovalResponse submit(@PathVariable Long taskId, Authentication authentication) {
        return approvalService.submitForReview(taskId, authentication.getName());
    }

    // Approve (the task is completed), request changes, or reject.
    @PostMapping("/tasks/{taskId}/approval/decision")
    public TaskApprovalResponse decide(
            @PathVariable Long taskId,
            @Valid @RequestBody ApprovalDecisionRequest request,
            Authentication authentication) {
        return approvalService.decide(taskId, request, authentication.getName());
    }

    // Name (or, with a null approverId, clear) the approver of one task.
    @PutMapping("/tasks/{taskId}/approver")
    public TaskResponse designateApprover(
            @PathVariable Long taskId,
            @RequestBody ApproverRequest request,
            Authentication authentication) {
        return approvalService.designateApprover(taskId, request.getApproverId(), authentication.getName());
    }

    // The open requests the caller may decide.
    @GetMapping("/approvals/pending")
    public List<TaskApprovalResponse> getPending(Authentication authentication) {
        return approvalService.getPendingForApprover(authentication.getName());
    }
}
