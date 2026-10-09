package backend.controller;

import backend.dto.AttachmentResponse;
import backend.service.AttachmentService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

// Files attached to a task or a project. Every rule (membership, ATTACHMENT
// permissions, type and size limits) is enforced in AttachmentService.
@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    private final AttachmentService attachmentService;

    public AttachmentController(AttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    @GetMapping("/task/{taskId}")
    public List<AttachmentResponse> getByTask(@PathVariable Long taskId, Authentication authentication) {
        return attachmentService.getByTask(taskId, authentication.getName());
    }

    @GetMapping("/project/{projectId}")
    public List<AttachmentResponse> getByProject(@PathVariable Long projectId, Authentication authentication) {
        return attachmentService.getByProject(projectId, authentication.getName());
    }

    // multipart/form-data: part `file`, plus exactly one of `taskId` / `projectId`.
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttachmentResponse upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) Long taskId,
            @RequestParam(required = false) Long projectId,
            Authentication authentication) {
        return attachmentService.upload(file, taskId, projectId, authentication.getName());
    }

    // Always an attachment download, never rendered in the page: a stored file
    // must not be able to run script in the app's origin.
    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long id, Authentication authentication) {
        AttachmentService.Download file = attachmentService.download(id, authentication.getName());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.fileName(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .contentLength(file.bytes().length)
                .body(file.bytes());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id, Authentication authentication) {
        attachmentService.delete(id, authentication.getName());
    }
}
