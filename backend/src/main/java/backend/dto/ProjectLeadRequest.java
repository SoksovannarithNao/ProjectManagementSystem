package backend.dto;

// Names the Team Leader who is the project's lead, or clears it when userId is null.
public class ProjectLeadRequest {

    private Long userId;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }
}
