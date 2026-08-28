# Soho Harness release compatibility

| Component | macOS | Windows | Notes |
| --- | --- | --- | --- |
| Node.js | 22.x | 22.x | Required by the DSH fork. |
| pnpm | 11.x | 11.x | Installs the selected Web profile. |
| Docker Desktop | Apple Silicon / Intel | x64 with WSL 2 | Runs the MaxKB Compose service. |
| MaxKB | exact image digest in `../maxkb/docker-compose.yml` | same image digest | Keep the image and data volumes paired during migration. |
| Soho Web launcher | verified locally | command is platform-neutral; verify in Windows CI before production rollout | `node dsh/start-soho-web.mjs`. |

The setup and launcher intentionally use `DSH_HOME`, `MAXKB_BASE_URL`, `MAXKB_TOKEN`, and `MAXKB_ACCOUNT_FILE`; they contain no user-specific macOS path or account data.

Run `node dsh/release/check-environment.mjs` before installation. It reports the detected platform, architecture, Node.js, pnpm, Docker Engine, and Docker Compose without changing the machine.

## Data migration

Stop the source and target containers first, then use `node dsh/release/migrate-maxkb-volumes.mjs --source-data SOURCE_DATA --source-postgres SOURCE_POSTGRES --target-data TARGET_DATA --target-postgres TARGET_POSTGRES` to print the exact copy operations. Review them, then append `--apply` to run them. Do not copy a running volume. The application/workflow data, credentials, and user accounts are stored in those volumes and must be handled as sensitive data.
