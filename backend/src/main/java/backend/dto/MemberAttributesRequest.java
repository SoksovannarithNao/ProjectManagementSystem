package backend.dto;

// Team-Admin-only update of another member's Position/Department (see
// UserService.updateMemberPositionDepartment). Deliberately separate from
// SelfProfileUpdateRequest, which no longer accepts these two fields at all.
public class MemberAttributesRequest {

    private Long positionId;

    private Long departmentId;

    public Long getPositionId() {
        return positionId;
    }

    public void setPositionId(Long positionId) {
        this.positionId = positionId;
    }

    public Long getDepartmentId() {
        return departmentId;
    }

    public void setDepartmentId(Long departmentId) {
        this.departmentId = departmentId;
    }
}
