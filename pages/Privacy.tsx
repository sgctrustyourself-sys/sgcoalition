import React from 'react';
import { showConsentDialog } from '../services/cookieConsent';

const h2 = 'font-bold text-white text-xl uppercase mb-4';
const h3 = 'font-bold text-white text-lg uppercase mt-6 mb-3';

const CookieSettingsButton = ({ className = '' }: { className?: string }) => (
    <button
        type="button"
        onClick={showConsentDialog}
        className={`inline-flex items-center justify-center rounded-sm border border-white/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${className}`}
    >
        Cookie Settings
    </button>
);

const Privacy = () => {
    return (
        <div className="min-h-screen pt-32 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                <h1 className="font-display text-4xl font-bold uppercase mb-8">Privacy Policy</h1>

                <div className="prose prose-lg text-gray-300 space-y-6">
                    <p className="text-gray-400">Last updated: October 22, 2026</p>

                    <section>
                        <h2 className={h2}>1. Who We Are</h2>
                        <p>
                            Coalition ("we", "our", or "us") is an independent streetwear brand based in
                            Baltimore, Maryland. This policy explains what personal data we collect when
                            you visit sgcoalition-five.vercel.app (the "Site"), why we collect it, how long
                            we keep it, and the choices you have.
                        </p>
                        <p>
                            We are the controller of the personal data described here. Questions or
                            requests can be sent to{' '}
                            <a href="mailto:sgctrustyourself@gmail.com" className="text-brand-accent underline">
                                sgctrustyourself@gmail.com
                            </a>.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>2. Cookies, Local Storage and Your Consent</h2>
                        <p>
                            This Site uses cookies and browser storage (localStorage and sessionStorage) to
                            run the shop, keep checkout and sign-in working, remember choices you make, and —
                            only if you agree — measure how the Site is used. We do not set advertising or
                            cross-site tracking cookies.
                        </p>
                        <p>
                            On your first visit we ask before any optional storage is used. You can accept
                            all optional storage, reject everything optional, or choose per category.
                            Rejecting optional storage does not prevent you from browsing, adding items to
                            your cart, or completing an order.
                        </p>

                        <h3 className={h3}>2.1 Your choice, and how to change it</h3>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li>
                                <strong>Accept all:</strong> allows the optional categories listed below.
                            </li>
                            <li>
                                <strong>Reject non-essential:</strong> keeps every optional category off. This
                                is the default before you choose.
                            </li>
                            <li>
                                <strong>Manage preferences:</strong> turns each optional category on or off
                                individually.
                            </li>
                            <li>
                                <strong>Withdraw or change consent:</strong> use the{' '}
                                <CookieSettingsButton className="align-middle" />{' '}
                                button here or the "Cookie Settings" link in the footer. Withdrawing consent
                                stops optional storage from being used from that point on; it does not affect
                                storage that is strictly necessary for a purchase you have already started.
                            </li>
                        </ul>
                        <p>
                            Your choice is stored in your browser under{' '}
                            <code>coalition_cookie_consent_v1</code> for six months. After that, or if we
                            change the categories or vendors we use, we ask again. The record contains only
                            your category choices, a timestamp and a version number.
                        </p>

                        <h3 className={h3}>2.2 Strictly Necessary (Always Active)</h3>
                        <p>
                            These items are required to provide the service you request. They are exempt
                            from consent because the Site cannot function without them.
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>
                                <strong>Cart and checkout:</strong> <code>coalition_cart</code>,{' '}
                                <code>coalition_checkout_state</code>, <code>pendingOrder</code>,{' '}
                                <code>shippingInfo</code> and <code>orderNumber</code> keep your basket and
                                checkout form intact, including across the bank verification step some card
                                payments require.
                            </li>
                            <li>
                                <strong>Sign-in:</strong> Supabase stores a session token (normally{' '}
                                <code>sb-&lt;project&gt;-auth-token</code>) so you stay signed in. Admin
                                sessions use <code>coalition_admin_token</code> and{' '}
                                <code>coalition_admin_mode</code> in sessionStorage and expire when the tab
                                closes.
                            </li>
                            <li>
                                <strong>Security and reliability:</strong> <code>coalition_retry_queue</code>{' '}
                                lets a failed order or review write retry instead of being lost, and
                                short-lived admin search state is kept in sessionStorage.
                            </li>
                            <li>
                                <strong>Your cookie choice:</strong> <code>coalition_cookie_consent_v1</code>{' '}
                                records the decision described in section 2.1.
                            </li>
                            <li>
                                <strong>Features you ask for:</strong> saved favourites, reviews, tutorials,
                                giveaways, wishlists, dismissed notices and a remembered login email are
                                stored so the feature works the way you asked. The remembered email is only
                                saved when you tick "Remember me".
                            </li>
                            <li>
                                <strong>Payment and fraud prevention:</strong> when you open checkout, Stripe
                                may set <code>__stripe_mid</code> (up to 1 year) and <code>__stripe_sid</code>{' '}
                                (about 30 minutes) to process the payment and detect fraud. We never receive
                                or store your full card number.
                            </li>
                            <li>
                                <strong>Catalog cache:</strong> product and section data is cached in your
                                browser (<code>coalition_products</code>, <code>coalition_sections</code>) so
                                pages load quickly and remain usable if our database is briefly unavailable.
                            </li>
                        </ul>

                        <h3 className={h3}>2.3 Analytics (Optional — Off by Default)</h3>
                        <p>
                            If you opt in, we load Vercel Analytics and Vercel Speed Insights. They are
                            cookieless: they do not create a persistent identifier or track you across
                            other websites. They report aggregated page views, referrers, approximate
                            country, device type and Core Web Vitals so we can fix slow or broken pages.
                        </p>
                        <p>
                            If you reject this category, the analytics scripts are never injected. We do not
                            use Google Analytics, advertising pixels, session recording, heatmaps or
                            cross-site trackers.
                        </p>

                        <h3 className={h3}>2.4 Marketing (Optional — Off by Default)</h3>
                        <p>
                            No marketing or retargeting cookies are active on the Site today. This category
                            exists so that, if we ever add advertising, it remains off until you expressly
                            opt in. Enabling or disabling it now has no effect because no marketing scripts
                            are loaded.
                        </p>

                        <h3 className={h3}>2.5 Browser Controls</h3>
                        <p>
                            You can also block or delete cookies and site storage through your browser
                            settings. Blocking strictly necessary storage may prevent sign-in, cart
                            persistence or checkout from working. Browser-level controls are separate from
                            the choice you make on this Site, and deleting your browser data may remove
                            your saved consent record, in which case we will ask again.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>3. Third-Party Services</h2>
                        <p>
                            We keep the number of third parties small. These providers process data on our
                            behalf or as independent controllers for the purposes below:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>
                                <strong>Stripe</strong> — card and wallet payments, fraud prevention and
                                chargeback handling. Stripe sets its own payment cookies when checkout
                                loads. See Stripe's privacy policy at stripe.com/privacy.
                            </li>
                            <li>
                                <strong>Supabase</strong> — database, authentication and file storage. Account
                                and order data is hosted in Supabase's US regions.
                            </li>
                            <li>
                                <strong>Vercel</strong> — hosting, content delivery and, only with your
                                analytics consent, the cookieless analytics described in section 2.3.
                            </li>
                            <li>
                                <strong>Resend</strong> — delivery of order confirmations and shipping
                                notifications. Resend receives the recipient address and message content.
                            </li>
                            <li>
                                <strong>Sentry</strong> — when error monitoring is enabled, scrubbed crash
                                reports (error message, page URL, browser type) help us diagnose faults. We
                                do not enable session replay, and the reporting code strips emails, tokens
                                and payment details before sending.
                            </li>
                            <li>
                                <strong>Public data providers</strong> — DexScreener and public Polygon RPC
                                endpoints provide token prices and on-chain reads. These requests contain no
                                cookies and no account data, but your IP address is visible to the provider.
                            </li>
                            <li>
                                <strong>Postal-code lookup</strong> — checkout may send a postal code to
                                zippopotam.us to suggest a city and state. No name, email or payment data is
                                sent.
                            </li>
                        </ul>
                        <p>
                            Our brand fonts (Inter and Oswald) are served from our own domain, so visiting
                            the Site does not send a font request to Google.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>4. Data We Collect</h2>
                        <p>
                            We collect only what we need to sell and deliver products, operate accounts and
                            keep the Site secure:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>
                                <strong>Identity and contact data:</strong> name, email address, phone
                                number, shipping and billing address.
                            </li>
                            <li>
                                <strong>Order data:</strong> products, sizes, quantities, amounts, order
                                status, shipping method and tracking details.
                            </li>
                            <li>
                                <strong>Payment data:</strong> handled by Stripe. We receive a payment
                                confirmation, the last four digits and the card brand — never the full card
                                number or CVC.
                            </li>
                            <li>
                                <strong>Account data:</strong> login identifier, authentication provider and
                                saved preferences.
                            </li>
                            <li>
                                <strong>Support and inquiry data:</strong> messages you send us, including
                                custom-order details and any photos you choose to share.
                            </li>
                            <li>
                                <strong>Technical data:</strong> IP address, browser and device type, and
                                security logs generated when you use the Site.
                            </li>
                            <li>
                                <strong>Optional analytics data:</strong> aggregated page views, referrers,
                                approximate country and performance metrics — only if you opt in.
                            </li>
                        </ul>
                        <p>
                            We do not intentionally collect special-category data (such as health or
                            political opinions) and ask that you do not send it to us.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>5. How We Use Your Data and Our Legal Bases</h2>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>
                                <strong>To complete your order</strong> — taking payment, packing, shipping and
                                handling returns. Legal basis: performance of a contract (GDPR Art. 6(1)(b)).
                            </li>
                            <li>
                                <strong>To operate your account</strong> — sign-in, saved favourites, order
                                history and support. Legal basis: contract or your request before entering a
                                contract.
                            </li>
                            <li>
                                <strong>To prevent fraud and secure the Site</strong> — payment checks, abuse
                                prevention and error monitoring. Legal basis: our legitimate interests in
                                protecting customers and the business (Art. 6(1)(f)), balanced against your
                                rights.
                            </li>
                            <li>
                                <strong>To meet legal obligations</strong> — tax, accounting, consumer-protection
                                and lawful requests. Legal basis: legal obligation (Art. 6(1)(c)).
                            </li>
                            <li>
                                <strong>Optional analytics</strong> — understanding which pages need work.
                                Legal basis: your consent (Art. 6(1)(a)), which you can withdraw at any time.
                            </li>
                            <li>
                                <strong>Marketing emails</strong> — only if you subscribe. Legal basis:
                                consent, or where permitted, our legitimate interests in existing customers.
                                Every message includes an unsubscribe link.
                            </li>
                        </ul>
                        <p>
                            We do not use your data for automated decisions that produce legal or similarly
                            significant effects, and we do not sell personal data.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>6. Sharing Your Data</h2>
                        <p>
                            We share only what is necessary with the providers listed in section 3, with
                            professional advisers where required, and with authorities when the law
                            requires it. We do not sell, rent or trade personal data, and we do not share
                            it with advertising networks.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>7. Retention</h2>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>
                                <strong>Orders and transaction records:</strong> kept for at least seven years
                                to meet tax and accounting rules, then deleted or anonymised.
                            </li>
                            <li>
                                <strong>Account data:</strong> kept while your account is open, then deleted
                                after a reasonable inactivity period unless we must retain it.
                            </li>
                            <li>
                                <strong>Support and inquiry messages:</strong> kept for up to three years after
                                the conversation ends so we can resolve follow-ups.
                            </li>
                            <li>
                                <strong>Cookie consent record:</strong> six months, then we ask again.
                            </li>
                            <li>
                                <strong>Analytics:</strong> aggregated and retained according to Vercel's
                                retention settings; it is not used to identify you.
                            </li>
                            <li>
                                <strong>Security and error logs:</strong> kept only as long as needed to
                                investigate an incident.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className={h2}>8. Your Rights</h2>
                        <p>
                            Depending on where you live, you may have the right to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>Access</strong> the personal data we hold about you.</li>
                            <li><strong>Correct</strong> inaccurate or incomplete data.</li>
                            <li><strong>Delete</strong> your data, subject to legal retention duties.</li>
                            <li><strong>Restrict or object</strong> to certain processing, including processing based on legitimate interests.</li>
                            <li><strong>Receive a portable copy</strong> of data you provided to us.</li>
                            <li><strong>Withdraw consent</strong> to optional cookies or marketing at any time, without affecting processing that already happened.</li>
                            <li><strong>Complain</strong> to your local data-protection authority. In the EU or UK, this is the authority where you live or work; in the US, you may contact your state attorney general.</li>
                        </ul>
                        <p>
                            To exercise a right, email{' '}
                            <a href="mailto:sgctrustyourself@gmail.com" className="text-brand-accent underline">
                                sgctrustyourself@gmail.com
                            </a>
                            . We may need to verify your identity before acting. We respond within the
                            timeframe required by applicable law, normally 30 days.
                        </p>
                        <p>
                            <strong>California and similar US privacy laws:</strong> you may request to know,
                            correct or delete personal information, and to opt out of "sale" or "sharing" for
                            cross-context behavioural advertising. We do not sell personal information and we
                            do not use cross-site advertising cookies. We do not discriminate against you for
                            exercising these rights. Optional analytics are off until you opt in, so a Global
                            Privacy Control signal is honoured by default; you can also use the Cookie
                            Settings button above to confirm your choice.
                        </p>
                        <p>
                            <CookieSettingsButton />
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>9. International Transfers</h2>
                        <p>
                            We are based in the United States, and our providers (including Supabase, Vercel
                            and Stripe) may process data in the United States and other countries. Where
                            personal data from the European Economic Area, the UK or Switzerland is
                            transferred, we rely on appropriate safeguards such as the European Commission's
                            Standard Contractual Clauses or an applicable adequacy decision (including the
                            EU–US Data Privacy Framework where our provider is certified). You can ask us for
                            more information about the safeguards we use.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>10. Security</h2>
                        <p>
                            We use HTTPS, access controls, scoped API credentials and payment processing
                            through PCI-compliant Stripe. We limit access to personal data to people and
                            systems that need it. No method of transmission or storage is completely secure,
                            so we cannot promise absolute security, but we investigate suspected incidents
                            and notify affected users and authorities when the law requires it.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>11. Children</h2>
                        <p>
                            The Site is not directed to children under 16, and we do not knowingly collect
                            their personal data. If you believe a child has provided us with personal data,
                            contact us and we will delete it.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>12. Changes to This Policy</h2>
                        <p>
                            We may update this policy when our practices or the law change. The "Last
                            updated" date at the top will change, and if the update materially affects how we
                            use data or cookies we will ask for a fresh choice where required. The current
                            version always lives at this page.
                        </p>
                    </section>

                    <section>
                        <h2 className={h2}>13. Contact Us</h2>
                        <p>
                            Questions about this policy, cookies, or your data rights:
                        </p>
                        <p className="font-bold">
                            Email: <a href="mailto:sgctrustyourself@gmail.com" className="text-brand-accent underline">sgctrustyourself@gmail.com</a>
                        </p>
                        <p>
                            Coalition Brand<br />
                            Baltimore, Maryland<br />
                            United States
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
