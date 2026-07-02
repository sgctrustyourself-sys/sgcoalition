// Shared types for /api/_handlers/* — modeled on the Vercel Node runtime but
// free of @vercel/node so this file works in any environment where Supabase
// and Resend types are available. Kept structurally assignable to the router
// Handler type at api/[...slug].ts so existing dispatch continues to work.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateEmailOptions } from 'resend';

// Re-export so consumers (api/_handlers/*) don't need to depend on supabase-js directly.
export type { SupabaseClient };

// ---------- HTTP envelopes ----------
export interface ApiRequest {
    method?: string;
    url?: string;
    headers?: Record<string, string | string[] | undefined>;
    query: { [key: string]: string | string[] | undefined };
    body?: unknown;
}

export interface ApiResponse {
    status: (code: number) => ApiResponse;
    json: (data: unknown) => void;
    send: (data: string | Buffer) => void;
    setHeader: (name: string, value: string | string[]) => void;
    end: () => void;
}

// ---------- Order domain ----------
export interface ShippingAddress {
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    shippingMethod?: string;
    shippingCost?: number;
    [key: string]: unknown;
}

export interface OrderItemInput {
    id?: string;
    productId?: string;
    product_id?: string;
    productName?: string;
    name?: string;
    productImage?: string;
    image?: string;
    selectedSize?: string;
    size?: string;
    quantity?: number;
    price?: number;
    basePrice?: number;
    base_price?: number;
    addOnPrice?: number;
    add_on_price?: number;
    keychainClipOn?: boolean;
    keychain_clip_on?: boolean;
    addOnLabel?: string;
    add_on_label?: string;
    total?: number;
    [key: string]: unknown;
}

export interface OrderItemRow {
    productId: string;
    productName: string;
    productImage: string;
    selectedSize: string;
    quantity: number;
    price: number;
    basePrice: number;
    addOnPrice: number;
    keychainClipOn: boolean;
    addOnLabel?: string;
    total: number;
    name: string;
    image: string;
    size: string;
    [key: string]: unknown;
}

// Full client-supplied order (all fields optional; accepts both camelCase and
// snake_case since the frontend mixes both). Cast from unknown request body
// at the handler boundary.
export interface OrderInput {
    id?: string;
    orderNumber?: string;
    order_number?: string;
    userId?: string | null;
    user_id?: string | null;
    isGuest?: boolean;
    is_guest?: boolean;
    customerName?: string;
    customer_name?: string;
    customerEmail?: string;
    customer_email?: string;
    customerPhone?: string;
    customer_phone?: string;
    items?: OrderItemInput[];
    subtotal?: number;
    tax?: number;
    discount?: number;
    total?: number;
    paymentMethod?: string;
    payment_method?: string;
    paymentStatus?: string;
    payment_status?: string;
    paymentReference?: string | null;
    payment_reference?: string | null;
    paypalOrderId?: string | null;
    paypal_order_id?: string | null;
    orderType?: string;
    order_type?: string;
    shippingAddress?: ShippingAddress | null;
    shipping_address?: ShippingAddress | null;
    // Some client-side order payloads ship shipping metadata at the top
    // level (rather than nested under shippingAddress). Model both shapes
    // so downstream emails/admin notifications can read whichever the
    // caller provided without losing data.
    shippingMethod?: string;
    shippingCost?: number;
    shippingInfo?: ShippingAddress | string | null;
    notes?: string;
    createdAt?: string;
    created_at?: string;
    paidAt?: string | null;
    paid_at?: string | null;
    sgCoinReward?: number;
    sg_coin_reward?: number;
    [key: string]: unknown;
}

