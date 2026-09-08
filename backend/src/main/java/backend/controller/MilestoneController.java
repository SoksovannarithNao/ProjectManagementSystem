package backend.controller;

import backend.entity.Milestone;
import backend.service.MilestoneService;
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
    public List<Milestone> getAllMilestones() {
        return milestoneService.getAllMilestones();
    }

    @GetMapping("/{id}")
    public Milestone getMilestoneById(@PathVariable Long id) {
        return milestoneService.getMilestoneById(id);
    }

    @GetMapping("/project/{projectId}")
    public List<Milestone> getMilestonesByProjectId(@PathVariable Long projectId) {
        return milestoneService.getMilestonesByProjectId(projectId);
    }

    @PostMapping
    public Milestone createMilestone(@RequestBody Milestone milestone) {
        return milestoneService.createMilestone(milestone);
    }

    @PutMapping("/{id}")
    public Milestone updateMilestone(
            @PathVariable Long id,
            @RequestBody Milestone milestone
    ) {
        return milestoneService.updateMilestone(id, milestone);
    }

    @DeleteMapping("/{id}")
    public void deleteMilestone(@PathVariable Long id) {
        milestoneService.deleteMilestone(id);
    }
}