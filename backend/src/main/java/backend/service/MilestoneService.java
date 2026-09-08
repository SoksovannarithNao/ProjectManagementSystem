package backend.service;

import backend.entity.Milestone;
import backend.repository.MilestoneRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MilestoneService {

    private final MilestoneRepository milestoneRepository;

    public MilestoneService(MilestoneRepository milestoneRepository) {
        this.milestoneRepository = milestoneRepository;
    }

    public List<Milestone> getAllMilestones() {
        return milestoneRepository.findAll();
    }

    public Milestone getMilestoneById(Long id) {
        return milestoneRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Milestone not found"));
    }

    public List<Milestone> getMilestonesByProjectId(Long projectId) {
        return milestoneRepository.findByProjectId(projectId);
    }

    public Milestone createMilestone(Milestone milestone) {
        return milestoneRepository.save(milestone);
    }

    public Milestone updateMilestone(Long id, Milestone milestoneDetails) {
        Milestone milestone = getMilestoneById(id);

        milestone.setProject(milestoneDetails.getProject());
        milestone.setTitle(milestoneDetails.getTitle());
        milestone.setDescription(milestoneDetails.getDescription());
        milestone.setDueDate(milestoneDetails.getDueDate());
        milestone.setStatus(milestoneDetails.getStatus());
        milestone.setProgress(milestoneDetails.getProgress());

        return milestoneRepository.save(milestone);
    }

    public void deleteMilestone(Long id) {
        Milestone milestone = getMilestoneById(id);
        milestoneRepository.delete(milestone);
    }
}