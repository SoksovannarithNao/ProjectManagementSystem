package backend.util;

import java.util.List;

// Optional paging of a list endpoint (checklist risk R-5): ?page=0&size=50. A request without
// either parameter is not paged and gets the whole list as before; one of the two alone is
// filled in with the default (page 0, size 50). Pages count from 0 and a page is at most
// MAX_SIZE long.
public final class PageParams {

    public static final int DEFAULT_SIZE = 50;
    public static final int MAX_SIZE = 200;

    private final int page;
    private final int size;

    private PageParams(int page, int size) {
        this.page = page;
        this.size = size;
    }

    // null when neither parameter was sent; an out-of-range value is a 400 (IllegalArgumentException).
    public static PageParams of(Integer page, Integer size) {
        if (page == null && size == null) {
            return null;
        }
        int p = page == null ? 0 : page;
        int s = size == null ? DEFAULT_SIZE : size;
        if (p < 0) {
            throw new IllegalArgumentException("Invalid page: " + p);
        }
        if (s < 1 || s > MAX_SIZE) {
            throw new IllegalArgumentException("Invalid size: " + s + " (1 to " + MAX_SIZE + ")");
        }
        return new PageParams(p, s);
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    // The requested page of an already filtered and ordered list; empty past the end.
    public <T> List<T> slice(List<T> items) {
        long from = (long) page * size;
        if (from >= items.size()) {
            return List.of();
        }
        return items.subList((int) from, (int) Math.min(items.size(), from + size));
    }
}
