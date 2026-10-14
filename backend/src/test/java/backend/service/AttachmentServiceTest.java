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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Attachments (assignment-brief.md B3.4, D-17): who may upload and delete, the
// limits, and that the bytes are stored apart from the listing.
@ExtendWith(MockitoExtension.class)
class AttachmentServiceTest {

    private static final byte[] PDF = "%PDF-1.7 test".getBytes();

    @Mock
    private AttachmentRepository attachmentRepository;
    @Mock
    private AttachmentContentRepository contentRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectAccessGuard projectAccessGuard;
    @Mock
    private ActivityLogService activityLogService;

    private AttachmentService service;
    private User member;
    private User leader;
    private Project project;
    private Task task;

    @BeforeEach
    void setUp() {
        service = new AttachmentService(attachmentRepository, contentRepository, taskRepository, projectRepository,
                userRepository, projectAccessGuard, activityLogService, 1024, 2);

        member = user(1L, "dev.chen");
        leader = user(2L, "lead.owen");
        project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        project.setName("Website Redesign");
        task = new Task();
        ReflectionTestUtils.setField(task, "id", 5L);
        task.setProject(project);
        task.setTitle("Build it");

        lenient().when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        lenient().when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        lenient().when(attachmentRepository.save(any(Attachment.class))).thenAnswer(inv -> {
            Attachment a = inv.getArgument(0);
            ReflectionTestUtils.setField(a, "id", 77L);
            return a;
        });
    }

