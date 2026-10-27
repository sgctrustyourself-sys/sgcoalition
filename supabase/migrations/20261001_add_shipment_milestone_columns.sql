-- Milestone email claims for shipments (services/shippingMilestones.ts).
--
-- Shippo track webhooks deliver status updates for purchased labels; each
-- customer milestone email (first carrier scan, delivered) must be sent
-- exactly once. These columns are the claim slots: set via a CAS update that
-- only matches while the column is NULL, so webhook redeliveries and
-- concurrent carrier events can never double-send.
--
-- No backfill: existing purchased rows have never sent a milestone email
-- (the feature ships with this migration), so NULL is the correct initial
-- state for every row — including historical ones, whose carriers may still
-- deliver.

ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS shipped_email_sent_at   timestamptz,
    ADD COLUMN IF NOT EXISTS delivered_email_sent_at timestamptz;
