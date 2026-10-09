package backend.util;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;

// What may be uploaded as an attachment. A client-supplied Content-Type and
// file name are only claims, so this decides from three things the server can
// check itself:
//   1. the extension must be on a short allow-list (no executables, scripts,
//      HTML or SVG - anything a browser could run);
//   2. the stored MIME type comes from that extension, never from the client;
//   3. the first bytes must look like the format the extension names (a
//      renamed .exe does not pass as .pdf), and plain-text types must hold no
//      binary NUL bytes.
// Downloads are additionally served as attachments with nosniff (see
// AttachmentController), so a file is never rendered by the browser.
public final class FileTypeGuard {

    public record Checked(String fileName, String mimeType) {
    }

    private static final int MAX_NAME_LENGTH = 200;

    private static final Map<String, String> MIME_BY_EXTENSION = Map.ofEntries(
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("gif", "image/gif"),
            Map.entry("webp", "image/webp"),
            Map.entry("pdf", "application/pdf"),
            Map.entry("txt", "text/plain"),
            Map.entry("md", "text/markdown"),
            Map.entry("csv", "text/csv"),
            Map.entry("json", "application/json"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("odt", "application/vnd.oasis.opendocument.text"),
            Map.entry("ods", "application/vnd.oasis.opendocument.spreadsheet"),
            Map.entry("odp", "application/vnd.oasis.opendocument.presentation"),
            Map.entry("zip", "application/zip"));

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] GIF87 = "GIF87a".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] GIF89 = "GIF89a".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] PDF = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] ZIP = {'P', 'K', 0x03, 0x04};
    private static final byte[] ZIP_EMPTY = {'P', 'K', 0x05, 0x06};
    private static final byte[] OLE = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1};

    private FileTypeGuard() {
    }

    public static String allowedExtensions() {
        return String.join(", ", new TreeSet<>(MIME_BY_EXTENSION.keySet()));
    }

    // Returns the cleaned name and the MIME type to store, or throws
    // IllegalArgumentException with a message that is safe to show the user.
    public static Checked check(String originalName, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("The file is empty");
        }
        String name = cleanName(originalName);
        int dot = name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mime = MIME_BY_EXTENSION.get(extension);
        if (mime == null) {
            throw new IllegalArgumentException("This type of file is not allowed"
                    + (extension.isEmpty() ? "" : " (." + extension + ")")
                    + ". Allowed: " + allowedExtensions());
        }
        if (!contentMatches(extension, bytes)) {
            throw new IllegalArgumentException("The content of the file does not match its ." + extension + " type");
        }
        return new Checked(name, mime);
    }

    // Drops any folder part and characters that have no business in a file
    // name (control characters, quotes, angle brackets, path separators),
    // trims, and shortens an over-long name while keeping its extension.
    static String cleanName(String originalName) {
        String name = originalName == null ? "" : originalName;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        StringBuilder cleaned = new StringBuilder();
        for (char c : name.toCharArray()) {
            if (c < 0x20 || c == 0x7F || "\"<>:|?*".indexOf(c) >= 0) {
                continue;
            }
            cleaned.append(c);
        }
        name = cleaned.toString().trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) {
            throw new IllegalArgumentException("The file has no usable name");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            int dot = name.lastIndexOf('.');
            String extension = dot > 0 && name.length() - dot <= 10 ? name.substring(dot) : "";
            name = name.substring(0, MAX_NAME_LENGTH - extension.length()) + extension;
        }
        return name;
    }

    private static boolean contentMatches(String extension, byte[] b) {
        return switch (extension) {
            case "png" -> startsWith(b, PNG);
            case "jpg", "jpeg" -> startsWith(b, JPEG);
            case "gif" -> startsWith(b, GIF87) || startsWith(b, GIF89);
            case "webp" -> b.length >= 12 && startsWith(b, "RIFF".getBytes(StandardCharsets.US_ASCII))
                    && Arrays.equals(Arrays.copyOfRange(b, 8, 12), "WEBP".getBytes(StandardCharsets.US_ASCII));
            case "pdf" -> startsWith(b, PDF);
            case "zip", "docx", "xlsx", "pptx", "odt", "ods", "odp" -> startsWith(b, ZIP) || startsWith(b, ZIP_EMPTY);
            case "doc", "xls", "ppt" -> startsWith(b, OLE);
            default -> looksLikeText(b); // txt, md, csv, json
        };
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    // Plain text has no NUL bytes; a binary file renamed to .txt does.
    private static boolean looksLikeText(byte[] b) {
        int limit = Math.min(b.length, 8192);
        for (int i = 0; i < limit; i++) {
            if (b[i] == 0) {
                return false;
            }
        }
        return true;
    }
}
