package backend.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

// One review request on a task and what became of it (assignment-brief.md
// B3.8). PENDING while it waits for a decision; at most one PENDING row per
// task (uq_task_approvals_one_pending).
@Entity
@Table(name = "task_approvals")
public class TaskApproval {

    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String CHANGES_REQUESTED = "CHANGES_REQUESTED";
    public static final String REJECTED = "REJECTED";
    // The task left review without anyone deciding (for example the doer moved it back).
    public static final String WITHDRAWN = "WITHDRAWN";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by")
    private User requestedBy;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private OffsetDateTime requestedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private User decidedBy;

    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    @Column(nullable = false, length = 20)
    private String decision = PENDING;

    @Column(length = 1000)
    private String comment;

    public Long getId() {
        return id;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public User getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(User requestedBy) {
        this.requestedBy = requestedBy;
    }

    public OffsetDateTime getRequestedAt() {
        return requestedAt;
    }

    public User getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(User decidedBy) {
        this.decidedBy = decidedBy;
    }

    public OffsetDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(OffsetDateTime decidedAt) {
        this.decidedAt = decidedAt;
    }

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

    public boolean isPending() {
        return PENDING.equals(decision);
    }

    @PrePersist
    void onCreate() {
        if (requestedAt == null) {
            requestedAt = OffsetDateTime.now();
        }
    }
}
