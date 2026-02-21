## Description

Closes #144

This PR introduces an automated database backup script tailored for the PostgreSQL `chioma_db` Docker container. It facilitates compressed data dumps (`pg_dump`) and enforces a rolling 7-day retention policy to prevent infinite disk space scaling.

### Changes Made

* **New Script (`scripts/backup_db.sh`)**:
  * Added logic to verify the running state of the `chioma_db` Docker container before execution.
  * Added `pg_dump` piped via `gzip` generating timestamped `.sql.gz` backups.
  * Added automated local retention maintenance using `find -mtime +7` to prune stale database backups.
  * Added descriptive comments header detailing the exact `crontab -e` job configuration needed to execute this script daily at 2:00 AM server time.

### Type of Change

- [ ] Bug fix
- [x] New feature
- [ ] Refactoring
- [x] Documentation update (cron documentation in script)

### How to Test

1. Ensure the `chioma_db` docker container is active.
2. Ensure you have execute permissions (`chmod +x scripts/backup_db.sh`).
3. Execute `./scripts/backup_db.sh`.
4. Navigate to `/backups` inside the project root and confirm a valid `.sql.gz` archive has been generated containing the payload.
