import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    isLoading = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div
                className="bg-gray-900 border border-white/10 rounded-xl max-w-md w-full shadow-2xl transform transition-all"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            {isDestructive && (
                                <div className="p-2 bg-red-500/10 rounded-full">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                </div>
                            )}
                            <h3 id="modal-title" className="text-xl font-bold text-white">
                                {title}
                            </h3>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="text-gray-400 hover:text-white transition disabled:opacity-50"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-gray-300 mb-8 leading-relaxed">
                        {message}
                    </p>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 disabled:opacity-50 ${isDestructive
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-brand-accent hover:bg-brand-accent/90 text-black'
                                }`}
                        >
                            {isLoading && (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            )}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
