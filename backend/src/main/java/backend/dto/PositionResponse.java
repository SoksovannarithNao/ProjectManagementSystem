package backend.dto;

import backend.entity.Position;

public class PositionResponse {

    private Long id;
    private String name;
    private String description;

    public PositionResponse(Position position) {
        this.id = position.getId();
        this.name = position.getName();
        this.description = position.getDescription();
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
