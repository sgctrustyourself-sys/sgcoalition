import React, { useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    // ReactNode (not string) so callers can pass inline <strong>/<em> markup
    // without a `dangerouslySetInnerHTML` escape hatch. Used by the SGCoin
    // Payout Manager's approve confirmation to bold the customer's email.
    message: React.ReactNode;
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
    const panelRef = useRef<HTMLDivElement>(null);

    // Escape closes the dialog and focus returns to whatever opened it — the
    // admin button that raised the confirmation, which is the element the hook
    // captures as focused on open.
    //
    // The trap is unmounted while `isLoading`, because that is exactly when the
    // close controls are disabled: the confirmed action is in flight (a payout
    // being approved, a refund issued) and this dialog must not be dismissed out
    // from under it. Leaving the trap mounted while Escape did nothing would be
    // worse than not trapping — the hook restores focus on Escape whatever the
    // handler decides, so a single keypress would pull focus out of a dialog
    // that is still open.
    useFocusTrap({
        active: isOpen && !isLoading,
        containerRef: panelRef,
        onEscape: onClose,
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div
                ref={panelRef}
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
                            aria-label="Close modal"
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
