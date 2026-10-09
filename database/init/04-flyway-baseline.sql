-- Flyway baseline for a database built from these init scripts.
--
-- 01-init.sql already holds the END STATE of every migration up to V13, so a
-- fresh volume must not replay them: V9 would re-create the retired roles. This
-- records the baseline Flyway itself would write (`baselineVersion = 13`), so the
-- `migrate` service in docker-compose.yml applies only migrations newer than V13.
-- A volume created before this file existed keeps its own history (baseline 8)
-- and is upgraded by V9 to V13 as usual.
--
-- Keep the version in step with the newest migration folded into 01-init.sql.

CREATE TABLE IF NOT EXISTS flyway_schema_history (
    installed_rank INTEGER      NOT NULL,
    version        VARCHAR(50),
    description    VARCHAR(200) NOT NULL,
    type           VARCHAR(20)  NOT NULL,
    script         VARCHAR(1000) NOT NULL,
    checksum       INTEGER,
    installed_by   VARCHAR(100) NOT NULL,
    installed_on   TIMESTAMP    NOT NULL DEFAULT now(),
    execution_time INTEGER      NOT NULL,
    success        BOOLEAN      NOT NULL,
    CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank)
);

CREATE INDEX IF NOT EXISTS flyway_schema_history_s_idx ON flyway_schema_history (success);

INSERT INTO flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
SELECT 1, '13', '<< Flyway Baseline >>', 'BASELINE', '<< Flyway Baseline >>', NULL, current_user, 0, TRUE
WHERE NOT EXISTS (SELECT 1 FROM flyway_schema_history);
