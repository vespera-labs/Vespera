# Search Index Consistency — PR Attachments (#245)

## 1. Migration SQL (`AddSearchOutbox1790300000000`)

See `backend/src/migrations/1790300000000-AddSearchOutbox.ts`.

Creates `search_outbox` with operation (`index|delete`) and status (`pending|processing|done|failed`).

## 2. ES query body — before / after

### Before (unscoped)

```json
{
  "query": {
    "bool": {
      "must": [{ "match_all": {} }],
      "filter": [{ "term": { "city": "Lagos" } }]
    }
  }
}
```

### After (mandatory tenant + visibility)

```json
{
  "query": {
    "bool": {
      "must": [{ "match_all": {} }],
      "filter": [
        { "term": { "tenant_id": "<server-derived-tenant>" } },
        { "terms": { "visibility": ["listed"] } },
        { "term": { "city": "Lagos" } }
      ]
    }
  }
}
```

`tenant_id` and `visibility` are injected by `ElasticsearchService.buildScopedSearchBody` from `TenantContext`. Client `tenantId` / `visibility` query params are discarded.

## 3. Outbox state across drift-and-reconcile

| Phase | status | operation | attempts | notes |
|-------|--------|-----------|----------|-------|
| After archive TX commit | pending | index | 0 | Row written in same TX as `status=archived` |
| Relay pick-up | processing | index | 0 | |
| ES timeout | pending | index | 1 | Retry; exponential backoff via Bull |
| Max attempts exceeded | failed | index | 5 | Dead-letter; metric `search_outbox_relay_dead_letter` |
| Reconcile detects stale ES (`visibility=listed` vs PG `archived`) | pending | index | 0 | New outbox row enqueued |
| Relay success | done | index | 0 | ES now `visibility=unlisted` |

## 4. Reconciliation metrics

Emitted via `MetricsService`:

- `search_reconcile_drifted`
- `search_reconcile_missing`
- `search_reconcile_orphaned`
- `search_outbox_relay_success`
- `search_outbox_relay_retry`
- `search_outbox_relay_dead_letter`

Audit action: `SEARCH_RECONCILE` with result payload in metadata.
