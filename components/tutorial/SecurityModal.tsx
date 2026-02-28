import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface SecurityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border-2 border-yellow-500/50 rounded-xl max-w-md w-full p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded transition"
                    aria-label="Close security warning"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>

                <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            Important Security Warning
                        </h3>
                        <p className="text-gray-300 text-sm">
                            Your recovery phrase is the ONLY way to recover your wallet.
                        </p>
                    </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                    <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-500 font-bold">✓</span>
                            <span>Write down your recovery phrase on paper</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-yellow-500 font-bold">✓</span>
                            <span>Store it in a safe, secure location</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-red-500 font-bold">✗</span>
                            <span>Never share it with anyone</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-red-500 font-bold">✗</span>
                            <span>Never store it digitally (screenshots, cloud, etc.)</span>
                        </li>
                    </ul>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-black py-3 rounded-lg font-bold hover:from-yellow-600 hover:to-yellow-700 transition"
                >
                    I Understand
                </button>
            </div>
        </div>
    );
};

export default SecurityModal;
