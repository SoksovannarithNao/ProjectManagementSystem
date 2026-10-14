package backend.service;

import backend.entity.Milestone;
import backend.entity.Notification;
import backend.entity.Project;
import backend.entity.ProjectMember;
import backend.entity.Task;
import backend.entity.TaskAssignee;
import backend.entity.User;
import backend.repository.MilestoneRepository;
import backend.repository.NotificationRepository;
import backend.repository.ProjectMemberRepository;
import backend.repository.ProjectRepository;
import backend.repository.TaskAssigneeRepository;
import backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeadlineNotificationServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 10);

    @Mock private TaskRepository taskRepository;
    @Mock private TaskAssigneeRepository taskAssigneeRepository;
    @Mock private MilestoneRepository milestoneRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private NotificationRepository notificationRepository;

    private DeadlineNotificationService service;
    private Project project;
    private User owner;
    private User chen;

    @BeforeEach
    void setUp() {
        service = new DeadlineNotificationService(taskRepository, taskAssigneeRepository, milestoneRepository,
                projectRepository, projectMemberRepository, notificationRepository);
        project = new Project();
        ReflectionTestUtils.setField(project, "id", 10L);
        project.setName("Website Redesign");
        owner = user(1L, "Olivia Owner");
        chen = user(2L, "Chen Member");
    }

    private User user(Long id, String name) {
        User u = new User();
        ReflectionTestUtils.setField(u, "id", id);
        u.setFullName(name);
        u.setAccountStatus("ACTIVE");
        u.setTaskNotificationsEnabled(true);
        return u;
    }

    private Task task(Long id, LocalDate due) {
        Task t = new Task();
        ReflectionTestUtils.setField(t, "id", id);
        t.setTitle("Draft the homepage");
        t.setProject(project);
        t.setDueDate(due);
        return t;
    }

    private void assign(Task task, User... people) {
        List<TaskAssignee> rows = new ArrayList<>();
        for (User person : people) {
            TaskAssignee row = new TaskAssignee();
            row.setTask(task);
            row.setUser(person);
            rows.add(row);
        }
        when(taskAssigneeRepository.findByTaskIdIn(anyCollection())).thenReturn(rows);
    }

    private void projectHasOwner(User who) {
        ProjectMember member = new ProjectMember();
        member.setUser(who);
        when(projectMemberRepository.findFirstByProjectIdAndProjectRoleAndStatus(10L, "OWNER", "ACTIVE"))
                .thenReturn(Optional.of(member));
    }

    private List<Notification> saved(int expected) {
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, times(expected)).save(captor.capture());
        return captor.getAllValues();
    }

    // ------------------------------------------------------------ reminders

    @Test
    @SuppressWarnings("unchecked")
    void reminders_lookThreeAndOneDaysAheadAndSkipFinishedWork() {
        service.sendReminders(TODAY);

        ArgumentCaptor<List<LocalDate>> dates = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<List<String>> statuses = ArgumentCaptor.forClass(List.class);
        verify(taskRepository).findByDueDateInAndStatusNotIn(dates.capture(), statuses.capture());
        assertThat(dates.getValue()).containsExactlyInAnyOrder(TODAY.plusDays(3), TODAY.plusDays(1));
        assertThat(statuses.getValue()).containsExactlyInAnyOrder("COMPLETED", "CANCELLED");
        verify(milestoneRepository).findByDueDateInAndStatusNot(anyCollection(), eq("COMPLETED"));
        verify(projectRepository).findByEndDateInAndStatusNotIn(anyCollection(), anyCollection());
    }

    @Test
    void taskReminder_goesToTheAssigneeAndTheOwner_withTheDaysLeft() {
        Task task = task(5L, TODAY.plusDays(3));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);
        projectHasOwner(owner);

        int created = service.sendReminders(TODAY);

        assertThat(created).isEqualTo(2);
        List<Notification> notes = saved(2);
        assertThat(notes).extracting(n -> n.getUser().getFullName()).containsExactly("Chen Member", "Olivia Owner");
        assertThat(notes).allSatisfy(n -> {
            assertThat(n.getType()).isEqualTo("DEADLINE_REMINDER");
            assertThat(n.getTask()).isSameAs(task);
            assertThat(n.getProject()).isSameAs(project);
            assertThat(n.getMessage()).contains("Draft the homepage", "Website Redesign", "in 3 days", "2026-10-13");
        });
    }

    @Test
    void taskReminderOneDayBefore_saysTomorrow() {
        Task task = task(5L, TODAY.plusDays(1));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);

        service.sendReminders(TODAY);

        assertThat(saved(1).get(0).getMessage()).contains("tomorrow").doesNotContain("in 1 days");
    }

    @Test
    void anAssigneeWhoIsAlsoTheOwner_isToldOnce() {
        Task task = task(5L, TODAY.plusDays(3));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(task));
        assign(task, owner);
        projectHasOwner(owner);

        assertThat(service.sendReminders(TODAY)).isEqualTo(1);
        saved(1);
    }

    @Test
    void aReminderAlreadySent_isNotSentAgain() {
        Task task = task(5L, TODAY.plusDays(3));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);
        when(notificationRepository.existsByUserIdAndTypeAndTaskIdAndMessage(eq(2L), eq("DEADLINE_REMINDER"), eq(5L), anyString()))
                .thenReturn(true);

        assertThat(service.sendReminders(TODAY)).isZero();
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void peopleWithNotificationsOffOrAnInactiveAccount_areSkipped() {
        User quiet = user(3L, "Quiet Person");
        quiet.setTaskNotificationsEnabled(false);
        User gone = user(4L, "Gone Person");
        gone.setAccountStatus("INACTIVE");
        Task task = task(5L, TODAY.plusDays(3));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(task));
        assign(task, quiet, gone, chen);

        assertThat(service.sendReminders(TODAY)).isEqualTo(1);
        assertThat(saved(1).get(0).getUser()).isSameAs(chen);
    }

    @Test
    void milestoneReminder_goesToTheOwnerOnly_withoutATask() {
        Milestone milestone = new Milestone();
        milestone.setTitle("Beta launch");
        milestone.setProject(project);
        milestone.setDueDate(TODAY.plusDays(3));
        when(milestoneRepository.findByDueDateInAndStatusNot(anyCollection(), eq("COMPLETED"))).thenReturn(List.of(milestone));
        projectHasOwner(owner);

        assertThat(service.sendReminders(TODAY)).isEqualTo(1);
        Notification note = saved(1).get(0);
        assertThat(note.getUser()).isSameAs(owner);
        assertThat(note.getTask()).isNull();
        assertThat(note.getProject()).isSameAs(project);
        assertThat(note.getMessage()).contains("Milestone \"Beta launch\"", "in 3 days");
    }

    @Test
    void milestoneReminderAlreadySent_isNotSentAgain() {
        Milestone milestone = new Milestone();
        milestone.setTitle("Beta launch");
        milestone.setProject(project);
        milestone.setDueDate(TODAY.plusDays(1));
        when(milestoneRepository.findByDueDateInAndStatusNot(anyCollection(), eq("COMPLETED"))).thenReturn(List.of(milestone));
        projectHasOwner(owner);
        when(notificationRepository.existsByUserIdAndTypeAndProjectIdAndTaskIsNullAndMessage(
                eq(1L), eq("DEADLINE_REMINDER"), eq(10L), anyString())).thenReturn(true);

        assertThat(service.sendReminders(TODAY)).isZero();
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void projectReminder_goesToTheOwner() {
        project.setEndDate(TODAY.plusDays(3));
        when(projectRepository.findByEndDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(project));
        projectHasOwner(owner);

        assertThat(service.sendReminders(TODAY)).isEqualTo(1);
        Notification note = saved(1).get(0);
        assertThat(note.getUser()).isSameAs(owner);
        assertThat(note.getMessage()).contains("Project \"Website Redesign\" ends in 3 days", "2026-10-13");
    }

    @Test
    void aProjectWithoutAnActiveOwner_stillTellsTheAssignees() {
        Task task = task(5L, TODAY.plusDays(3));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);
        when(projectMemberRepository.findFirstByProjectIdAndProjectRoleAndStatus(anyLong(), anyString(), anyString()))
                .thenReturn(Optional.empty());

        assertThat(service.sendReminders(TODAY)).isEqualTo(1);
    }

    @Test
    void aVeryLongTitle_isShortenedBeforeTheDuplicateCheck() {
        Task task = task(5L, TODAY.plusDays(3));
        task.setTitle("x".repeat(600));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);

        service.sendReminders(TODAY);

        String stored = saved(1).get(0).getMessage();
        assertThat(stored).hasSize(500);
        verify(notificationRepository).existsByUserIdAndTypeAndTaskIdAndMessage(2L, "DEADLINE_REMINDER", 5L, stored);
    }

    // -------------------------------------------------------------- overdue

    @Test
    @SuppressWarnings("unchecked")
    void overdue_asksForOpenTasksDueBeforeToday() {
        service.sendOverdueNotices(TODAY);

        ArgumentCaptor<List<String>> statuses = ArgumentCaptor.forClass(List.class);
        verify(taskRepository).findByDueDateBeforeAndStatusNotIn(eq(TODAY), statuses.capture());
        assertThat(statuses.getValue()).containsExactlyInAnyOrder("COMPLETED", "CANCELLED");
    }

    @Test
    void overdueNotice_goesToTheAssigneeAndTheOwner_namingTheDueDate() {
        Task task = task(5L, TODAY.minusDays(2));
        when(taskRepository.findByDueDateBeforeAndStatusNotIn(eq(TODAY), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);
        projectHasOwner(owner);

        assertThat(service.sendOverdueNotices(TODAY)).isEqualTo(2);
        List<Notification> notes = saved(2);
        assertThat(notes).allSatisfy(n -> {
            assertThat(n.getType()).isEqualTo("OVERDUE_TASK");
            assertThat(n.getTitle()).isEqualTo("Task overdue");
            assertThat(n.getMessage()).contains("Draft the homepage", "Website Redesign", "was due on 2026-10-08");
        });
    }

    @Test
    void overdueText_doesNotChangeFromDayToDay_soANoticeIsNotRepeated() {
        Task task = task(5L, TODAY.minusDays(2));
        when(taskRepository.findByDueDateBeforeAndStatusNotIn(any(), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);

        service.sendOverdueNotices(TODAY);
        service.sendOverdueNotices(TODAY.plusDays(1));

        ArgumentCaptor<String> texts = ArgumentCaptor.forClass(String.class);
        verify(notificationRepository, times(2))
                .existsByUserIdAndTypeAndTaskIdAndMessage(eq(2L), eq("OVERDUE_TASK"), eq(5L), texts.capture());
        assertThat(texts.getAllValues().get(0)).isEqualTo(texts.getAllValues().get(1));
    }

    @Test
    void overdueNoticeAlreadySent_isNotSentAgain() {
        Task task = task(5L, TODAY.minusDays(2));
        when(taskRepository.findByDueDateBeforeAndStatusNotIn(eq(TODAY), anyCollection())).thenReturn(List.of(task));
        assign(task, chen);
        when(notificationRepository.existsByUserIdAndTypeAndTaskIdAndMessage(eq(2L), eq("OVERDUE_TASK"), eq(5L), anyString()))
                .thenReturn(true);

        assertThat(service.sendOverdueNotices(TODAY)).isZero();
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void notifyDeadlines_adds_remindersAndOverdueNotices() {
        Task soon = task(5L, TODAY.plusDays(3));
        Task late = task(6L, TODAY.minusDays(1));
        when(taskRepository.findByDueDateInAndStatusNotIn(anyCollection(), anyCollection())).thenReturn(List.of(soon));
        when(taskRepository.findByDueDateBeforeAndStatusNotIn(eq(TODAY), anyCollection())).thenReturn(List.of(late));
        TaskAssignee a = new TaskAssignee();
        a.setTask(soon);
        a.setUser(chen);
        TaskAssignee b = new TaskAssignee();
        b.setTask(late);
        b.setUser(chen);
        when(taskAssigneeRepository.findByTaskIdIn(anyCollection())).thenReturn(List.of(a)).thenReturn(List.of(b));

        assertThat(service.notifyDeadlines(TODAY)).isEqualTo(2);
    }
}
