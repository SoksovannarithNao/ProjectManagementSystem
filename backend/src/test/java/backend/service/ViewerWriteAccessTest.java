package backend.service;

import backend.dto.CommentRequest;
import backend.dto.SubtaskRequest;
import backend.entity.Project;
import backend.entity.Subtask;
import backend.entity.Task;
import backend.entity.User;
import backend.repository.CommentRepository;
import backend.repository.SubtaskRepository;
import backend.repository.TaskDependencyRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// A VIEWER can read a task's subtasks and discussion but must not change
// them: every subtask write and adding a comment need content-edit rights
// (OWNER/ADMIN/MEMBER), not just project membership.
@ExtendWith(MockitoExtension.class)
class ViewerWriteAccessTest {

    @Mock
    private SubtaskRepository subtaskRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskDependencyRepository taskDependencyRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private CommentRepository commentRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;

    private SubtaskService subtaskService;
    private CommentService commentService;

    private User viewer;
    private Task task;
    private Subtask subtask;

    @BeforeEach
    void setUp() {
        subtaskService = new SubtaskService(
                subtaskRepository, taskRepository, taskDependencyRepository, userRepository,
                activityLogService, projectAccessGuard);
        commentService = new CommentService(commentRepository, taskRepository, userRepository, projectAccessGuard);

        viewer = new User();
        ReflectionTestUtils.setField(viewer, "id", 1L);
        viewer.setUsername("qa.zoe");
        lenient().when(userRepository.findByUsername("qa.zoe")).thenReturn(Optional.of(viewer));

        Project project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        task = new Task();
        ReflectionTestUtils.setField(task, "id", 64L);
        task.setProject(project);
        task.setTitle("Some task");
        lenient().when(taskRepository.findById(64L)).thenReturn(Optional.of(task));

        subtask = new Subtask();
        ReflectionTestUtils.setField(subtask, "id", 8L);
        subtask.setTask(task);
        subtask.setTitle("Existing");

        // The guard denies content writes (the viewer) but would allow reads.
        lenient().doThrow(new AccessDeniedException("read-only")).when(projectAccessGuard).assertCanEditContent(viewer, 10L);
    }

    private SubtaskRequest subtaskRequest() {
        SubtaskRequest r = new SubtaskRequest();
        r.setTaskId(64L);
        r.setTitle("Sneaky subtask");
        return r;
    }

    @Test
    void viewer_cannotCreateASubtask() {
        assertThatThrownBy(() -> subtaskService.createSubtask(subtaskRequest(), "qa.zoe"))
                .isInstanceOf(AccessDeniedException.class);
        verify(subtaskRepository, never()).save(any());
    }

    @Test
    void viewer_cannotEditASubtask() {
        when(subtaskRepository.findById(8L)).thenReturn(Optional.of(subtask));

        assertThatThrownBy(() -> subtaskService.updateSubtask(8L, subtaskRequest(), "qa.zoe"))
                .isInstanceOf(AccessDeniedException.class);
        verify(subtaskRepository, never()).save(any());
    }

    @Test
    void viewer_cannotDeleteASubtask() {
        when(subtaskRepository.findById(8L)).thenReturn(Optional.of(subtask));

        assertThatThrownBy(() -> subtaskService.deleteSubtask(8L, "qa.zoe"))
                .isInstanceOf(AccessDeniedException.class);
        verify(subtaskRepository, never()).delete(any());
    }

    @Test
    void viewer_canStillReadSubtasks() {
        when(subtaskRepository.findByTaskIdOrderByIdAsc(64L)).thenReturn(List.of(subtask));

        assertThat(subtaskService.getSubtasksByTaskId(64L, "qa.zoe")).hasSize(1);
        verify(projectAccessGuard).assertAccess(viewer, 10L);
    }

    @Test
    void viewer_cannotAddAComment() {
        CommentRequest request = new CommentRequest();
        request.setTaskId(64L);
        request.setMessage("Sneaky comment");

        assertThatThrownBy(() -> commentService.createComment(request, "qa.zoe"))
                .isInstanceOf(AccessDeniedException.class);
        verify(commentRepository, never()).save(any());
    }

    @Test
    void viewer_canStillReadComments() {
        when(commentRepository.findByTaskIdOrderByCreatedAtAsc(64L)).thenReturn(List.of());

        assertThat(commentService.getCommentsByTaskId(64L, "qa.zoe")).isEmpty();
        verify(projectAccessGuard).assertAccess(viewer, 10L);
    }
}
