package backend.entity;

import jakarta.persistence.*;

// One of the 7 permission types (VIEW, CREATE, EDIT, DELETE, ASSIGN, APPROVE,
// GENERATE_REPORTS). Read-only for the application: the catalog is fixed by
// Role_Requirment.md, administrators edit which role holds which one through
// RolePermission.
@Entity
@Table(name = "permissions")
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(length = 255)
    private String description;

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getDescription() {
        return description;
    }
}
