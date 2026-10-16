# Internal reliability fixes (not deployed)

Original GitHub revision: d2afb3bbcd6deb7bd1071aa58c2cfbbb9245403d.
The archive in /workspace/backups contains the exact original application source.
Images are unchanged on GitHub. This archive is a source backup, not a database backup or a complete repository clone.

## Required rollout order
1. Back up the production Supabase database and inspect orders/system_settings schema, constraints, triggers and RLS. Confirm items_json accepts JSON and delivery_time accepts HH:MM. The supplied SQL has NOT been tested against production PostgreSQL.
2. Rotate the exposed Pushover application token and user key via Pushover; update the existing Vercel production deployment environment first. Never put secret values in GitHub or chat. Configure PUSHOVER_API_TOKEN, PUSHOVER_USER_KEY, and a strong ADMIN_PASSWORD. Existing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY remain server-only. Do not deploy without these variables.
3. Apply supabase/migrations/202610160001_order_integrity.sql using the database migration workflow, after schema verification. New internal tables have RLS enabled and no customer permissions. Existing RLS is not modified without inspection.
4. Deploy a Vercel preview and test against a separate Supabase project, with a test Pushover destination. Verify simultaneous submissions and retry behavior with actual PostgreSQL transactions. Backend imports include lib/*.mjs and require a runtime supporting AbortSignal.timeout.
5. Promote only after these checks. Customer page HTML/CSS and ordering steps are unchanged. Verify in LINE LIFF and mobile browsers, including crypto.randomUUID support.

## Behavior and limitations
- Menu validation is server-side in lib/order-core.mjs. Keep this catalogue in sync with the frontend when prices change. Special custom items retain the existing zero-price behavior.
- New frontend requests share an ID across automatic retries and manual retries on the same page; a new deliberate order gets a new ID. Old cached clients get a best-effort one-minute fingerprint fallback. This fallback cannot guarantee deduplication across minute boundaries and may merge intentional identical submissions in that window; refresh old clients during rollout.
- Idempotency key mappings and daily sequence changes are committed atomically with the order. Sequence dates use Asia/Taipei. Existing same-day order IDs seed the sequence.
- Committed orders return success even if Pushover or optional joke loading fails. Notifications are claimed once and logged as pending/sending/sent/failed in order_notifications. Monitor pending, failed and stale sending rows. Automatic push redelivery is deliberately not enabled: a network timeout can mean Pushover received a message but its acknowledgement was lost. A reviewed manual retry process is still needed.
- Frontend history and customer information remain local to the browser. No visual or interaction redesign.
- Store-status read errors in the admin API return an error; new order acceptance checks status transactionally and refuses on missing/unavailable status.
- There is no production DB backup, credential rotation, database migration or Vercel deployment performed by the local code edits.

## Rollback
Redeploy the previous Vercel deployment with valid environment variables. The migration is additive; keep the extra columns/tables to retain new receipts and notification records. Never reset sequences or delete receipt rows while the new handler is active.

## Checks
Run: node --test test/orders.test.mjs
Tests use fake integrations and do not send notifications or write real orders. PostgreSQL concurrency, RLS and Vercel deployment checks require connected staging services.
