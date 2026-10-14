package backend.dto;

import java.util.List;

// One page of a list, with how many items match in all (so a screen can say "20 of 340" and
// know when to stop). Returned by the list endpoints only when ?page or ?size is sent.
public class PageResponse<T> {

    private final List<T> items;
    private final long total;
    private final int page;
    private final int size;

    public PageResponse(List<T> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<T> getItems() {
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
