import React, { useState } from 'react';
import TutorialLayout from '../../components/tutorial/TutorialLayout';
import StepCard from '../../components/tutorial/StepCard';
import DownloadButton from '../../components/tutorial/DownloadButton';
import SecurityModal from '../../components/tutorial/SecurityModal';
import { Shield, Download, Key, CheckCircle } from 'lucide-react';

const MetaMask: React.FC = () => {
    const [showSecurityModal, setShowSecurityModal] = useState(false);

    return (
        <TutorialLayout
            title="Install MetaMask"
            stepIndex={1}
            nextRoute="/tutorial/polygon"
            prevRoute="/tutorial/welcome"
        >
            <div className="space-y-6">
                {/* Introduction */}
                <div className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border border-orange-500/30 rounded-lg p-6">
                    <div className="flex items-start gap-4">
                        <Shield className="w-8 h-8 text-orange-400 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">What is MetaMask?</h3>
                            <p className="text-gray-300 text-sm">
                                MetaMask is a crypto wallet that lets you store, send, and receive cryptocurrency.
                                It's your gateway to using SGCoin and GMONEY on our platform.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Step 1: Download */}
                <StepCard stepNumber={1} title="Download MetaMask">
                    <p className="mb-4">Visit metamask.io and download the extension or mobile app for your device:</p>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <DownloadButton
                            platform="chrome"
                            url="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn"
                        />
                        <DownloadButton
                            platform="ios"
                            url="https://apps.apple.com/us/app/metamask/id1438144202"
                        />
                        <DownloadButton
                            platform="android"
                            url="https://play.google.com/store/apps/details?id=io.metamask"
                        />
                    </div>
                </StepCard>

                {/* Step 2: Create Wallet */}
                <StepCard stepNumber={2} title="Create a New Wallet">
                    <div className="space-y-3">
                        <p>After installing, open MetaMask and click <strong>"Create a Wallet"</strong></p>
                        <p>Set a strong password that you'll remember. This password protects your wallet on this device.</p>
                    </div>
                </StepCard>

                {/* Step 3: Recovery Phrase */}
                <StepCard stepNumber={3} title="Save Your Recovery Phrase">
                    <div className="space-y-4">
                        <p>MetaMask will show you a 12-word recovery phrase. This is <strong>extremely important</strong>!</p>

                        <button
                            onClick={() => setShowSecurityModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition font-bold"
                        >
                            <Key className="w-5 h-5" />
                            Read Security Warning
                        </button>

                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                            <p className="text-red-300 text-sm font-bold mb-2">⚠️ Critical:</p>
                            <ul className="text-red-200 text-sm space-y-1">
                                <li>• Write down all 12 words in order</li>
                                <li>• Store them somewhere safe (NOT on your computer)</li>
                                <li>• Never share them with anyone</li>
                                <li>• This is the ONLY way to recover your wallet</li>
                            </ul>
                        </div>
                    </div>
                </StepCard>

                {/* Step 4: Confirm */}
                <StepCard stepNumber={4} title="Confirm Your Recovery Phrase">
                    <p>MetaMask will ask you to confirm your recovery phrase by selecting words in the correct order.</p>
                    <p className="mt-2">This ensures you've saved it correctly.</p>
                </StepCard>

                {/* Step 5: Complete */}
                <StepCard stepNumber={5} title="Wallet Created!">
                    <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                        <div>
                            <p className="font-bold text-green-400 mb-2">Congratulations!</p>
                            <p>Your MetaMask wallet is now set up and ready to use. You should see your wallet address and a balance of 0.</p>
                        </div>
                    </div>
                </StepCard>

                {/* Next Steps */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-2">Next: Switch to Polygon Network</h3>
                    <p className="text-gray-300 text-sm">
                        SGCoin operates on the Polygon network, which offers fast and cheap transactions.
                        We'll show you how to add it to MetaMask in the next step.
                    </p>
                </div>
            </div>

            <SecurityModal isOpen={showSecurityModal} onClose={() => setShowSecurityModal(false)} />
        </TutorialLayout>
    );
};

export default MetaMask;
