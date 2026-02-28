import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { createRefundException } from '../../services/refunds';

interface RefundExceptionModalProps {
    orderId: string;
    orderNumber: string;
    orderTotal: number;
    adminWalletAddress: string;
    onClose: () => void;
    onSuccess: () => void;
}

const RefundExceptionModal: React.FC<RefundExceptionModalProps> = ({
    orderId,
    orderNumber,
    orderTotal,
    adminWalletAddress,
    onClose,
    onSuccess
}) => {
    const [reason, setReason] = useState('');
    const [refundAmount, setRefundAmount] = useState(orderTotal);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!reason.trim()) {
            setError('Please provide a reason for this exception.');
            return;
        }

        if (refundAmount <= 0 || refundAmount > orderTotal) {
            setError(`Refund amount must be between $0.01 and $${orderTotal.toFixed(2)}`);
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await createRefundException(
                orderId,
                adminWalletAddress,
                adminWalletAddress,
                reason,
                refundAmount
            );
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create exception');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Issue Refund Exception</h2>
                        <p className="text-sm text-gray-500 mt-1">Order #{orderNumber}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Warning */}
                <div className="p-6 bg-yellow-50 border-b border-yellow-100">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-yellow-900">
                                Override No-Refunds Policy
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                                This customer consented to the no-refunds policy. Creating this exception will allow a refund to be processed.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="refund-amount" className="block text-sm font-medium text-gray-700 mb-2">
                            Refund Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <input
                                id="refund-amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={orderTotal}
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(parseFloat(e.target.value))}
                                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Order total: ${orderTotal.toFixed(2)}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reason for Exception <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain why this exception is being granted (e.g., defective product, shipping error, customer service gesture)..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 resize-none"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This will be logged with your admin ID
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Exception'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RefundExceptionModal;