    private User user(Long id, String username) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        u.setFullName(username);
        lenient().when(userRepository.findByUsername(username)).thenReturn(Optional.of(u));
        return u;
    }

    private MockMultipartFile pdf(String name) {
        return new MockMultipartFile("file", name, "application/octet-stream", PDF);
    }

    private Attachment stored(User uploader) {
        Attachment a = new Attachment();
        ReflectionTestUtils.setField(a, "id", 77L);
        a.setTask(task);
        a.setUploadedBy(uploader);
        a.setFileName("spec.pdf");
        a.setMimeType("application/pdf");
        lenient().when(attachmentRepository.findById(77L)).thenReturn(Optional.of(a));
        return a;
    }

    // ---- upload ----------------------------------------------------------------

    @Test
    void aMember_uploadsToATask_theBytesAreStoredApart_andTheUploadIsLogged() {
        AttachmentResponse response = service.upload(pdf("..\\specs\\plan.pdf"), 5L, null, "dev.chen");

        assertThat(response.getFileName()).isEqualTo("plan.pdf");
        assertThat(response.getMimeType()).isEqualTo("application/pdf");
        assertThat(response.getFileSize()).isEqualTo(PDF.length);
        assertThat(response.getTaskId()).isEqualTo(5L);
        assertThat(response.getProjectId()).isEqualTo(10L);
        assertThat(response.getUploadedByName()).isEqualTo("dev.chen");
        verify(projectAccessGuard).assertCan(member, 10L, Resource.ATTACHMENT, Action.CREATE);
        ArgumentCaptor<AttachmentContent> content = ArgumentCaptor.forClass(AttachmentContent.class);
        verify(contentRepository).save(content.capture());
        assertThat(content.getValue().getAttachmentId()).isEqualTo(77L);
        assertThat(content.getValue().getData()).isEqualTo(PDF);
        verify(activityLogService).record(eq(member), eq(task), eq("FILE_UPLOADED"), any());
    }

    @Test
    void uploadingToAProject_isLoggedAsAProjectEvent() {
        AttachmentResponse response = service.upload(pdf("brief.pdf"), null, 10L, "dev.chen");

        assertThat(response.getTaskId()).isNull();
        assertThat(response.getProjectId()).isEqualTo(10L);
        verify(activityLogService).recordProjectEvent(eq(member), eq(project), eq("FILE_UPLOADED"), any());
    }

    @Test
    void aViewer_cannotUpload() {
        doThrow(new AccessDeniedException("You do not have permission to create attachments in this project"))
                .when(projectAccessGuard).assertCan(member, 10L, Resource.ATTACHMENT, Action.CREATE);

        assertThatThrownBy(() -> service.upload(pdf("a.pdf"), 5L, null, "dev.chen"))
                .isInstanceOf(AccessDeniedException.class);
        verify(attachmentRepository, never()).save(any());
        verify(contentRepository, never()).save(any());
    }

    @Test
    void needsExactlyOneTarget() {
        assertThatThrownBy(() -> service.upload(pdf("a.pdf"), null, null, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not both");
        assertThatThrownBy(() -> service.upload(pdf("a.pdf"), 5L, 10L, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void refusesAFileOverTheSizeLimit() {
        MockMultipartFile big = new MockMultipartFile("file", "big.pdf", "application/pdf", new byte[2000]);

        assertThatThrownBy(() -> service.upload(big, 5L, null, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("too large");
        verify(attachmentRepository, never()).save(any());
    }

    @Test
    void refusesAFileThatIsNotWhatItsNameSays_orNotAllowed() {
        assertThatThrownBy(() -> service.upload(
                new MockMultipartFile("file", "run.exe", "application/octet-stream", PDF), 5L, null, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not allowed");
        assertThatThrownBy(() -> service.upload(
                new MockMultipartFile("file", "fake.pdf", "application/pdf", "not a pdf".getBytes()), 5L, null, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match");
        verify(attachmentRepository, never()).save(any());
    }

    @Test
    void refusesAnEmptyUpload() {
        assertThatThrownBy(() -> service.upload(new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[0]),
                5L, null, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No file");
    }

    @Test
    void aTaskHoldsOnlySoManyFiles() {
        when(attachmentRepository.countByTaskId(5L)).thenReturn(2L);

        assertThatThrownBy(() -> service.upload(pdf("a.pdf"), 5L, null, "dev.chen"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at most 2 files");
    }

    @Test
    void anUnknownTaskOrProject_isNotFound() {
        assertThatThrownBy(() -> service.upload(pdf("a.pdf"), 404L, null, "dev.chen"))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.upload(pdf("a.pdf"), null, 404L, "dev.chen"))
                .isInstanceOf(NotFoundException.class);
    }

    // ---- list and download --------------------------------------------------------

    @Test
    void listingChecksMembership() {
        org.mockito.Mockito.doThrow(new NotFoundException("Project not found"))
                .when(projectAccessGuard).assertAccess(member, 10L);

        assertThatThrownBy(() -> service.getByTask(5L, "dev.chen")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.getByProject(10L, "dev.chen")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void listsTheFilesOfATask() {
        Attachment a = stored(leader);
        when(attachmentRepository.findByTaskIdOrderByUploadedAtDescIdDesc(5L)).thenReturn(List.of(a));

        assertThat(service.getByTask(5L, "dev.chen")).extracting(AttachmentResponse::getFileName).containsExactly("spec.pdf");
    }

    @Test
    void downloadingReturnsTheStoredBytes_toAMemberOnly() {
        stored(leader);
        when(contentRepository.findById(77L)).thenReturn(Optional.of(new AttachmentContent(77L, PDF)));

        AttachmentService.Download file = service.download(77L, "dev.chen");

        assertThat(file.fileName()).isEqualTo("spec.pdf");
        assertThat(file.mimeType()).isEqualTo("application/pdf");
        assertThat(file.bytes()).isEqualTo(PDF);
        verify(projectAccessGuard).assertAccess(member, 10L);
    }

    @Test
    void downloadingFromAProjectYouCannotSee_looksLikeAMissingProject() {
        stored(leader);
        org.mockito.Mockito.doThrow(new NotFoundException("Project not found"))
                .when(projectAccessGuard).assertAccess(member, 10L);

        assertThatThrownBy(() -> service.download(77L, "dev.chen")).isInstanceOf(NotFoundException.class);
        verify(contentRepository, never()).findById(any());
    }

    // ---- delete ------------------------------------------------------------------------

    @Test
    void theUploader_deletesTheirOwnFile_evenWithoutDeleteRights() {
        Attachment a = stored(member);

        service.delete(77L, "dev.chen");

        verify(attachmentRepository).delete(a);
    }

    @Test
    void aTeamLeader_deletesSomeoneElsesFile() {
        Attachment a = stored(member);
        when(projectAccessGuard.can(leader, 10L, Resource.ATTACHMENT, Action.DELETE)).thenReturn(true);

        service.delete(77L, "lead.owen");

        verify(attachmentRepository).delete(a);
    }

    @Test
    void aMember_cannotDeleteSomeoneElsesFile() {
        stored(leader);
        when(projectAccessGuard.can(member, 10L, Resource.ATTACHMENT, Action.DELETE)).thenReturn(false);

        assertThatThrownBy(() -> service.delete(77L, "dev.chen"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("you uploaded");
        verify(attachmentRepository, never()).delete(any());
    }
}
