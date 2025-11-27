import React from 'react';
import TutorialLayout from '../../components/tutorial/TutorialLayout';
import StepCard from '../../components/tutorial/StepCard';
import CodeBlock from '../../components/tutorial/CodeBlock';
import { Network, Settings, CheckCircle } from 'lucide-react';
import { POLYGON_RPC_URL, POLYGON_CHAIN_ID, POLYGON_CURRENCY_SYMBOL, POLYGON_BLOCK_EXPLORER } from '../../constants';

const Polygon: React.FC = () => {
    const networkConfig = `Network Name: Polygon Mainnet
RPC URL: ${POLYGON_RPC_URL}
Chain ID: ${POLYGON_CHAIN_ID}
Currency Symbol: ${POLYGON_CURRENCY_SYMBOL}
Block Explorer: ${POLYGON_BLOCK_EXPLORER}`;

    return (
        <TutorialLayout
            title="Switch to Polygon Network"
            stepIndex={2}
            nextRoute="/tutorial/fund-wallet"
            prevRoute="/tutorial/metamask"
        >
            <div className="space-y-6">
                {/* Introduction */}
                <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/30 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                        <Network className="w-8 h-8 text-purple-400 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Why Polygon?</h3>
                            <p className="text-gray-300 text-sm">
                                Polygon is a layer-2 scaling solution for Ethereum. It offers fast transactions with very low fees,
                                making it perfect for trading and using SGCoin/GMONEY.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Step 1: Open MetaMask */}
                <StepCard stepNumber={1} title="Open MetaMask">
                    <p>Click the MetaMask extension icon in your browser, or open the mobile app.</p>
                </StepCard>

                {/* Step 2: Network Dropdown */}
                <StepCard stepNumber={2} title="Click Network Dropdown">
                    <div className="space-y-3">
                        <p>At the top of MetaMask, you'll see the current network (probably "Ethereum Mainnet").</p>
                        <p>Click on it to open the network dropdown menu.</p>
                    </div>
                </StepCard>

                {/* Step 3: Add Network */}
                <StepCard stepNumber={3} title="Add Polygon Network">
                    <div className="space-y-4">
                        <p>Click <strong>"Add Network"</strong> or <strong>"Add a network manually"</strong></p>
                        <p>Enter the following details:</p>
                        <CodeBlock code={networkConfig} />
                    </div>
                </StepCard>

                {/* Step 4: Save */}
                <StepCard stepNumber={4} title="Save and Switch">
                    <div className="space-y-3">
                        <p>Click <strong>"Save"</strong> to add the Polygon network.</p>
                        <p>MetaMask will automatically switch to Polygon Mainnet.</p>
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mt-4">
                            <div className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                <p className="text-green-300 text-sm">
                                    You should now see "Polygon Mainnet" at the top of your MetaMask wallet!
                                </p>
                            </div>
                        </div>
                    </div>
                </StepCard>

                {/* Alternative Method */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Quick Add (If Available)
                    </h3>
                    <p className="text-gray-300 text-sm mb-3">
                        Some websites can automatically add Polygon to your MetaMask. If you see a popup asking to add Polygon,
                        you can simply click "Approve" to add it instantly.
                    </p>
                    <a
                        href="https://chainlist.org/chain/137"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-bold text-sm"
                    >
                        Add via Chainlist
                        <Network className="w-4 h-4" />
                    </a>
                </div>

                {/* Next Steps */}
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Next: Fund Your Wallet</h3>
                    <p className="text-gray-300 text-sm">
                        Now that you're on Polygon, you'll need some MATIC (for gas fees) and USDC or ETH to swap for SGCoin.
                    </p>
                </div>
            </div>
        </TutorialLayout>
    );
};

export default Polygon;
