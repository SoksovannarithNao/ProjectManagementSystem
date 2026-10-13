package backend.util;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// @mentions in a comment (G-14, D-21): who a text mentions among a project's active members.
class MentionsTest {

    private static final Map<String, String> MEMBERS = Mentions.byLowerCase(
            List.of("pm.olivia", "dev.chen", "qa.zoe", "lead.owen", "dev"));

    @Test
    void aMention_isAnAtSignAndAMembersUsername() {
        assertThat(Mentions.resolve("Please review @dev.chen", MEMBERS)).containsExactly("dev.chen");
    }

    @Test
    void severalMentions_areListedOnceEachInTheOrderTheyAppear() {
        assertThat(Mentions.resolve("@qa.zoe and @pm.olivia, then @qa.zoe again", MEMBERS))
                .containsExactly("qa.zoe", "pm.olivia");
    }

    @Test
    void theCaseIsIgnored_andTheStoredUsernameIsReturned() {
        assertThat(Mentions.resolve("hi @DEV.Chen", MEMBERS)).containsExactly("dev.chen");
    }

    @Test
    void punctuationAfterTheName_isNotPartOfIt() {
        assertThat(Mentions.resolve("Thanks @dev.chen. And @pm.olivia, @qa.zoe!", MEMBERS))
                .containsExactly("dev.chen", "pm.olivia", "qa.zoe");
        assertThat(Mentions.resolve("(cc @lead.owen)", MEMBERS)).containsExactly("lead.owen");
    }

    @Test
    void aNameThatIsNotAMember_mentionsNobody() {
        assertThat(Mentions.resolve("@nobody and @admin.system", MEMBERS)).isEmpty();
    }

    @Test
    void aLongerNameIsNeverReadAsAShorterMember() {
        // "@dev.chenx" must not mention "dev" or "dev.chen"
        assertThat(Mentions.resolve("@dev.chenx", MEMBERS)).isEmpty();
        assertThat(Mentions.resolve("@dev.chen.smith", MEMBERS)).isEmpty();
    }

    @Test
    void anEmailAddress_isNotAMention() {
        assertThat(Mentions.resolve("write to jane@dev.chen or a@@dev.chen", MEMBERS)).isEmpty();
    }

    @Test
    void anAtSignAloneOrANullText_isNothing() {
        assertThat(Mentions.resolve("@ and @@ and @ dev.chen", MEMBERS)).isEmpty();
        assertThat(Mentions.resolve(null, MEMBERS)).isEmpty();
        assertThat(Mentions.resolve("@dev.chen", Map.of())).isEmpty();
    }

    @Test
    void aMentionAtTheStartOrAfterANewline_counts() {
        assertThat(Mentions.resolve("@dev.chen\n@qa.zoe", MEMBERS)).containsExactly("dev.chen", "qa.zoe");
    }
}
