package backend.entity;

import jakarta.persistence.*;

// A role row (docs/adr/0015-two-level-roles-system-and-project.md). Two levels:
//  * SYSTEM roles are what users.role_id points at: ADMINISTRATOR,
//    PROJECT_MANAGER or USER - what the account may do anywhere;
//  * PROJECT roles are what a project_members.project_role resolves to
//    (project_role = OWNER / ADMIN / MEMBER / VIEWER) - what a person may do
//    inside ONE project. The business names are Project Manager (OWNER),
//    Team Leader (ADMIN) and Team Member (MEMBER).
// PROJECT_MANAGER (system) and OWNER (project) are different roles. Which
// actions a role permits on which resources lives in role_permissions.
@Entity
@Table(name = "roles")
public class Role {

    public static final String ADMINISTRATOR = "ADMINISTRATOR";
    public static final String PROJECT_MANAGER = "PROJECT_MANAGER";
    public static final String USER = "USER";
    public static final String OWNER = "OWNER";
    public static final String ADMIN = "ADMIN";
    public static final String MEMBER = "MEMBER";
    public static final String VIEWER = "VIEWER";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(length = 255)
    private String description;

    // SYSTEM, PROJECT or BOTH: where this role can be assigned.
    @Column(nullable = false, length = 10)
    private String scope = "SYSTEM";

    // The project_members.project_role this role stands for, if any.
    @Column(name = "project_role", length = 20)
    private String projectRole;

    // Built-in roles come from Role_Requirment.md and cannot be deleted or renamed.
    @Column(name = "built_in", nullable = false)
    private boolean builtIn;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getProjectRole() {
        return projectRole;
    }

    public void setProjectRole(String projectRole) {
        this.projectRole = projectRole;
    }

    public boolean isBuiltIn() {
        return builtIn;
    }

    public void setBuiltIn(boolean builtIn) {
        this.builtIn = builtIn;
    }

    // Roles an account can hold at system level.
    public boolean isAssignableToUsers() {
        return "SYSTEM".equals(scope) || "BOTH".equals(scope);
    }
}
