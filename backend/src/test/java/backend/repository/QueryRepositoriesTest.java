package backend.repository;

import backend.entity.Task;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceUnit;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

// The custom queries of the repositories, run against the real PostgreSQL schema (the one the init
// scripts build, with the demo data CI loads) and compared with the same question asked in plain SQL
// over the same rows, so they hold whatever the data is. Nothing is saved: each test runs in a
// transaction that is rolled back. Mocked repositories in the service tests cannot catch a JPQL query
// that is wrong, a column that was renamed or a grouping that drops a row; this can.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class QueryRepositoriesTest {

    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private SubtaskRepository subtaskRepository;
    @Autowired
    private ChecklistItemRepository checklistItemRepository;
    @Autowired
    private WorkLogRepository workLogRepository;
    @Autowired
    private TaskDependencyRepository taskDependencyRepository;
    @Autowired
    private ProjectMemberRepository projectMemberRepository;
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private EntityManager entityManager;
    @PersistenceUnit
    private EntityManagerFactory entityManagerFactory;

    private List<Long> ids(String sql, Object... args) {
        return jdbc.queryForList(sql, Long.class, args);
    }

    // ---- tasks ----

    @Test
    void projectTaskStats_matchTheTasksTable_cancelledLeftOut_overdueOnlyForOpenTasks() {
        LocalDate today = jdbc.queryForObject("select current_date", LocalDate.class);
        Map<Long, List<Long>> expected = new HashMap<>();
        jdbc.query("select project_id, "
                        + "count(*) filter (where status <> 'CANCELLED'), "
                        + "count(*) filter (where status = 'COMPLETED'), "
                        + "count(*) filter (where status not in ('COMPLETED', 'CANCELLED') and due_date < ?) "
                        + "from tasks group by project_id",
                rs -> {
                    expected.put(rs.getLong(1), List.of(rs.getLong(2), rs.getLong(3), rs.getLong(4)));
                }, today);

        Map<Long, List<Long>> actual = new HashMap<>();
        for (TaskRepository.ProjectTaskStats row : taskRepository.statsByProject(today)) {
            actual.put(row.getProjectId(), List.of(row.getTotal(), row.getCompleted(), row.getOverdue()));
        }

        assertThat(expected).isNotEmpty();
        assertThat(actual).isEqualTo(expected);
    }

    @Test
    void taskLists_loadTheirProjectAndPeopleInTheSameStatement() {
        entityManager.clear();

        List<Task> tasks = taskRepository.findAll();

        assertThat(tasks).isNotEmpty();
        var util = entityManagerFactory.getPersistenceUnitUtil();
        // the @EntityGraph: a list is built from what the first query loaded, so a project deleted
        // meanwhile cannot fail it half way
        assertThat(tasks).allSatisfy(t -> {
            assertThat(util.isLoaded(t, "project")).isTrue();
            assertThat(util.isLoaded(t, "milestone")).isTrue();
            assertThat(util.isLoaded(t, "createdBy")).isTrue();
            assertThat(util.isLoaded(t, "approver")).isTrue();
        });
        Long someProject = tasks.get(0).getProject().getId();
        assertThat(taskRepository.findByProjectIdIn(List.of(someProject)))
                .extracting(t -> t.getProject().getId()).containsOnly(someProject);
        assertThat(taskRepository.findByProjectIdIn(List.of(someProject)))
                .hasSize(jdbc.queryForObject("select count(*) from tasks where project_id = ?", Integer.class, someProject));
    }

    // ---- the grouped counts that feed a task list ----

    @Test
    void subtaskAndChecklistCounts_matchTheirTables() {
        List<Long> taskIds = ids("select id from tasks");
        Map<Long, List<Long>> expectedSubtasks = new HashMap<>();
        jdbc.query("select task_id, count(*), count(*) filter (where status = 'COMPLETED') from subtasks group by task_id",
                rs -> { expectedSubtasks.put(rs.getLong(1), List.of(rs.getLong(2), rs.getLong(3))); });
        Map<Long, List<Long>> expectedItems = new HashMap<>();
        jdbc.query("select task_id, count(*), count(*) filter (where is_completed) from checklist_items group by task_id",
                rs -> { expectedItems.put(rs.getLong(1), List.of(rs.getLong(2), rs.getLong(3))); });

        Map<Long, List<Long>> subtasks = subtaskRepository.countByTaskIds(taskIds).stream()
                .collect(Collectors.toMap(SubtaskRepository.SubtaskCounts::getTaskId, r -> List.of(r.getTotal(), r.getCompleted())));
        Map<Long, List<Long>> items = checklistItemRepository.countByTaskIds(taskIds).stream()
                .collect(Collectors.toMap(ChecklistItemRepository.ChecklistCounts::getTaskId, r -> List.of(r.getTotal(), r.getCompleted())));

        assertThat(expectedSubtasks).isNotEmpty();
        assertThat(subtasks).isEqualTo(expectedSubtasks);
        assertThat(expectedItems).isNotEmpty();
        assertThat(items).isEqualTo(expectedItems);
    }

    @Test
    void loggedHours_perTask_perTaskId_andPerPerson_matchTheWorkLogs() {
        List<Long> taskIds = ids("select id from tasks");
        Map<Long, BigDecimal> expected = new HashMap<>();
        jdbc.query("select task_id, sum(hours_worked) from work_logs group by task_id",
                rs -> { expected.put(rs.getLong(1), rs.getBigDecimal(2)); });

        Map<Long, BigDecimal> grouped = workLogRepository.sumHoursByTaskIds(taskIds).stream()
                .collect(Collectors.toMap(WorkLogRepository.TaskHours::getTaskId, WorkLogRepository.TaskHours::getHours));

        assertThat(expected).isNotEmpty();
        assertThat(grouped).hasSameSizeAs(expected);
        expected.forEach((taskId, hours) -> {
            assertThat(grouped.get(taskId)).isEqualByComparingTo(hours);
            assertThat(workLogRepository.sumHoursByTaskId(taskId)).isEqualByComparingTo(hours);
        });
        // a task nobody logged time on is 0, not null
        Long unlogged = ids("select id from tasks where id not in (select task_id from work_logs) limit 1").stream().findFirst().orElse(null);
        if (unlogged != null) {
            assertThat(workLogRepository.sumHoursByTaskId(unlogged)).isEqualByComparingTo(BigDecimal.ZERO);
        }

        List<Long> projectIds = ids("select id from projects");
        Map<Long, BigDecimal> byPerson = new HashMap<>();
        jdbc.query("select w.user_id, sum(w.hours_worked) from work_logs w join tasks t on t.id = w.task_id "
                        + "where t.project_id = any (?) group by w.user_id",
                ps -> ps.setArray(1, ps.getConnection().createArrayOf("bigint", projectIds.toArray())),
                rs -> { byPerson.put(rs.getLong(1), rs.getBigDecimal(2)); });
        Map<Long, BigDecimal> perPerson = workLogRepository.sumHoursByUserForProjects(projectIds).stream()
                .collect(Collectors.toMap(WorkLogRepository.UserHours::getUserId, WorkLogRepository.UserHours::getHours));
        assertThat(perPerson).hasSameSizeAs(byPerson);
        byPerson.forEach((userId, hours) -> assertThat(perPerson.get(userId)).isEqualByComparingTo(hours));
    }

    @Test
    void blockingTasks_areTheUnfinishedPrerequisitesOfEachTask() {
        List<Long> taskIds = ids("select id from tasks");
        Map<Long, Long> expected = new HashMap<>();
        jdbc.query("select td.task_id, count(*) from task_dependencies td join tasks d on d.id = td.depends_on_task_id "
                        + "where d.status <> 'COMPLETED' group by td.task_id",
                rs -> { expected.put(rs.getLong(1), rs.getLong(2)); });

        Map<Long, Long> blocking = taskDependencyRepository.findBlockingTasks(taskIds).stream()
                .collect(Collectors.groupingBy(TaskDependencyRepository.BlockingTaskRow::getTaskId, Collectors.counting()));

        assertThat(expected).isNotEmpty();
        assertThat(blocking).isEqualTo(expected);
        // a task with nothing blocking it is not in the result at all
        assertThat(blocking.keySet()).allMatch(expected::containsKey);
    }

    // ---- who may see what: the project memberships ----

    @Test
    void visibleProjectIds_areTheActiveMembershipsOnly_forEveryUser() {
        for (Long userId : ids("select id from users")) {
            Set<Long> expected = Set.copyOf(ids("select project_id from project_members where user_id = ? and status = 'ACTIVE'", userId));
            assertThat(Set.copyOf(projectMemberRepository.findProjectIdsByUserId(userId))).as("user %d", userId).isEqualTo(expected);

            Set<Long> admin = Set.copyOf(ids("select project_id from project_members where user_id = ? and status = 'ACTIVE' "
                    + "and project_role in ('OWNER', 'ADMIN')", userId));
            assertThat(Set.copyOf(projectMemberRepository.findActiveAdminProjectIds(userId))).as("admin of, user %d", userId).isEqualTo(admin);
        }
    }

    @Test
    void soleActiveOwner_isTheOwnerOfAProjectWithNoOtherActiveOwner() {
        for (Long userId : ids("select id from users")) {
            Set<Long> expected = Set.copyOf(ids("select pm.project_id from project_members pm where pm.user_id = ? "
                    + "and pm.status = 'ACTIVE' and pm.project_role = 'OWNER' and (select count(*) from project_members o "
                    + "where o.project_id = pm.project_id and o.status = 'ACTIVE' and o.project_role = 'OWNER') = 1", userId));
            assertThat(Set.copyOf(projectMemberRepository.findProjectIdsWhereSoleActiveOwner(userId))).as("user %d", userId).isEqualTo(expected);
        }
        assertThat(ids("select count(*) from project_members where status = 'ACTIVE' and project_role = 'OWNER'").get(0)).isGreaterThan(0);
    }

    @Test
    void coMembers_areEveryoneActiveOnASharedProject_theUserIncluded() {
        for (Long userId : ids("select id from users limit 8")) {
            Set<Long> expected = Set.copyOf(ids("select distinct b.user_id from project_members a join project_members b "
                    + "on b.project_id = a.project_id where a.user_id = ? and a.status = 'ACTIVE' and b.status = 'ACTIVE'", userId));
            assertThat(Set.copyOf(projectMemberRepository.findActiveCoMemberUserIds(userId))).as("user %d", userId).isEqualTo(expected);
        }
    }

    @Test
    void invitableUsers_areActiveAccountsOutsideTheProjectApartFromTheCaller() {
        Long projectId = ids("select project_id from project_members where status = 'PENDING' limit 1").get(0);
        Long callerId = ids("select user_id from project_members where project_id = ? and status = 'ACTIVE' limit 1", projectId).get(0);

        var found = userRepository.findInvitableUsers(projectId, callerId, "%", PageRequest.of(0, 1000));

        Set<Long> expected = Set.copyOf(ids("select u.id from users u where u.account_status = 'ACTIVE' and u.id <> ? and not exists ("
                + "select 1 from project_members pm where pm.project_id = ? and pm.user_id = u.id and pm.status in ('ACTIVE', 'PENDING'))",
                callerId, projectId));
        assertThat(found).extracting(u -> u.getId()).containsExactlyInAnyOrderElementsOf(expected);
        assertThat(found).allSatisfy(u -> assertThat(u.getAccountStatus()).isEqualTo("ACTIVE"));
        assertThat(found).extracting(u -> u.getId()).doesNotContain(callerId);
        // ordered by name, and a narrower pattern narrows the list (the '!' escape is how the service builds it)
        assertThat(found).extracting(u -> u.getFullName()).isSortedAccordingTo(String.CASE_INSENSITIVE_ORDER.thenComparing(String::compareTo));
        var one = found.get(0);
        assertThat(userRepository.findInvitableUsers(projectId, callerId, "%" + one.getUsername().toLowerCase() + "%", PageRequest.of(0, 50)))
                .extracting(u -> u.getId()).contains(one.getId());
    }

    // ---- users and projects ----

    @Test
    void userLookups_ignoreCase_whereTheyAreMeantTo_andReadTheStatusWithoutTheEntity() {
        String username = jdbc.queryForObject("select username from users where account_status = 'ACTIVE' order by id limit 1", String.class);
        String email = jdbc.queryForObject("select email from users where username = ?", String.class, username);

        assertThat(userRepository.findByUsername(username)).isPresent();
        assertThat(userRepository.findByUsername(username.toUpperCase().equals(username) ? username.toLowerCase() : username.toUpperCase()))
                .as("the exact lookup is case-sensitive").isEmpty();
        assertThat(userRepository.findByUsernameIgnoreCase(username.toUpperCase())).isPresent();
        assertThat(userRepository.existsByUsernameIgnoreCase(username.toUpperCase())).isTrue();
        assertThat(userRepository.findByEmailIgnoreCase(email.toUpperCase())).isPresent();
        assertThat(userRepository.findAccountStatusByUsername(username)).contains("ACTIVE");
        assertThat(userRepository.findAccountStatusByUsername("nobody.at.all")).isEmpty();
        assertThat(userRepository.findAllWithRoles()).hasSize(jdbc.queryForObject("select count(*) from users", Integer.class));
    }

    @Test
    void autoProjectCodes_areOnlyThoseThatLookGenerated_andTheCodeLockCanBeTaken() {
        Set<String> expected = Set.copyOf(jdbc.queryForList("select project_code from projects where project_code like 'PRJ-%'", String.class));

        assertThat(Set.copyOf(projectRepository.findAutoProjectCodes())).isEqualTo(expected);
        assertThat(expected).isNotEmpty();
        // the advisory lock of the code generator runs on PostgreSQL (it is held to the end of the transaction)
        projectRepository.lockProjectCodeGeneration();
        assertThat(projectRepository.existsByProjectCode(expected.iterator().next())).isTrue();
        assertThat(projectRepository.existsByProjectCode("NO-SUCH-CODE")).isFalse();
    }
}
