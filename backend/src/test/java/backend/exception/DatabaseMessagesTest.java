package backend.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// What reaches a person when PostgreSQL refuses a write (issue I-11): never a table, column or constraint name.
class DatabaseMessagesTest {

    private static String unique(String constraint) {
        return "ERROR: duplicate key value violates unique constraint \"" + constraint + "\"\n  Detail: Key (x)=(y) already exists.";
    }

    private static String check(String relation, String constraint) {
        return "ERROR: new row for relation \"" + relation + "\" violates check constraint \"" + constraint + "\"\n  Detail: Failing row contains (1, 2).";
    }

    @Test
    void aTakenUsernameOrEmail_saysSoWithoutNamingTheIndex() {
        assertThat(DatabaseMessages.forViolation(unique("idx_users_username_lower"))).isEqualTo("That username is already taken.");
        assertThat(DatabaseMessages.forViolation(unique("idx_users_email_lower"))).isEqualTo("That email address is already registered.");
    }

    @Test
    void theOtherKnownUniqueConstraints_haveTheirOwnSentence() {
        assertThat(DatabaseMessages.forViolation(unique("idx_departments_name_lower"))).isEqualTo("A department with that name already exists.");
        assertThat(DatabaseMessages.forViolation(unique("roles_name_key"))).isEqualTo("A role with that name already exists.");
        assertThat(DatabaseMessages.forViolation(unique("task_assignees_task_id_user_id_key"))).isEqualTo("That person is already assigned to this task.");
        assertThat(DatabaseMessages.forViolation(unique("uq_task_approvals_one_pending")))
                .isEqualTo("This task already has an approval request waiting for a decision.");
    }

    @Test
    void anUnknownUniqueConstraint_getsAGeneralSentence() {
        String message = DatabaseMessages.forViolation(unique("kpi_snapshots_snapshot_date_project_id_key"));

        assertThat(message).isEqualTo("That value is already in use.");
    }

    @Test
    void theDateAndNumberChecks_sayWhatIsWrong() {
        assertThat(DatabaseMessages.forViolation(check("tasks", "tasks_check"))).isEqualTo("The task due date cannot be before its start date.");
        assertThat(DatabaseMessages.forViolation(check("projects", "projects_check"))).isEqualTo("The project end date cannot be before its start date.");
        assertThat(DatabaseMessages.forViolation(check("tasks", "tasks_progress_check"))).isEqualTo("Progress must be between 0 and 100.");
        assertThat(DatabaseMessages.forViolation(check("work_logs", "work_logs_hours_worked_check"))).isEqualTo("Hours worked must be more than 0.");
    }

    @Test
    void aStatusOrPriorityCheck_andAnyOtherCheck_getGeneralSentences() {
        assertThat(DatabaseMessages.forViolation(check("tasks", "tasks_status_check"))).isEqualTo("That status is not allowed.");
        assertThat(DatabaseMessages.forViolation(check("projects", "projects_priority_check"))).isEqualTo("That priority is not allowed.");
        assertThat(DatabaseMessages.forViolation(check("users", "users_theme_preference_check"))).isEqualTo("One or more values are not allowed.");
    }

    @Test
    void aForeignKeyAndAMissingRequiredValue_getGeneralSentences() {
        String foreignKey = "ERROR: update or delete on table \"projects\" violates foreign key constraint \"fk_tasks_project\" on table \"tasks\"";
        String notNull = "ERROR: null value in column \"title\" of relation \"tasks\" violates not-null constraint\n  Detail: Failing row contains (null).";

        assertThat(DatabaseMessages.forViolation(foreignKey)).isEqualTo("This item is linked to other records, so the change is not allowed.");
        assertThat(DatabaseMessages.forViolation(notNull)).isEqualTo("A required value is missing.");
    }

    @Test
    void noMessageReachesAPersonWithADatabaseName() {
        for (String raw : new String[] { unique("idx_users_username_lower"), unique("something_new_key"), check("tasks", "tasks_check"),
                check("users", "users_account_status_check"), "ERROR: update or delete on table \"x\" violates foreign key constraint \"y\" on table \"z\"" }) {
            assertThat(DatabaseMessages.forViolation(raw)).doesNotContain("idx_", "_key", "_check", "relation", "constraint", "\"");
        }
    }

    @Test
    void aTriggerMessage_passesThroughWithoutThePrefixOrTheWhereLine() {
        String raised = "ERROR: Task due_date (2026-09-18) cannot be later than its project end_date (2026-07-01)\n  Where: PL/pgSQL function check_task_dates() line 5";

        assertThat(DatabaseMessages.forViolation(raised))
                .isEqualTo("Task due_date (2026-09-18) cannot be later than its project end_date (2026-07-01)");
    }

    @Test
    void aMissingMessage_isAGeneralSentence() {
        assertThat(DatabaseMessages.forViolation(null)).isEqualTo("One or more fields are invalid");
        assertThat(DatabaseMessages.forViolation("  ")).isEqualTo("One or more fields are invalid");
    }
}
