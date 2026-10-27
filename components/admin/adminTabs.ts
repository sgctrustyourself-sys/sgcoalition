// Single source of truth for admin tab ids. The sidebar (AdminLayout), the
// page switch (pages/Admin) and ?tab= deep-link validation all read this list,
// so a tab cannot be added to one and forgotten in another.
export const ADMIN_TABS = [
    'command-center',
    'products',
    'orders',
    'blog',
    'reviews',
    'analytics',
    'referrals',
    'sgcoin-distribution',
    'sgcoin-requests',
    'sgcoin-payouts',
    'instagram',
    'git',
    'giveaways',
    'inquiries',
    'signals',
    'marketing',
    'users',
    'brain',
    'images',
    'customer-profile',
    'trust-circle',
    'coupons',
    'outreach',
] as const;

export type AdminTab = typeof ADMIN_TABS[number];

export const isAdminTab = (value: string | null): value is AdminTab =>
    value !== null && (ADMIN_TABS as readonly string[]).includes(value);
