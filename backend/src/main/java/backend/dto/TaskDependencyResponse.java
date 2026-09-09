package backend.dto;

import backend.entity.TaskDependency;

public class TaskDependencyResponse {

    private TaskResponse task;
    private TaskResponse dependsOnTask;

    public TaskDependencyResponse(TaskDependency taskDependency) {
        this.task = new TaskResponse(taskDependency.getTask());
        this.dependsOnTask = new TaskResponse(taskDependency.getDependsOnTask());
    }

    public TaskResponse getTask() {
        return task;
    }

    public TaskResponse getDependsOnTask() {
        return dependsOnTask;
    }
}
