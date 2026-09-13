package backend.controller;

import backend.dto.PositionRequest;
import backend.dto.PositionResponse;
import backend.service.PositionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/positions")
public class PositionController {

    private final PositionService positionService;

    public PositionController(PositionService positionService) {
        this.positionService = positionService;
    }

    // Open to any authenticated user — needed to populate the Position
    // dropdown for every viewer, same as GET /api/roles.
    @GetMapping
    public List<PositionResponse> getAllPositions() {
        return positionService.getAllPositions();
    }

    // Same "Team Admin" gate as project-member management elsewhere
    // (ProjectMemberController's create/update/delete).
    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public PositionResponse createPosition(@Valid @RequestBody PositionRequest request) {
        return positionService.createPosition(request);
    }
}
