package backend.controller;

import backend.dto.DepartmentRequest;
import backend.dto.DepartmentResponse;
import backend.service.DepartmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public List<DepartmentResponse> getAllDepartments() {
        return departmentService.getAllDepartments();
    }

    // Global lookup-table management — genuinely system-wide, unrelated to
    // any one project, so gated by the system role rather than any
    // project_role. PROJECT_MANAGER/TEAM_LEADER used to also qualify before
    // those global roles were replaced by project-scoped roles (see V5
    // migration) — removed here since neither can exist anymore.
    @PreAuthorize("hasRole('ADMINISTRATOR')")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public DepartmentResponse createDepartment(@Valid @RequestBody DepartmentRequest request) {
        return departmentService.createDepartment(request);
    }
}
