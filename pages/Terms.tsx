import React from 'react';

const Terms = () => {
    return (
        <div className="min-h-screen pt-32 pb-16 px-4">
            <div className="max-w-3xl mx-auto">
                <h1 className="font-display text-4xl font-bold uppercase mb-8">Terms of Service</h1>

                <div className="prose prose-lg text-gray-600 space-y-6">
                    <p>Last updated: {new Date().toLocaleDateString()}</p>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">1. Agreement to Terms</h2>
                        <p>
                            By accessing our website, you agree to be bound by these Terms of Service and to comply with all applicable laws and regulations.
                            If you do not agree with these terms, you are prohibited from using or accessing this site.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">2. Intellectual Property</h2>
                        <p>
                            The materials contained in this website are protected by applicable copyright and trademark law.
                            Coalition and its logo are trademarks of Coalition Brand. All rights reserved.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">3. Purchases</h2>
                        <p>
                            If you wish to purchase any product or service made available through the Service ("Purchase"),
                            you may be asked to supply certain information relevant to your Purchase including, without limitation,
                            your credit card number, the expiration date of your credit card, your billing address, and your shipping information.
                        </p>
                        <p className="mt-2">
                            You represent and warrant that: (i) you have the legal right to use any credit card(s) or other payment method(s) in connection with any Purchase;
                            and that (ii) the information you supply to us is true, correct and complete.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">4. Returns and Refunds</h2>
                        <p>
                            We accept returns within 30 days of purchase. Items must be unused and in original packaging.
                            Please contact support@coalitionbrand.com to initiate a return.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">5. Limitation of Liability</h2>
                        <p>
                            In no event shall Coalition or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption)
                            arising out of the use or inability to use the materials on Coalition's website.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-bold text-black text-xl uppercase mb-4">6. Governing Law</h2>
                        <p>
                            These terms and conditions are governed by and construed in accordance with the laws of Maryland and you irrevocably submit to the exclusive jurisdiction of the courts in that State.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Terms;
