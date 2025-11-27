import React from 'react';
import TutorialLayout from '../../components/tutorial/TutorialLayout';
import StepCard from '../../components/tutorial/StepCard';
import { ExternalLink, Wallet, ArrowDownUp, CheckCircle, AlertCircle } from 'lucide-react';
import { QUICKSWAP_SWAP_URL, SGCOIN_CONTRACT_ADDRESS } from '../../constants';

const QuickSwap: React.FC = () => {
    return (
        <TutorialLayout
            title="Swap on QuickSwap"
            stepIndex={4}
            nextRoute="/tutorial/use-sgcoin"
            prevRoute="/tutorial/fund-wallet"
        >
            <div className="space-y-6">
                {/* Introduction */}
                <div className="bg-gradient-to-r from-indigo-900/20 to-indigo-800/20 border border-indigo-500/30 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                        <ArrowDownUp className="w-8 h-8 text-indigo-400 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">What is QuickSwap?</h3>
                            <p className="text-gray-300 text-sm">
                                QuickSwap is a decentralized exchange (DEX) on Polygon where you can swap tokens directly from your wallet.
                                It's fast, secure, and doesn't require an account.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick Start Button */}
                <div className="bg-gradient-to-r from-green-900/20 to-green-800/20 border-2 border-green-500/50 rounded-xl p-6">
                    <h3 className="text-xl font-bold text-white mb-3">🚀 Quick Start</h3>
                    <p className="text-gray-300 text-sm mb-4">
                        Click the button below to open QuickSwap with SGCoin pre-selected:
                    </p>
                    <a
                        href={QUICKSWAP_SWAP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    >
                        Open QuickSwap
                        <ExternalLink className="w-5 h-5" />
                    </a>
                </div>

                {/* Step 1: Connect Wallet */}
                <StepCard stepNumber={1} title="Connect Your Wallet">
                    <div className="space-y-3">
                        <p>On QuickSwap, click <strong>"Connect Wallet"</strong> in the top right corner.</p>
                        <p>Select <strong>"MetaMask"</strong> from the list of wallets.</p>
                        <p>MetaMask will pop up asking you to approve the connection. Click <strong>"Connect"</strong>.</p>
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mt-3">
                            <p className="text-blue-300 text-sm">
                                💡 QuickSwap can only view your wallet address and balances. It cannot move funds without your approval.
                            </p>
                        </div>
                    </div>
                </StepCard>

                {/* Step 2: Select Tokens */}
                <StepCard stepNumber={2} title="Select Trading Pair">
                    <div className="space-y-3">
                        <p>In the swap interface, you'll see two token fields:</p>
                        <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-3">
                            <div>
                                <p className="text-sm font-bold text-gray-400 mb-1">From (You're selling):</p>
                                <p className="text-white">Select USDC, ETH, MATIC, or whatever token you have</p>
                            </div>
                            <div className="flex justify-center">
                                <ArrowDownUp className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-400 mb-1">To (You're buying):</p>
                                <p className="text-white">Search for "SGCoin" or paste the contract address</p>
                            </div>
                        </div>
                    </div>
                </StepCard>

                {/* Step 3: Import Token */}
                <StepCard stepNumber={3} title="Import SGCoin Token">
                    <div className="space-y-3">
                        <p>If this is your first time swapping for SGCoin, you'll need to import it.</p>
                        <p>QuickSwap will show a warning that this is a custom token. This is normal!</p>
                        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                            <p className="text-xs text-gray-400 mb-2">SGCoin Contract Address:</p>
                            <code className="text-sm font-mono text-green-400 break-all">{SGCOIN_CONTRACT_ADDRESS}</code>
                        </div>
                        <p className="mt-3">Click <strong>"I understand"</strong> and <strong>"Import"</strong>.</p>
                    </div>
                </StepCard>

                {/* Step 4: Enter Amount */}
                <StepCard stepNumber={4} title="Enter Swap Amount">
                    <div className="space-y-3">
                        <p>Enter how much you want to swap in the "From" field.</p>
                        <p>QuickSwap will automatically calculate how much SGCoin you'll receive.</p>
                        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mt-3">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-yellow-300 text-sm font-bold mb-1">Keep Some MATIC!</p>
                                    <p className="text-yellow-200 text-sm">
                                        Don't swap all your MATIC. You'll need some for gas fees when using SGCoin later.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </StepCard>

                {/* Step 5: Review and Swap */}
                <StepCard stepNumber={5} title="Review and Confirm">
                    <div className="space-y-3">
                        <p>Review the swap details:</p>
                        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                            <li>Amount you're sending</li>
                            <li>Amount of SGCoin you'll receive</li>
                            <li>Price impact (should be low)</li>
                            <li>Estimated gas fee</li>
                        </ul>
                        <p className="mt-3">If everything looks good, click <strong>"Swap"</strong>.</p>
                    </div>
                </StepCard>

                {/* Step 6: Approve in MetaMask */}
                <StepCard stepNumber={6} title="Approve in MetaMask">
                    <div className="space-y-3">
                        <p>MetaMask will pop up asking you to approve the transaction.</p>
                        <p>You'll see two transactions:</p>
                        <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-2">
                            <div>
                                <p className="text-sm font-bold text-white">1. Token Approval (First time only)</p>
                                <p className="text-xs text-gray-400">Allows QuickSwap to access your tokens</p>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">2. Swap Transaction</p>
                                <p className="text-xs text-gray-400">The actual swap</p>
                            </div>
                        </div>
                        <p className="mt-3">Click <strong>"Confirm"</strong> for both transactions.</p>
                    </div>
                </StepCard>

                {/* Step 7: Wait for Confirmation */}
                <StepCard stepNumber={7} title="Wait for Blockchain Confirmation">
                    <div className="space-y-3">
                        <p>The swap usually takes 5-30 seconds to complete on Polygon.</p>
                        <p>You'll see a confirmation message when it's done.</p>
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mt-3">
                            <div className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-green-300 text-sm font-bold mb-1">Success!</p>
                                    <p className="text-green-200 text-sm">
                                        Your SGCoin should now appear in your MetaMask wallet. You may need to add the token to see it.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </StepCard>

                {/* Add SGCoin to MetaMask */}
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Add SGCoin to MetaMask
                    </h3>
                    <p className="text-gray-300 text-sm mb-3">
                        To see your SGCoin balance in MetaMask:
                    </p>
                    <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                        <li>Open MetaMask</li>
                        <li>Scroll down and click "Import tokens"</li>
                        <li>Paste the contract address: <code className="text-green-400 text-xs">{SGCOIN_CONTRACT_ADDRESS}</code></li>
                        <li>Click "Add Custom Token"</li>
                    </ol>
                </div>

                {/* Next Steps */}
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Next: Use SGCoin at Checkout</h3>
                    <p className="text-gray-300 text-sm">
                        Congratulations! You now have SGCoin. Learn how to use it at checkout and save 10% on your purchases!
                    </p>
                </div>
            </div>
        </TutorialLayout>
    );
};

export default QuickSwap;
