import React from 'react';

const Privacy = () => {
    return (
        <div className="min-h-screen pt-32 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                <h1 className="font-display text-4xl font-bold uppercase mb-8">Privacy Policy</h1>

                <div className="prose prose-lg text-gray-600 space-y-6">
                    <p>Last updated: July 30, 2026</p>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">1. Introduction</h2>
                        <p>
                            Coalition ("we", "our", or "us") respects your privacy and is committed to protecting your personal data.
                            This privacy policy will inform you as to how we look after your personal data when you visit our website
                            and tell you about your privacy rights and how the law protects you.
                        </p>
                        <p>
                            This website uses cookies. By continuing to browse, you consent to our use of cookies as described below.
                            You can change your cookie preferences at any time by clicking "Cookie Settings" in the footer.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">2. Cookie Policy</h2>
                        <p>
                            Cookies are small text files placed on your device when you visit a website. They help us provide core
                            functionality, remember your preferences, and understand how visitors interact with our site.
                        </p>

                        <h3 className="font-bold text-black text-lg uppercase mt-6 mb-3">2.1 Necessary Cookies (Always Active)</h3>
                        <p>
                            These cookies are essential for the website to function and cannot be disabled. They enable basic features
                            like page navigation, secure checkout sessions, and fraud prevention. Without these, the shop and
                            checkout would not work.
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li><strong>Session cookies:</strong> Keep you signed in during your visit and remember your cart contents.</li>
                            <li><strong>CSRF tokens:</strong> Protect you and the site from cross-site request forgery attacks.</li>
                            <li><strong>Supabase auth tokens:</strong> Maintain your authenticated session when logged in.</li>
                        </ul>

                        <h3 className="font-bold text-black text-lg uppercase mt-6 mb-3">2.2 Preference Cookies</h3>
                        <p>
                            These cookies remember choices you make to improve your experience — such as your region, whether you've
                            dismissed a banner, or your preferred payment method. They also control whether the PayPal payment SDK
                            loads on the checkout page.
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li><strong>PayPal SDK:</strong> Loaded only after you accept preferences, enabling PayPal and card checkout.</li>
                            <li><strong>Cookie consent state:</strong> Remembers your cookie choices so you aren't asked again on repeat visits.</li>
                            <li><strong>Font preferences:</strong> Google Fonts (Oswald, Inter) for consistent brand typography.</li>
                        </ul>

                        <h3 className="font-bold text-black text-lg uppercase mt-6 mb-3">2.3 Statistics Cookies</h3>
                        <p>
                            These cookies help us understand how visitors interact with the site — which pages are visited, how long
                            people spend browsing, and where traffic comes from. We use this information to improve the shopping
                            experience. Currently, Coalition does not use third-party analytics services; all visitor statistics are
                            derived from anonymized order and page-view data stored in our own database.
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li><strong>DexScreener price API:</strong> Fetches live SGCoin token price data (no personal data transmitted).</li>
                            <li><strong>Polygon RPC:</strong> Reads on-chain contract data for the Ecosystem page (no cookies set by this connection).</li>
                        </ul>

                        <h3 className="font-bold text-black text-lg uppercase mt-6 mb-3">2.4 Marketing Cookies</h3>
                        <p>
                            Marketing cookies track visitors across websites to display relevant advertisements. Coalition does not
                            currently use any third-party advertising pixels, retargeting services, or social media tracking scripts.
                            If this changes, you will be asked for consent before any marketing cookies are activated.
                        </p>

                        <h3 className="font-bold text-black text-lg uppercase mt-6 mb-3">2.5 Third-Party Services</h3>
                        <p>
                            Some pages embed content or connect to external services for core functionality. These services may set
                            their own cookies:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li><strong>PayPal (paypal.com):</strong> Processes payments on the checkout page. PayPal's own privacy policy applies to data they collect during payment.</li>
                            <li><strong>Stripe (stripe.com):</strong> Processes card payments via Stripe Payment Intents. Stripe's privacy policy applies to payment data they handle.</li>
                            <li><strong>Supabase (supabase.co):</strong> Hosts our database and authentication. Session tokens are stored locally; no third-party cookies from Supabase are set on your browser.</li>
                            <li><strong>Google Fonts (fonts.googleapis.com):</strong> Delivers the Oswald and Inter typefaces. Google's privacy policy applies to font requests.</li>
                        </ul>

                        <h3 className="font-bold text-black text-lg uppercase mt-6 mb-3">2.6 Managing Your Cookie Preferences</h3>
                        <p>
                            You can change your cookie preferences at any time:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 mt-2">
                            <li><strong>On this site:</strong> Click "Cookie Settings" in the footer to reopen the consent banner and adjust your choices.</li>
                            <li><strong>In your browser:</strong> Most browsers let you block or delete cookies. Check your browser's help documentation for instructions.</li>
                            <li><strong>Withdraw consent:</strong> Changing your preferences to "Necessary only" will disable PayPal checkout and other preference-based features.</li>
                        </ul>
                        <p>
                            Cookie preferences are stored for 12 months. After that, you will be asked again on your next visit.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">3. Data We Collect</h2>
                        <p>
                            We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
                            <li><strong>Contact Data:</strong> includes billing address, delivery address, email address and telephone numbers.</li>
                            <li><strong>Financial Data:</strong> includes payment card details (processed securely by Stripe and PayPal — we never see your full card number).</li>
                            <li><strong>Transaction Data:</strong> includes details about payments to and from you and other details of products you have purchased from us.</li>
                            <li><strong>Technical Data:</strong> includes IP address, browser type, time zone, and device information collected through necessary session cookies.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">4. How We Use Your Data</h2>
                        <p>
                            We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., fulfilling your order).</li>
                            <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                            <li>Where we need to comply with a legal or regulatory obligation.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">5. Data Sharing</h2>
                        <p>
                            We do not sell, rent, or trade your personal data. We share only the minimum necessary with:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>Payment processors</strong> (PayPal, Stripe) — to complete your purchase.</li>
                            <li><strong>Supabase</strong> — our database and authentication provider (data stored in US regions).</li>
                            <li><strong>Shipping carriers</strong> — name and address only, to deliver your order.</li>
                            <li><strong>Resend</strong> — to send order confirmation and shipping notification emails.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">6. Data Retention</h2>
                        <p>
                            We retain order records and associated personal data for as long as necessary to fulfill the purposes
                            described in this policy, comply with legal obligations, resolve disputes, and enforce our agreements.
                            Transaction records are kept for a minimum of 7 years for tax and accounting purposes.
                            Cookie consent records are retained for the duration of the consent validity (12 months).
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">7. Your Rights</h2>
                        <p>
                            Depending on your location, you may have the right to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
                            <li><strong>Rectification:</strong> Ask us to correct any inaccurate or incomplete data.</li>
                            <li><strong>Erasure:</strong> Request deletion of your personal data (subject to legal retention requirements).</li>
                            <li><strong>Restrict processing:</strong> Ask us to limit how we use your data.</li>
                            <li><strong>Data portability:</strong> Receive your data in a structured, machine-readable format.</li>
                            <li><strong>Withdraw consent:</strong> Withdraw cookie consent at any time via the Cookie Settings link.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">8. Data Security</h2>
                        <p>
                            We have put in place appropriate security measures to prevent your personal data from being accidentally
                            lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your
                            personal data to those employees, agents, contractors and other third parties who have a business need to
                            know. All payment data is handled exclusively by PCI-compliant payment processors; we never store full
                            credit card numbers on our servers.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">9. Contact Us</h2>
                        <p>
                            If you have any questions about this privacy policy, our cookie practices, or your data rights, please
                            contact us at:
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
