package backend.entity;

import jakarta.persistence.*;
import java.io.Serializable;

@Entity
@Table(name = "task_dependencies")
@IdClass(TaskDependency.TaskDependencyId.class)
public class TaskDependency {

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @Id
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "depends_on_task_id", nullable = false)
    private Task dependsOnTask;

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Task getDependsOnTask() {
        return dependsOnTask;
    }

    public void setDependsOnTask(Task dependsOnTask) {
        this.dependsOnTask = dependsOnTask;
    }

    public static class TaskDependencyId implements Serializable {

        private Long task;
        private Long dependsOnTask;

        public TaskDependencyId() {
        }

        public TaskDependencyId(Long task, Long dependsOnTask) {
            this.task = task;
            this.dependsOnTask = dependsOnTask;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof TaskDependencyId that)) {
                return false;
            }
            return java.util.Objects.equals(task, that.task)
                && java.util.Objects.equals(dependsOnTask, that.dependsOnTask);
        }

        @Override
        public int hashCode() {
            return java.util.Objects.hash(task, dependsOnTask);
        }
    }
}