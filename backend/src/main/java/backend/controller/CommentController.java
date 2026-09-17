package backend.controller;

import backend.dto.CommentRequest;
import backend.dto.CommentResponse;
import backend.service.CommentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// No @PreAuthorize role gates — CommentService enforces project-membership
// access for reads/creates, author-only for edits, and author-or-team-admin
// for deletes.
@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping("/task/{taskId}")
    public List<CommentResponse> getCommentsByTaskId(@PathVariable Long taskId, Authentication authentication) {
        return commentService.getCommentsByTaskId(taskId, authentication.getName());
    }

    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public CommentResponse createComment(@Valid @RequestBody CommentRequest request, Authentication authentication) {
        return commentService.createComment(request, authentication.getName());
    }

    @PutMapping("/{id}")
    public CommentResponse updateComment(
            @PathVariable Long id,
            @Valid @RequestBody CommentRequest request,
            Authentication authentication
    ) {
        return commentService.updateComment(id, request, authentication.getName());
    }

    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteComment(@PathVariable Long id, Authentication authentication) {
        commentService.deleteComment(id, authentication.getName());
    }
}
