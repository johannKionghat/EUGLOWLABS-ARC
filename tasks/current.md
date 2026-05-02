# Tâche : CLI-016 — `arc logs <service>`
🟡 — `docker logs --tail N --follow <service>` via adapter, stream stdout.

## Plan
1. `tailLogs(adapter, service, opts)` (10 min)
2. `LogsCommand` clipanion + wiring (10 min)
3. Tests MockAdapter (10 min)
4. PR (10 min)
