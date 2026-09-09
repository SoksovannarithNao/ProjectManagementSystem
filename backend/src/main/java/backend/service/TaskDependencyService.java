package backend.service;

import backend.dto.TaskDependencyRequest;
import backend.dto.TaskDependencyResponse;
import backend.entity.Task;
import backend.entity.TaskDependency;
import backend.entity.TaskDependency.TaskDependencyId;
import backend.exception.NotFoundException;
import backend.repository.TaskDependencyRepository;
import backend.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class TaskDependencyService {

    private final TaskDependencyRepository taskDependencyRepository;
    private final TaskRepository taskRepository;

    public TaskDependencyService(
            TaskDependencyRepository taskDependencyRepository,
            TaskRepository taskRepository) {
        this.taskDependencyRepository = taskDependencyRepository;
        this.taskRepository = taskRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskDependencyResponse> getAllTaskDependencies() {
        return taskDependencyRepository.findAll()
                .stream()
                .map(TaskDependencyResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskDependency getTaskDependencyEntityById(TaskDependencyId id) {
        return taskDependencyRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Task dependency not found"));
    }

    @Transactional(readOnly = true)
    public List<TaskDependencyResponse> getDependenciesByTaskId(Long taskId) {
        return taskDependencyRepository.findByTaskId(taskId)
                .stream()
                .map(TaskDependencyResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TaskDependencyResponse> getDependentTasks(Long taskId) {
        return taskDependencyRepository.findByDependsOnTaskId(taskId)
                .stream()
                .map(TaskDependencyResponse::new)
                .toList();
    }

    public TaskDependencyResponse createTaskDependency(TaskDependencyRequest request) {
        Task task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> new NotFoundException("Task not found"));
        Task dependsOnTask = taskRepository.findById(request.getDependsOnTaskId())
                .orElseThrow(() -> new NotFoundException("Depends-on task not found"));

        TaskDependency dependency = new TaskDependency();
        dependency.setTask(task);
        dependency.setDependsOnTask(dependsOnTask);

        return new TaskDependencyResponse(taskDependencyRepository.save(dependency));
    }

    public void deleteTaskDependency(TaskDependencyId id) {
        TaskDependency dependency = getTaskDependencyEntityById(id);
        taskDependencyRepository.delete(dependency);
    }
}
