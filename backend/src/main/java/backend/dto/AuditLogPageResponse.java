package backend.dto;

import java.util.List;

// One page of audit entries, newest first, with the total that match the filters.
public class AuditLogPageResponse {

    private final List<AuditLogResponse> items;
    private final long total;
    private final int page;
    private final int size;

    public AuditLogPageResponse(List<AuditLogResponse> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<AuditLogResponse> getItems() {
        return items;
    }

    public long getTotal() {
        return total;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }
}
