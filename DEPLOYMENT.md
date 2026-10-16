# Order integrity release

Customer HTML/CSS, admin.html and ordering steps are unchanged. index.html adds only a request ID and duplicate-click protection.

## Included
- Server-side menu, quantity, contact-field and time validation; server-calculated totals.
- Transactional request receipts and Asia/Taipei daily numbering, seeded from existing daily IDs.
- Restricted SECURITY INVOKER RPC available only to service_role.
- RLS on all six application tables. Browser roles may only select id/status for system_settings id=1; orders, jokes and internal receipts/notifications are server-only.
- Notifications are claimed once, checked for HTTP/API success, and recorded as pending/sending/sent/failed. A notification failure never turns a committed order into a failed order.
- No hardcoded Pushover or admin credentials; all secrets come from Vercel environment variables.
- Supabase SDK pinned to 2.48.0 with package-lock.json.

## Required configuration
Production: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUSHOVER_API_TOKEN, PUSHOVER_USER_KEY, ADMIN_PASSWORD. The database credential must be a real server-side service-role key, not the browser anon key. Never expose server secrets to the browser.

## Verification
Six offline handler tests passed. Isolated PostgreSQL 17 restored the three production application tables, verified migration compatibility, and tested 48 concurrent submissions: 24 identical requests created one order, plus 24 independent requests created 24 additional orders. Verified RLS and server-only RPC access. Windows local UI simulation was approved by the user.

Before the database update, complete repository history/images and private snapshots of public.orders/system_settings/jokes plus schema/grants were saved in the execution workspace outside this repository. These are application backups, not a full Supabase platform backup.

## Rollout
Apply the additive database migration, verify roles and counts, then merge the reviewed commit and verify the resulting Vercel production deployment. Existing backend operations use service_role and remain compatible with RLS. Do not deploy the local test package to production.

## Remaining operational items
- Pushover credentials previously exposed in git history must be rotated through Pushover and replaced directly in Vercel. Rotation is not confirmed; retaining configured values preserves existing routing but does not revoke exposed credentials.
- Monitor order_notifications for pending, failed or stale sending rows. Automatic retry is not enabled because a timeout may mean Pushover received a message without acknowledgement. Manual review is required before retrying.
- Old cached clients lack request IDs; the one-minute fingerprint fallback offers best-effort deduplication only. It can merge identical intentional submissions within a minute and cannot deduplicate across minute boundaries. New clients reuse a request ID for retries on the same page; refreshing the page loses that in-memory ID.
- Frontend history and customer information remain browser-local. LINE login and real push delivery require separate live validation; automated checks do not create real orders or send push messages.

## Rollback
Use the preceding Vercel production deployment. Keep the additive schema/receipts and RLS; the original service-role backend remains compatible. Do not reset counters or remove receipts while any new handler is active. Keep server-side menu prices synchronized with the frontend when modifying the menu.
