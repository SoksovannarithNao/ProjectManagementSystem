package backend.config;

import backend.service.PendingRegistrationCleanup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;
import java.time.OffsetDateTime;

// Runs PendingRegistrationCleanup at the start of every hour (app.registration.cleanup-cron): an
// unverified registration older than app.registration.pending-ttl-hours is deleted. A failure is logged
// and the next run tries again; it never stops the schedule or the application.
@Configuration
@EnableScheduling
public class PendingRegistrationScheduler {

    private static final Logger log = LoggerFactory.getLogger(PendingRegistrationScheduler.class);

    private final PendingRegistrationCleanup cleanup;
    private final Duration maxAge;

    public PendingRegistrationScheduler(
            PendingRegistrationCleanup cleanup,
            @Value("${app.registration.pending-ttl-hours}") long ttlHours) {
        this.cleanup = cleanup;
        this.maxAge = Duration.ofHours(ttlHours);
    }

    @Scheduled(cron = "${app.registration.cleanup-cron}")
    public void hourly() {
        try {
            int deleted = cleanup.deleteOlderThan(maxAge, OffsetDateTime.now());
            if (deleted > 0) {
                log.info("Deleted {} unverified registration(s) older than {}", deleted, maxAge);
            }
        } catch (RuntimeException e) {
            log.error("Cleanup of unverified registrations failed", e);
        }
    }
}
