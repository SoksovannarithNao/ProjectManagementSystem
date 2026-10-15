package backend.controller;

import backend.dto.MilestoneRequest;
import backend.dto.MilestoneResponse;
import backend.service.MilestoneService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/milestones")
public class MilestoneController {

    private final MilestoneService milestoneService;

    public MilestoneController(MilestoneService milestoneService) {
        this.milestoneService = milestoneService;
    }

    // dueFrom / dueTo (YYYY-MM-DD, both included) keep the milestones due in that window (the calendar).
    @GetMapping
    public List<MilestoneResponse> getAllMilestones(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueTo,
            Authentication authentication) {
        return milestoneService.getAllMilestones(authentication.getName(), dueFrom, dueTo);
    }

    @GetMapping("/{id}")
    public MilestoneResponse getMilestoneById(@PathVariable Long id, Authentication authentication) {
        return milestoneService.getMilestoneById(id, authentication.getName());
    }

    @GetMapping("/project/{projectId}")
    public List<MilestoneResponse> getMilestonesByProjectId(@PathVariable Long projectId, Authentication authentication) {
        return milestoneService.getMilestonesByProjectId(projectId, authentication.getName());
    }

    // Requires OWNER/ADMIN of the target project — enforced in
    // MilestoneService.
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public MilestoneResponse createMilestone(@Valid @RequestBody MilestoneRequest request, Authentication authentication) {
        return milestoneService.createMilestone(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public MilestoneResponse updateMilestone(
            @PathVariable Long id,
            @Valid @RequestBody MilestoneRequest request,
            Authentication authentication
    ) {
        return milestoneService.updateMilestone(id, request, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteMilestone(@PathVariable Long id, Authentication authentication) {
        milestoneService.deleteMilestone(id, authentication.getName());
    }
}
