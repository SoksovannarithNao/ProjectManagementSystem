package backend.dto;

// Names (or, with a null id, clears) the approver of one task.
public class ApproverRequest {

    private Long approverId;

    public Long getApproverId() {
        return approverId;
    }

    public void setApproverId(Long approverId) {
        this.approverId = approverId;
    }
}
