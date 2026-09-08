package backend.service;

import backend.entity.TaskDependency;
import backend.entity.TaskDependency.TaskDependencyId;
import backend.repository.TaskDependencyRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TaskDependencyService {

    private final TaskDependencyRepository taskDependencyRepository;

    public TaskDependencyService(TaskDependencyRepository taskDependencyRepository) {
        this.taskDependencyRepository = taskDependencyRepository;
    }

    public List<TaskDependency> getAllTaskDependencies() {
        return taskDependencyRepository.findAll();
    }

    public TaskDependency getTaskDependencyById(TaskDependencyId id) {
        return taskDependencyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task dependency not found"));
    }

    public List<TaskDependency> getDependenciesByTaskId(Long taskId) {
        return taskDependencyRepository.findByTaskId(taskId);
    }

    public List<TaskDependency> getDependentTasks(Long taskId) {
        return taskDependencyRepository.findByDependsOnTaskId(taskId);
    }

    public TaskDependency createTaskDependency(TaskDependency dependency) {
        return taskDependencyRepository.save(dependency);
    }

    public void deleteTaskDependency(TaskDependencyId id) {
        TaskDependency dependency = getTaskDependencyById(id);
        taskDependencyRepository.delete(dependency);
    }
}