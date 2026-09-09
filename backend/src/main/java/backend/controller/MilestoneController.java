package backend.controller;

import backend.dto.MilestoneRequest;
import backend.dto.MilestoneResponse;
import backend.service.MilestoneService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/milestones")
public class MilestoneController {

    private final MilestoneService milestoneService;

    public MilestoneController(MilestoneService milestoneService) {
        this.milestoneService = milestoneService;
    }

    @GetMapping
    public List<MilestoneResponse> getAllMilestones() {
        return milestoneService.getAllMilestones();
    }

    @GetMapping("/{id}")
    public MilestoneResponse getMilestoneById(@PathVariable Long id) {
        return milestoneService.getMilestoneById(id);
    }

    @GetMapping("/project/{projectId}")
    public List<MilestoneResponse> getMilestonesByProjectId(@PathVariable Long projectId) {
        return milestoneService.getMilestonesByProjectId(projectId);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public MilestoneResponse createMilestone(@Valid @RequestBody MilestoneRequest request) {
        return milestoneService.createMilestone(request);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @PutMapping("/{id}")
    public MilestoneResponse updateMilestone(
            @PathVariable Long id,
            @Valid @RequestBody MilestoneRequest request
    ) {
        return milestoneService.updateMilestone(id, request);
    }

    @PreAuthorize("hasAnyRole('ADMINISTRATOR', 'PROJECT_MANAGER', 'TEAM_LEADER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteMilestone(@PathVariable Long id) {
        milestoneService.deleteMilestone(id);
    }
}
