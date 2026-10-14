package backend.controller;

import backend.dto.TeamViewsResponse;
import backend.service.TeamViewsService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// Team Tasks and Team Workload for people who manage a team. Who may see them
// (the right to assign tasks in the project) is decided in TeamViewsService.
@RestController
@RequestMapping("/api")
public class TeamViewsController {

    private final TeamViewsService teamViewsService;

    public TeamViewsController(TeamViewsService teamViewsService) {
        this.teamViewsService = teamViewsService;
    }

    // Every active member of the project with the tasks assigned to them and how
    // far along they are, plus the tasks nobody has yet.
    @GetMapping("/projects/{projectId}/team-tasks")
    public TeamViewsResponse.TeamTasks getTeamTasks(@PathVariable Long projectId, Authentication authentication) {
        return teamViewsService.getTeamTasks(projectId, authentication.getName());
    }

    // Per-member workload of one project's team, judged against that team's average.
    @GetMapping("/projects/{projectId}/workload")
    public TeamViewsResponse.Workload getProjectWorkload(@PathVariable Long projectId, Authentication authentication) {
        return teamViewsService.getWorkload(projectId, authentication.getName());
    }

    // The same across every project the caller manages (the dashboard card).
    @GetMapping("/workload")
    public TeamViewsResponse.Workload getWorkload(Authentication authentication) {
        return teamViewsService.getWorkload(null, authentication.getName());
    }
}
