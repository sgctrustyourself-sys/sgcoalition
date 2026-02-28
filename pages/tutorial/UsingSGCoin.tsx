import React from 'react';
import { useNavigate } from 'react-router-dom';
import TutorialLayout from '../../components/tutorial/TutorialLayout';
import StepCard from '../../components/tutorial/StepCard';
import { ShoppingCart, Wallet, Sparkles, CheckCircle, Trophy } from 'lucide-react';

const UsingSGCoin: React.FC = () => {
    const navigate = useNavigate();

    return (
        <TutorialLayout
            title="Using SGCoin at Checkout"
            stepIndex={5}
            prevRoute="/tutorial/quickswap"
        >
            <div className="space-y-6">
                {/* Introduction */}
                <div className="bg-gradient-to-r from-green-900/20 to-green-800/20 border-2 border-green-500/50 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <Sparkles className="w-10 h-10 text-green-400 flex-shrink-0" />
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">🎉 You're All Set!</h3>
                            <p className="text-gray-300">
                                You now have SGCoin in your wallet and are ready to enjoy 10% savings on all your purchases!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Benefits Banner */}
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <h4 className="font-bold text-white">10% Discount</h4>
                        </div>
                        <p className="text-sm text-gray-300">
                            Automatic savings on every purchase when you pay with SGCoin or GMONEY
                        </p>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                            <h4 className="font-bold text-white">Instant Confirmation</h4>
                        </div>
                        <p className="text-sm text-gray-300">
                            Blockchain payments are verified instantly - no waiting for bank processing
                        </p>
                    </div>
                </div>

                {/* How to Use */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold text-white mb-6">How to Pay with SGCoin</h2>

                    <StepCard stepNumber={1} title="Add Items to Cart">
                        <p>Browse our shop and add items to your cart just like you normally would.</p>
                        <button
                            onClick={() => navigate('/shop')}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition"
                        >
                            <ShoppingCart className="w-4 h-4" />
                            Browse Shop
                        </button>
                    </StepCard>

                    <StepCard stepNumber={2} title="Proceed to Checkout">
                        <p>When you're ready, click the cart icon and proceed to checkout.</p>
                        <p className="mt-2">Fill in your shipping information as usual.</p>
                    </StepCard>

                    <StepCard stepNumber={3} title="Select Crypto Payment">
                        <div className="space-y-3">
                            <p>In the payment method section, select <strong>"Pay with SGCoin / GMONEY"</strong></p>
                            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                                <div className="flex items-start gap-2">
                                    <Sparkles className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-green-300 text-sm font-bold mb-1">10% Discount Applied!</p>
                                        <p className="text-green-200 text-sm">
                                            You'll see the discount automatically applied to your total when you select crypto payment.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </StepCard>

                    <StepCard stepNumber={4} title="Connect MetaMask">
                        <div className="space-y-3">
                            <p>Click the <strong>"Connect Wallet"</strong> button.</p>
                            <p>MetaMask will pop up asking you to connect. Click <strong>"Connect"</strong>.</p>
                            <p>Make sure you're on the <strong>Polygon network</strong> in MetaMask!</p>
                        </div>
                    </StepCard>

                    <StepCard stepNumber={5} title="Review and Confirm">
                        <div className="space-y-3">
                            <p>Review your order:</p>
                            <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                <li>Original price</li>
                                <li>10% discount amount</li>
                                <li>Final discounted total</li>
                                <li>Shipping details</li>
                            </ul>
                            <p className="mt-3">When ready, click <strong>"Complete Order"</strong>.</p>
                        </div>
                    </StepCard>

                    <StepCard stepNumber={6} title="Approve Transaction">
                        <div className="space-y-3">
                            <p>MetaMask will pop up with the transaction details.</p>
                            <p>You'll see:</p>
                            <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                <li>Amount of SGCoin to send</li>
                                <li>Gas fee (usually $0.01-0.05)</li>
                                <li>Total cost</li>
                            </ul>
                            <p className="mt-3">Click <strong>"Confirm"</strong> to complete your purchase.</p>
                        </div>
                    </StepCard>

                    <StepCard stepNumber={7} title="Order Confirmed!">
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                                <div>
                                    <p className="text-green-300 font-bold mb-2">Payment Successful!</p>
                                    <p className="text-green-200 text-sm">
                                        Your order is confirmed and will be processed immediately. You'll receive a confirmation email with your order details.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </StepCard>
                </div>

                {/* Tips */}
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-3">💡 Pro Tips</h3>
                    <ul className="space-y-2 text-gray-300 text-sm">
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            <span>Always keep some MATIC in your wallet for gas fees</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            <span>Make sure you're on Polygon network before checking out</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            <span>The 10% discount is automatically applied - no codes needed!</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            <span>Transactions are instant - your order processes immediately</span>
                        </li>
                    </ul>
                </div>

                {/* Completion */}
                <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border-2 border-purple-500/50 rounded-xl p-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-600 mb-4">
                        <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">Tutorial Complete!</h2>
                    <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                        You've successfully learned how to set up MetaMask, get SGCoin, and use it for discounted purchases.
                        Start shopping and enjoy your 10% savings!
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => navigate('/shop')}
                            className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                        >
                            Start Shopping
                        </button>
                        <button
                            onClick={() => navigate('/tutorial/welcome')}
                            className="px-8 py-3 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition font-bold"
                        >
                            Restart Tutorial
                        </button>
                    </div>
                </div>

                {/* Need Help */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center">
                    <h3 className="text-lg font-bold text-white mb-2">Need Help?</h3>
                    <p className="text-gray-400 text-sm mb-4">
                        If you have any questions or run into issues, we're here to help!
                    </p>
                    <a
                        href="mailto:support@sgcoalition.xyz"
                        className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold"
                    >
                        Contact Support
                    </a>
                </div>
            </div>
        </TutorialLayout>
    );
};

export default UsingSGCoin;
