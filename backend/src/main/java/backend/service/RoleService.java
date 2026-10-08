package backend.service;

import backend.dto.RoleRequest;
import backend.entity.Role;
import backend.exception.NotFoundException;
import backend.repository.RoleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RoleService {

    private final RoleRepository roleRepository;

    public RoleService(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    public List<Role> getAllRoles() {
        return roleRepository.findAll();
    }

    public Role getRoleById(Long id) {
        return roleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Role not found"));
    }

    public Role createRole(RoleRequest request) {
        Role role = new Role();
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        return roleRepository.save(role);
    }

    public Role updateRole(Long id, RoleRequest request) {
        Role role = getRoleById(id);
        if (role.isBuiltIn() && !role.getName().equals(request.getName())) {
            throw new IllegalArgumentException("Built-in roles come from Role_Requirment.md and cannot be renamed");
        }
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        return roleRepository.save(role);
    }

    public void deleteRole(Long id) {
        Role role = getRoleById(id);
        if (role.isBuiltIn()) {
            throw new IllegalArgumentException("Built-in roles cannot be deleted");
        }
        roleRepository.delete(role);
    }
}
