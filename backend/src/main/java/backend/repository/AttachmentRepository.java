package backend.repository;

import backend.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findByTaskIdOrderByUploadedAtDescIdDesc(Long taskId);

    List<Attachment> findByProjectIdOrderByUploadedAtDescIdDesc(Long projectId);

    long countByTaskId(Long taskId);

    long countByProjectId(Long projectId);
}
