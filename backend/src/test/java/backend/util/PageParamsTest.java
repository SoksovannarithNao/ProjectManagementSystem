package backend.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// ?page and ?size on the list endpoints (checklist risk R-5).
class PageParamsTest {

    @Test
    void withNeitherParameterThereIsNoPaging() {
        assertThat(PageParams.of(null, null)).isNull();
    }

    @Test
    void oneParameterAloneIsFilledInWithTheDefault() {
        PageParams sizeOnly = PageParams.of(null, 20);
        assertThat(sizeOnly.getPage()).isZero();
        assertThat(sizeOnly.getSize()).isEqualTo(20);

        PageParams pageOnly = PageParams.of(3, null);
        assertThat(pageOnly.getPage()).isEqualTo(3);
        assertThat(pageOnly.getSize()).isEqualTo(PageParams.DEFAULT_SIZE);
    }

    @Test
    void anOutOfRangePageOrSizeIsRefused() {
        assertThatThrownBy(() -> PageParams.of(-1, 10)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("page");
        assertThatThrownBy(() -> PageParams.of(0, 0)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("size");
        assertThatThrownBy(() -> PageParams.of(0, PageParams.MAX_SIZE + 1)).isInstanceOf(IllegalArgumentException.class);
        assertThat(PageParams.of(0, PageParams.MAX_SIZE).getSize()).isEqualTo(PageParams.MAX_SIZE);
    }

    @Test
    void sliceReturnsTheRequestedPageAndNothingPastTheEnd() {
        List<Integer> items = List.of(1, 2, 3, 4, 5);

        assertThat(PageParams.of(0, 2).slice(items)).containsExactly(1, 2);
        assertThat(PageParams.of(1, 2).slice(items)).containsExactly(3, 4);
        assertThat(PageParams.of(2, 2).slice(items)).containsExactly(5);
        assertThat(PageParams.of(3, 2).slice(items)).isEmpty();
        assertThat(PageParams.of(0, 10).slice(items)).containsExactlyElementsOf(items);
        assertThat(PageParams.of(0, 5).slice(List.of())).isEmpty();
    }
}
