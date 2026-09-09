package backend.dto;

import backend.entity.Role;

public class RoleResponse {

    private Long id;
    private String name;
    private String description;

    public RoleResponse(Role role) {
        this.id = role.getId();
        this.name = role.getName();
        this.description = role.getDescription();
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
}
