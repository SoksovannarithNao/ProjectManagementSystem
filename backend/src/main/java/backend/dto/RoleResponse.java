package backend.dto;

import backend.entity.Role;

public class RoleResponse {

    private Long id;
    private String name;
    private String description;
    private String scope;
    private String projectRole;
    private boolean builtIn;

    public RoleResponse(Role role) {
        this.id = role.getId();
        this.name = role.getName();
        this.description = role.getDescription();
        this.scope = role.getScope();
        this.projectRole = role.getProjectRole();
        this.builtIn = role.isBuiltIn();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getScope() {
        return scope;
    }

    public String getProjectRole() {
        return projectRole;
    }

    public boolean isBuiltIn() {
        return builtIn;
    }
}
