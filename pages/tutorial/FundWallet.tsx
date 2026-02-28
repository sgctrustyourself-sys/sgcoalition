import React from 'react';
import TutorialLayout from '../../components/tutorial/TutorialLayout';
import StepCard from '../../components/tutorial/StepCard';
import { Wallet, CreditCard, ArrowDownUp, AlertCircle } from 'lucide-react';

const FundWallet: React.FC = () => {
    return (
        <TutorialLayout
            title="Fund Your Wallet"
            stepIndex={3}
            nextRoute="/tutorial/quickswap"
            prevRoute="/tutorial/polygon"
        >
            <div className="space-y-6">
                {/* Introduction */}
                <div className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/30 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                        <Wallet className="w-8 h-8 text-blue-400 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">What You Need</h3>
                            <p className="text-gray-300 text-sm mb-3">
                                To swap for SGCoin, you'll need two things:
                            </p>
                            <ul className="text-gray-300 text-sm space-y-1">
                                <li>• <strong>MATIC</strong> - For gas fees (transaction costs)</li>
                                <li>• <strong>USDC, ETH, or other tokens</strong> - To swap for SGCoin</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Important Notice */}
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-yellow-400 mb-2">Minimum MATIC Required</h4>
                            <p className="text-yellow-200 text-sm">
                                We recommend having at least <strong>$5 worth of MATIC</strong> in your wallet for gas fees.
                                Polygon fees are very low, but you need some MATIC to make transactions.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Method 1: Buy in MetaMask */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-green-400" />
                        Method 1: Buy Directly in MetaMask
                    </h3>

                    <StepCard stepNumber={1} title="Click 'Buy' in MetaMask">
                        <p>Open MetaMask and make sure you're on the Polygon network.</p>
                        <p className="mt-2">Click the <strong>"Buy"</strong> button.</p>
                    </StepCard>

                    <StepCard stepNumber={2} title="Choose Payment Method">
                        <p>Select your preferred payment option:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Credit/Debit Card</li>
                            <li>Apple Pay</li>
                            <li>Bank Transfer (ACH)</li>
                        </ul>
                    </StepCard>

                    <StepCard stepNumber={3} title="Select Token and Amount">
                        <div className="space-y-3">
                            <p>Choose what to buy:</p>
                            <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                                <p className="text-sm text-gray-300 mb-2"><strong>Recommended:</strong></p>
                                <ul className="text-sm text-gray-400 space-y-1">
                                    <li>• $5-10 of MATIC (for gas fees)</li>
                                    <li>• $50+ of USDC or ETH (to swap for SGCoin)</li>
                                </ul>
                            </div>
                        </div>
                    </StepCard>

                    <StepCard stepNumber={4} title="Complete Purchase">
                        <p>Follow the prompts to complete your purchase.</p>
                        <p className="mt-2">Funds typically arrive in 5-15 minutes.</p>
                    </StepCard>
                </div>

                {/* Method 2: Transfer from Exchange */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <ArrowDownUp className="w-6 h-6 text-purple-400" />
                        Method 2: Transfer from Exchange
                    </h3>

                    <StepCard stepNumber={1} title="Buy on Exchange">
                        <p>If you already have crypto on an exchange (Coinbase, Binance, etc.), you can transfer it to your MetaMask wallet.</p>
                        <p className="mt-2">Buy MATIC and USDC on your exchange.</p>
                    </StepCard>

                    <StepCard stepNumber={2} title="Copy Your Wallet Address">
                        <p>Open MetaMask and click your wallet address at the top to copy it.</p>
                        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mt-3">
                            <p className="text-yellow-300 text-sm">
                                ⚠️ Make sure you're on <strong>Polygon network</strong> before copying your address!
                            </p>
                        </div>
                    </StepCard>

                    <StepCard stepNumber={3} title="Withdraw from Exchange">
                        <div className="space-y-3">
                            <p>On your exchange, go to Withdraw/Send.</p>
                            <p>Select <strong>Polygon network</strong> (not Ethereum!).</p>
                            <p>Paste your MetaMask address and send.</p>
                            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mt-3">
                                <p className="text-red-300 text-sm font-bold">
                                    🚨 Critical: Always select Polygon network when withdrawing. Using the wrong network will result in lost funds!
                                </p>
                            </div>
                        </div>
                    </StepCard>

                    <StepCard stepNumber={4} title="Wait for Confirmation">
                        <p>Transfers usually take 5-30 minutes depending on the exchange.</p>
                        <p className="mt-2">You'll see the funds appear in your MetaMask wallet.</p>
                    </StepCard>
                </div>

                {/* Verification */}
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-3">✓ Ready to Continue?</h3>
                    <p className="text-gray-300 text-sm mb-2">Before moving to the next step, make sure you have:</p>
                    <ul className="text-gray-300 text-sm space-y-1">
                        <li>✓ At least $5 worth of MATIC in your wallet</li>
                        <li>✓ Some USDC, ETH, or other tokens to swap</li>
                        <li>✓ You're on the Polygon network in MetaMask</li>
                    </ul>
                </div>

                {/* Next Steps */}
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Next: Swap on QuickSwap</h3>
                    <p className="text-gray-300 text-sm">
                        Now that your wallet is funded, you're ready to swap your tokens for SGCoin on QuickSwap!
                    </p>
                </div>
            </div>
        </TutorialLayout>
    );
};

export default FundWallet;