// Snake-case shape written to Supabase orders table.
export interface OrderRow {
    id: string;
    order_number: string;
    user_id: string | null;
    is_guest: boolean;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    items: OrderItemRow[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    payment_method: string;
    payment_status: string;
    payment_reference: string | null;
    paypal_order_id: string | null;
    order_type: string;
    shipping_address: ShippingAddress | null;
    notes: string;
    created_at: string;
    paid_at: string | null;
    sg_coin_reward: number;
}

// OrderRow without the PayPal payment columns — used when migrating legacy
// schemas that haven't applied the PayPal order migration yet.
export type OrderRowLegacy = Omit<OrderRow, 'payment_reference' | 'paypal_order_id'>;

// ---------- Product ----------
export interface ProductRow {
    id: string;
    name: string;
    price: number;
    category: string;
    archived?: boolean;
    size_inventory?: Record<string, number>;
    [key: string]: unknown;
}

// ---------- PayPal ----------
export interface PayPalVerification {
    paypalOrderId?: string;
    paypalCaptureId?: string;
}

export interface PayPalAmount {
    currency_code?: string;
    value?: string;
}

export interface PayPalCapture {
    id: string;
    status: string;
    amount?: PayPalAmount;
    [key: string]: unknown;
}

export interface PayPalPurchaseUnit {
    reference_id?: string;
    custom_id?: string;
    description?: string;
    amount?: PayPalAmount;
    payments?: { captures?: PayPalCapture[] };
    [key: string]: unknown;
}

export interface PayPalPayer {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
}

// Confirmed capture returned by verifyPayPalCapture — IDs are guaranteed present
// because the function throws otherwise. Distinct from PayPalVerification, which
// is the *input* shape from the client request body (still optional fields).
export interface PayPalCaptureConfirmation {
    paypalOrderId: string;
    paypalCaptureId: string;
    payerEmail: string | null;
}

export interface PayPalOrderResponse {
    id?: string;
    status?: string;
    intent?: string;
    message?: string;
    error?: string;
    purchase_units?: PayPalPurchaseUnit[];
    payer?: PayPalPayer;
    [key: string]: unknown;
}

// ---------- Resend ----------
// Subset of CreateEmailOptions without from (which sendResendEmail injects).
export type ResendEmailPayload = Omit<CreateEmailOptions, 'from'>;

// ---------- Supabase errors ----------
export interface SupabasePgError {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
}

// ---------- Body shapes ----------
export interface CreateOrderBody {
    order?: OrderInput;
    verification?: PayPalVerification;
    [key: string]: unknown;
}

export interface UpdateOrderBody {
    id?: string;
    updates?: Partial<OrderRow>;
    [key: string]: unknown;
}

// ---------- Email template ----------
export interface EmailOrderItem {
    name: string;
    size: string;
    quantity: number;
    price: number;
}

export interface EmailOrder {
    id: string;
    customerName: string;
    customerEmail: string;
    items: EmailOrderItem[];
    total: number;
    paymentMethod: string;
    shippingMethod: string;
    shippingCost: number;
    sgCoinReward: number;
}

// ---------- upsertOrderRecord return ----------
export interface OrderSaveResult {
    record: OrderRow;
    created: boolean;
}

// ---------- PayPal normalized item (used by paypal-order.ts) ----------
export interface PayPalNormalizedCheckoutItem {
    productId: string;
    selectedSize: string;
    quantity: number;
    keychainClipOn: boolean;
}

// Body shape for create-paypal-order.
export interface PayPalCreateOrderInput {
    items?: unknown[];
    shipping?: number;
    discount?: number;
    couponCode?: string | null;
    expectedTotal?: number;
    referenceId?: string;
    description?: string;
    [key: string]: unknown;
}

// Body shape for capture-paypal-order.
export interface PayPalCaptureOrderInput {
    orderId?: string;
    [key: string]: unknown;
}

// ---------- Brain (used by ai-chat.ts) ----------
export interface BrainEntry {
    title?: string;
    content?: string;
    importance?: number;
    created_at?: string;
    [key: string]: unknown;
}

// ---------- Marketing (used by marketing-send.ts) ----------
export type MarketingChannel = 'email' | 'sms' | 'both';

export interface MarketingAudienceRow {
    id?: string;
    email: string | null;
    phone: string | null;
    source: string;
    unsubscribe_token: string | null;
}

// ---------- Profile (used by place-order-credits / verify-subscription) ----------
export interface ProfileRow {
    id: string;
    store_credit?: number;
    is_vip?: boolean;
    updated_at?: string;
    [key: string]: unknown;
}

// ---------- Subscribe email (used by subscribe-drop / unsubscribe) ----------
export interface SubscribeEmailRow {
    id: string;
    email: string;
    source?: string;
    unsubscribe_token: string;
    unsubscribe_at: string | null;
    created_at?: string;
    [key: string]: unknown;
}

// ---------- Stripe + checkout body shapes ----------
// Shape the client sends to create-checkout-session.
export interface CheckoutSessionItemInput {
    name?: string;
    price?: number;
    quantity?: number;
    selectedSize?: string;
    keychainClipOn?: boolean;
    images?: string[];
    [key: string]: unknown;
}

export interface CreateCheckoutSessionBody {
    items?: CheckoutSessionItemInput[];
    [key: string]: unknown;
}

export interface CheckoutSessionResponse {
    sessionId: string;
    url: string | null;
}

// ---------- create-payment-intent ----------
export interface CreatePaymentIntentBody {
    amount?: number;
    userId?: string | null;
    useStoreCredit?: boolean;
    [key: string]: unknown;
}

export interface PaymentIntentResponse {
    clientSecret: string | null;
    creditApplied?: number;
    finalAmount?: number;
    zeroAmount?: boolean;
}

// ---------- create-subscription-session ----------
export interface CreateSubscriptionSessionBody {
    userId?: string | null;
    [key: string]: unknown;
}

// ---------- verify-subscription ----------
export interface VerifySubscriptionBody {
    sessionId?: string;
    [key: string]: unknown;
}

export interface VerifySubscriptionResponse {
    success: boolean;
    userId?: string;
}

// ---------- place-order-credits ----------
export interface PlaceOrderCreditsBody {
    userId?: string | null;
    total?: number;
    items?: { productId?: string; quantity?: number }[];
    [key: string]: unknown;
}

export interface PlaceOrderCreditsResponse {
    success: boolean;
    newBalance: number;
}

// ---------- subscribe-drop ----------
export interface SubscribeDropBody {
    email?: string;
    source?: string;
    [key: string]: unknown;
}

export interface SubscribeDropResponse {
    success: boolean;
    alreadySubscribed: boolean;
    emailDelivered: boolean;
    source: string;
}

// ---------- unsubscribe ----------
// Unsubscribe reads ?token from query (works in any email client) or body
// (mirrors a future POST button inside /account); both channels route here.
export type UnsubscribeQuery = Record<string, string | string[] | undefined>;
export interface UnsubscribeBody {
    token?: string;
    [key: string]: unknown;
}

// ---------- git-operations ----------
export interface GitCommitInput {
    message?: string;
    author?: string;
    [key: string]: unknown;
}

export interface GitCheckoutInput {
    branch?: string;
    [key: string]: unknown;
}

export interface GitResetInput {
    commitHash?: string;
    hard?: boolean;
    [key: string]: unknown;
}

export interface GitOperationResponse {
    success?: boolean;
    [key: string]: unknown;
}
