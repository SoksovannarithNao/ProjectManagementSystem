package backend.util;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// What may be uploaded: an allow-list of extensions, the MIME type from the
// extension (never from the client), and a check that the first bytes look like
// the format the extension names.
class FileTypeGuardTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0};
    private static final byte[] PDF = "%PDF-1.7\n".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] ZIP = {'P', 'K', 0x03, 0x04, 0, 0};
    private static final byte[] OLE = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1, 0};
    private static final byte[] TEXT = "hello, world\n".getBytes(StandardCharsets.UTF_8);

    @Test
    void acceptsEachAllowedFormat_andStoresTheMimeTypeFromTheExtension() {
        assertThat(FileTypeGuard.check("logo.png", PNG).mimeType()).isEqualTo("image/png");
        assertThat(FileTypeGuard.check("photo.JPG", JPEG).mimeType()).isEqualTo("image/jpeg");
        assertThat(FileTypeGuard.check("spec.pdf", PDF).mimeType()).isEqualTo("application/pdf");
        assertThat(FileTypeGuard.check("report.docx", ZIP).mimeType())
                .isEqualTo("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        assertThat(FileTypeGuard.check("old.xls", OLE).mimeType()).isEqualTo("application/vnd.ms-excel");
        assertThat(FileTypeGuard.check("notes.txt", TEXT).mimeType()).isEqualTo("text/plain");
        assertThat(FileTypeGuard.check("data.csv", TEXT).mimeType()).isEqualTo("text/csv");
        assertThat(FileTypeGuard.check("bundle.zip", ZIP).mimeType()).isEqualTo("application/zip");
    }

    @Test
    void refusesAnythingABrowserOrTheServerCouldRun() {
        for (String name : new String[] {"setup.exe", "run.sh", "page.html", "image.svg", "app.js", "mac.bat", "x.jar", "doc.docm"}) {
            assertThatThrownBy(() -> FileTypeGuard.check(name, TEXT))
                    .as(name)
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not allowed");
        }
    }

    @Test
    void refusesAFileWithNoExtension() {
        assertThatThrownBy(() -> FileTypeGuard.check("README", TEXT))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    void aRenamedFileDoesNotPassForSomethingElse() {
        assertThatThrownBy(() -> FileTypeGuard.check("invoice.pdf", ZIP))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match");
        assertThatThrownBy(() -> FileTypeGuard.check("picture.png", TEXT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FileTypeGuard.check("notes.txt", new byte[] {'a', 0, 'b'}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match");
        assertThatThrownBy(() -> FileTypeGuard.check("sheet.xlsx", PDF))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void refusesAnEmptyFile() {
        assertThatThrownBy(() -> FileTypeGuard.check("empty.txt", new byte[0]))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("The file is empty");
    }

    @Test
    void cleansTheFileName_ofFoldersAndOddCharacters() {
        assertThat(FileTypeGuard.check("../../etc/passwd.txt", TEXT).fileName()).isEqualTo("passwd.txt");
        assertThat(FileTypeGuard.check("C:\\Users\\me\\plan.txt", TEXT).fileName()).isEqualTo("plan.txt");
        assertThat(FileTypeGuard.check("we\"ird<na>me|.txt", TEXT).fileName()).isEqualTo("weirdname.txt");
        assertThat(FileTypeGuard.check("tab\tand\nnewline.txt", TEXT).fileName()).isEqualTo("tabandnewline.txt");
    }

    @Test
    void refusesANameThatIsNothingButJunk() {
        assertThatThrownBy(() -> FileTypeGuard.check("..", TEXT)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FileTypeGuard.check("\"<>", TEXT)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FileTypeGuard.check(null, TEXT)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shortensAnOverLongName_keepingItsExtension() {
        String name = "a".repeat(400) + ".pdf";

        String cleaned = FileTypeGuard.check(name, PDF).fileName();

        assertThat(cleaned).hasSize(200).endsWith(".pdf");
    }
}
