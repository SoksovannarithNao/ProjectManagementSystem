package backend.service;

import backend.dto.TaskDependencyRequest;
import backend.dto.TaskDependencyResponse;
import backend.entity.Task;
import backend.entity.TaskDependency;
import backend.entity.TaskDependency.TaskDependencyId;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.ProjectMemberRepository;
import backend.repository.TaskDependencyRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TaskDependencyService {

    private final TaskDependencyRepository taskDependencyRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectAccessGuard projectAccessGuard;

    public TaskDependencyService(
            TaskDependencyRepository taskDependencyRepository,
            TaskRepository taskRepository,
            UserRepository userRepository,
            ProjectMemberRepository projectMemberRepository,
            ProjectAccessGuard projectAccessGuard) {
        this.taskDependencyRepository = taskDependencyRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectAccessGuard = projectAccessGuard;
    }

    // Previously an unscoped findAll() with no username parameter and no
    // @PreAuthorize on the controller — any authenticated user could see
    // every task dependency in the system. Scoped by the dependency's own
    // task's project, same boundary as everywhere else.
    @Transactional(readOnly = true)
    public List<TaskDependencyResponse> getAllTaskDependencies(String username) {
        User caller = requireUser(username);
        List<TaskDependency> dependencies;
        if (projectAccessGuard.isAdmin(caller)) {
            dependencies = taskDependencyRepository.findAll();
        } else {
            List<Long> visibleProjectIds = projectMemberRepository.findProjectIdsByUserId(caller.getId());
            dependencies = taskDependencyRepository.findAll().stream()
                    .filter(d -> visibleProjectIds.contains(d.getTask().getProject().getId()))
                    .toList();
        }
        return dependencies.stream().map(TaskDependencyResponse::new).toList();
    }

    @Transactional(readOnly = true)
    public TaskDependency getTaskDependencyEntityById(TaskDependencyId id) {
        return taskDependencyRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task dependency not found"));
    }

    @Transactional(readOnly = true)
    public List<TaskDependencyResponse> getDependenciesByTaskId(Long taskId, String username) {
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return taskDependencyRepository.findByTaskId(taskId)
                .stream()
                .map(TaskDependencyResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TaskDependencyResponse> getDependentTasks(Long taskId, String username) {
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return taskDependencyRepository.findByDependsOnTaskId(taskId)
                .stream()
                .map(TaskDependencyResponse::new)
                .toList();
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    // Requires OWNER/ADMIN (or system ADMINISTRATOR) of the task's project.
    public TaskDependencyResponse createTaskDependency(TaskDependencyRequest request, String username) {
        Task task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> new NotFoundException("Task not found"));
        Task dependsOnTask = taskRepository.findById(request.getDependsOnTaskId())
                .orElseThrow(() -> new NotFoundException("Depends-on task not found"));
        projectAccessGuard.assertCanManage(requireUser(username), task.getProject().getId());

        TaskDependency dependency = new TaskDependency();
        dependency.setTask(task);
        dependency.setDependsOnTask(dependsOnTask);

        return new TaskDependencyResponse(taskDependencyRepository.save(dependency));
    }

    public void deleteTaskDependency(TaskDependencyId id, String username) {
        TaskDependency dependency = getTaskDependencyEntityById(id);
        projectAccessGuard.assertCanManage(requireUser(username), dependency.getTask().getProject().getId());
        taskDependencyRepository.delete(dependency);
    }
}
