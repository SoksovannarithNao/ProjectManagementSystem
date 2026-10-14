package backend.config;

import backend.service.DeadlineNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.LocalDate;

// Runs DeadlineNotificationService every morning, and once when the application
// starts so a day missed while it was down is caught up. The service never
// creates the same notification twice, so the extra run is harmless.
// Switch it all off with app.deadlines.enabled=false (the context test does).
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.deadlines.enabled", havingValue = "true", matchIfMissing = true)
public class DeadlineScheduler {

    private static final Logger log = LoggerFactory.getLogger(DeadlineScheduler.class);

    private final DeadlineNotificationService deadlineNotificationService;
    private final boolean runOnStartup;

    public DeadlineScheduler(
            DeadlineNotificationService deadlineNotificationService,
            @Value("${app.deadlines.run-on-startup:true}") boolean runOnStartup) {
        this.deadlineNotificationService = deadlineNotificationService;
        this.runOnStartup = runOnStartup;
    }

    @Scheduled(cron = "${app.deadlines.cron:0 0 8 * * *}")
    public void daily() {
        run("scheduled");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (runOnStartup) {
            run("startup");
        }
    }

    // A failure must never stop the schedule or the application: log it and
    // try again at the next run.
    private void run(String trigger) {
        try {
            int created = deadlineNotificationService.notifyDeadlines(LocalDate.now());
            log.info("Deadline notifications ({}): {} created", trigger, created);
        } catch (RuntimeException e) {
            log.error("Deadline notifications ({}) failed", trigger, e);
        }
    }
}
