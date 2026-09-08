package backend.service;

import backend.entity.TaskAssignee;
import backend.repository.TaskAssigneeRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TaskAssigneeService {

    private final TaskAssigneeRepository taskAssigneeRepository;

    public TaskAssigneeService(TaskAssigneeRepository taskAssigneeRepository) {
        this.taskAssigneeRepository = taskAssigneeRepository;
    }

    public List<TaskAssignee> getAllTaskAssignees() {
        return taskAssigneeRepository.findAll();
    }

    public TaskAssignee getTaskAssigneeById(Long id) {
        return taskAssigneeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task assignee not found"));
    }

    public List<TaskAssignee> getAssigneesByTaskId(Long taskId) {
        return taskAssigneeRepository.findByTaskId(taskId);
    }

    public List<TaskAssignee> getTasksByUserId(Long userId) {
        return taskAssigneeRepository.findByUserId(userId);
    }

    public TaskAssignee createTaskAssignee(TaskAssignee taskAssignee) {
        return taskAssigneeRepository.save(taskAssignee);
    }

    public void deleteTaskAssignee(Long id) {
        TaskAssignee taskAssignee = getTaskAssigneeById(id);
        taskAssigneeRepository.delete(taskAssignee);
    }
}