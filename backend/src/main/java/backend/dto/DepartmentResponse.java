package backend.dto;

import backend.entity.Department;

public class DepartmentResponse {

    private Long id;
    private String name;
    private String description;

    public DepartmentResponse(Department department) {
        this.id = department.getId();
        this.name = department.getName();
        this.description = department.getDescription();
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
