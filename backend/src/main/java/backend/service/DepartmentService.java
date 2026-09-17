package backend.service;

import backend.dto.DepartmentRequest;
import backend.dto.DepartmentResponse;
import backend.entity.Department;
import backend.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class DepartmentService {

    private final DepartmentRepository departmentRepository;

    public DepartmentService(DepartmentRepository departmentRepository) {
        this.departmentRepository = departmentRepository;
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getAllDepartments() {
        return departmentRepository.findAll().stream().map(DepartmentResponse::new).toList();
    }

    public DepartmentResponse createDepartment(DepartmentRequest request) {
        if (departmentRepository.existsByNameIgnoreCase(request.getName())) {
            throw new IllegalArgumentException("A department named \"" + request.getName() + "\" already exists");
        }
        Department department = new Department();
        department.setName(request.getName().trim());
        department.setDescription(request.getDescription());
        return new DepartmentResponse(departmentRepository.save(department));
    }
}
