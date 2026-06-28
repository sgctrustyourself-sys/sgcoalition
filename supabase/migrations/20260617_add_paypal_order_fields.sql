ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS payment_reference TEXT,
    ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_paypal_order_id
    ON public.orders (paypal_order_id)
    WHERE paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_order_id_unique
    ON public.orders (paypal_order_id)
    WHERE paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_capture_id_unique
    ON public.orders (payment_reference)
    WHERE payment_method = 'paypal'
      AND payment_reference IS NOT NULL;
