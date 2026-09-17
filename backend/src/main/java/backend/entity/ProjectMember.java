package backend.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(
    name = "project_members",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_project_members_project_user",
        columnNames = {"project_id", "user_id"}
    )
)
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // OWNER/ADMIN/MEMBER/VIEWER — THE authorization boundary for
    // project/task actions (see backend.service.ProjectAccessGuard), not
    // users.role_id.
    @Column(name = "project_role", nullable = false, length = 20)
    private String projectRole = "MEMBER";

    // PENDING = an invitation the user hasn't responded to yet; ACTIVE = a
    // real membership; DECLINED = the user turned the invitation down. Rows
    // created via the direct-add path (createProjectMember) start ACTIVE;
    // rows created via inviteMember start PENDING. See
    // ProjectMemberService.inviteMember/respondToInvitation.
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by")
    private User invitedBy;

    @Column(name = "responded_at")
    private OffsetDateTime respondedAt;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private OffsetDateTime joinedAt;

    public Long getId() {
        return id;
    }

    public Project getProject() {
        return project;
    }

    public void setProject(Project project) {
        this.project = project;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getProjectRole() {
        return projectRole;
    }

    public void setProjectRole(String projectRole) {
        this.projectRole = projectRole;
    }

    public OffsetDateTime getJoinedAt() {
        return joinedAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public User getInvitedBy() {
        return invitedBy;
    }

    public void setInvitedBy(User invitedBy) {
        this.invitedBy = invitedBy;
    }

    public OffsetDateTime getRespondedAt() {
        return respondedAt;
    }

    public void setRespondedAt(OffsetDateTime respondedAt) {
        this.respondedAt = respondedAt;
    }

    @PrePersist
    void onCreate() {
        joinedAt = OffsetDateTime.now();
    }
}