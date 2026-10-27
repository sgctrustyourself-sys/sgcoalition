-- Carrier-issue email claim for shipments (services/shippingMilestones.ts).
--
-- FAILURE / EXPIRED carrier statuses trigger a one-time proactive customer
-- service email + admin alert. This column is the claim slot (CAS while NULL),
-- so repeated carrier events for the same label never re-notify anyone.

ALTER TABLE public.shipments
    ADD COLUMN IF NOT EXISTS carrier_issue_email_sent_at timestamptz;
