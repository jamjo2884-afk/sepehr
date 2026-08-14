/*
# Social platform external account id

Adds `external_id` to `social_accounts` so a connector can persist the
platform's OWN account identifier after account discovery (e.g. the numeric
Instagram Graph API user id or Telegram chat id). Never guessed by the app —
always written from the platform API response (getChat / me/accounts).

Idempotent: re-running is safe.
*/

ALTER TABLE social_accounts
  ADD COLUMN IF NOT EXISTS external_id text;
