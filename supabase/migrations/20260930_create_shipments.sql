-- shipments — one row per label-purchase attempt, keyed deterministically to the order.
--
-- Purpose: when a Stripe payment_intent.succeeded webhook confirms money moved,
-- services/shipping.ts buys a USPS label via Shippo. The row here is the
-- idempotency guard: the deterministic id (`shipment_<order_id>`) plus a
-- pending → buying → purchased/failed claim state machine means Stripe webhook
-- redeliveries and concurrent deliveries can never buy postage twice.
--
-- State machine (owned by services/shipping.ts):
--   (absent)  --insert-->  pending
--   pending   --CAS update (status=pending)--> buying   <- exactly one worker wins
--   buying    --success--> purchased   (tracking + label URL recorded)
--   buying    --transient failure--> pending       (row reverts; next redelivery retries)
--   buying    --permanent failure--> failed        (error_reason recorded; never retried)
--
-- id is TEXT (not uuid) because it derives from orders.id, which is itself text
-- (`order_<digits>`). No foreign key: reconcile guarantees the order exists
-- before a label attempt, and a missing order must surface as a failed attempt
-- with a reason, not a silent FK violation.

CREATE TABLE IF NOT EXISTS public.shipments (
    id                    text PRIMARY KEY,
    order_id              text        NOT NULL,
    status                text        NOT NULL DEFAULT 'pending',
    carrier               text,
    service               text,
    tracking_number       text,
    tracking_url          text,
    label_url             text,
    rate_cents            integer,
    shippo_transaction_id text,
    error_reason          text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status   ON public.shipments (status);

-- Internal fulfillment table — written only by the service role (the serverless
-- API), never by browsers. RLS on with no policies = anon/authenticated get
-- nothing; service role bypasses RLS as usual.
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
