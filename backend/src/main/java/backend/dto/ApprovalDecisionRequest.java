package backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// An approver's decision on a pending review request (TaskApprovalService.decide).
public class ApprovalDecisionRequest {

    @NotBlank
    @Pattern(regexp = "APPROVED|CHANGES_REQUESTED|REJECTED")
    private String decision;

    // Required for CHANGES_REQUESTED and REJECTED; optional for APPROVED.
    @Size(max = 1000)
    private String comment;

    // Only for REJECTED: where the task goes next (D-05). Defaults are not
    // guessed - the approver has to choose.
    @Pattern(regexp = "IN_PROGRESS|CANCELLED")
    private String nextStatus;

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getNextStatus() {
        return nextStatus;
    }

    public void setNextStatus(String nextStatus) {
        this.nextStatus = nextStatus;
    }
}
