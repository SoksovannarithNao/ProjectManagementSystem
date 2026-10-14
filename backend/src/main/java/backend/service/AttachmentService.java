package backend.service;

import backend.dto.AttachmentResponse;
import backend.entity.Attachment;
import backend.entity.AttachmentContent;
import backend.entity.Project;
import backend.entity.Task;
import backend.entity.User;
import backend.exception.NotFoundException;
import backend.repository.AttachmentContentRepository;
import backend.repository.AttachmentRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskRepository;
import backend.repository.UserRepository;
import backend.security.Action;
import backend.security.Resource;
import backend.util.FileTypeGuard;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

// Files attached to a task or to a project (assignment-brief.md B3.4, D-17).
//
//  * who: anyone with ATTACHMENT:CREATE in the project uploads (Owner, Team
//    Leader, Team Member); the uploader, or someone with ATTACHMENT:DELETE
//    (Owner, Team Leader), deletes; every member of the project reads.
//  * what: only the types FileTypeGuard allows, up to app.attachments.max-size-bytes
//    each (10 MB by default) and app.attachments.max-per-target files per task
//    or project (25) so one task cannot grow the database without bound.
//  * where: the bytes are stored in the database (attachment_contents), so a
//    backup carries them; they are served only to an authenticated member.
@Service
@Transactional
public class AttachmentService {

    private final AttachmentRepository attachmentRepository;
    private final AttachmentContentRepository contentRepository;
    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectAccessGuard projectAccessGuard;
    private final ActivityLogService activityLogService;
    private final long maxSizeBytes;
    private final long maxPerTarget;

    public AttachmentService(
            AttachmentRepository attachmentRepository,
            AttachmentContentRepository contentRepository,
            TaskRepository taskRepository,
            ProjectRepository projectRepository,
            UserRepository userRepository,
            ProjectAccessGuard projectAccessGuard,
            ActivityLogService activityLogService,
            @Value("${app.attachments.max-size-bytes:10485760}") long maxSizeBytes,
            @Value("${app.attachments.max-per-target:25}") long maxPerTarget) {
        this.attachmentRepository = attachmentRepository;
        this.contentRepository = contentRepository;
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectAccessGuard = projectAccessGuard;
        this.activityLogService = activityLogService;
        this.maxSizeBytes = maxSizeBytes;
        this.maxPerTarget = maxPerTarget;
    }

    // A file and what it should be called when it is downloaded.
    public record Download(String fileName, String mimeType, byte[] bytes) {
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> getByTask(Long taskId, String username) {
        Task task = requireTask(taskId);
        projectAccessGuard.assertAccess(requireUser(username), task.getProject().getId());
        return attachmentRepository.findByTaskIdOrderByUploadedAtDescIdDesc(taskId).stream()
                .map(AttachmentResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AttachmentResponse> getByProject(Long projectId, String username) {
        projectAccessGuard.assertAccess(requireUser(username), projectId);
        return attachmentRepository.findByProjectIdOrderByUploadedAtDescIdDesc(projectId).stream()
                .map(AttachmentResponse::new)
                .toList();
    }

    // Exactly one of taskId / projectId says what the file is attached to.
    public AttachmentResponse upload(MultipartFile file, Long taskId, Long projectId, String username) {
        if ((taskId == null) == (projectId == null)) {
            throw new IllegalArgumentException("Attach the file to a task or to a project, not both");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No file was uploaded");
        }
        User caller = requireUser(username);
        Task task = taskId != null ? requireTask(taskId) : null;
        Project project = task != null ? task.getProject() : projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found"));
        projectAccessGuard.assertCan(caller, project.getId(), Resource.ATTACHMENT, Action.CREATE);

        if (file.getSize() > maxSizeBytes) {
            throw new IllegalArgumentException("The file is too large (max " + describeSize(maxSizeBytes) + ")");
        }
        long existing = task != null
                ? attachmentRepository.countByTaskId(task.getId())
                : attachmentRepository.countByProjectId(project.getId());
        if (existing >= maxPerTarget) {
            throw new IllegalArgumentException("A " + (task != null ? "task" : "project")
                    + " can hold at most " + maxPerTarget + " files. Delete one first");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to read the uploaded file", ex);
        }
        FileTypeGuard.Checked checked = FileTypeGuard.check(file.getOriginalFilename(), bytes);

        Attachment attachment = new Attachment();
        if (task != null) {
            attachment.setTask(task);
        } else {
            attachment.setProject(project);
        }
        attachment.setUploadedBy(caller);
        attachment.setFileName(checked.fileName());
        attachment.setMimeType(checked.mimeType());
        attachment.setFileSize((long) bytes.length);
        Attachment saved = attachmentRepository.save(attachment);
        contentRepository.save(new AttachmentContent(saved.getId(), bytes));

        String description = "File \"" + checked.fileName() + "\" uploaded";
        if (task != null) {
            activityLogService.record(caller, task, "FILE_UPLOADED", description);
        } else {
            activityLogService.recordProjectEvent(caller, project, "FILE_UPLOADED", description + " to the project");
        }
        return new AttachmentResponse(saved);
    }

    @Transactional(readOnly = true)
    public Download download(Long id, String username) {
        Attachment attachment = requireAttachment(id);
        projectAccessGuard.assertAccess(requireUser(username), attachment.owningProject().getId());
        AttachmentContent content = contentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Attachment not found"));
        return new Download(attachment.getFileName(), attachment.getMimeType(), content.getData());
    }

    // The uploader may always delete their own file; anyone else needs
    // ATTACHMENT:DELETE in the project (Owner, Team Leader).
    public void delete(Long id, String username) {
        User caller = requireUser(username);
        Attachment attachment = requireAttachment(id);
        Long projectId = attachment.owningProject().getId();
        projectAccessGuard.assertAccess(caller, projectId);
        boolean isUploader = attachment.getUploadedBy() != null
                && attachment.getUploadedBy().getId().equals(caller.getId());
        if (!isUploader && !projectAccessGuard.can(caller, projectId, Resource.ATTACHMENT, Action.DELETE)) {
            throw new AccessDeniedException("You can only delete files you uploaded");
        }
        attachmentRepository.delete(attachment);
    }

    private static String describeSize(long bytes) {
        return bytes >= 1024 * 1024 ? (bytes / (1024 * 1024)) + " MB" : (bytes / 1024) + " KB";
    }

    private Attachment requireAttachment(Long id) {
        return attachmentRepository.findById(id).orElseThrow(() -> new NotFoundException("Attachment not found"));
    }

    private Task requireTask(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new NotFoundException("Task not found"));
    }

    private User requireUser(String username) {
        return userRepository.findByUsername(username).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
