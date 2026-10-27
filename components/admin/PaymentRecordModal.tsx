// components/admin/PaymentRecordModal.tsx
// Modal for recording a partial or full-balance payment against a pending deposit order.

import React, { useState, useRef } from 'react';
import { X, Upload, DollarSign, Camera, FileText, Loader } from 'lucide-react';
import { validatePaymentProofFile, uploadPaymentProof } from '../../services/paymentProofUpload';
import { recordPartialPayment } from '../../services/reconcilePayment';
import { errorMessage } from '../../utils/errorMessage';
import { useToast } from '../../context/ToastContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface PaymentRecordModalProps {
    orderId: string;
    orderNumber: string;
    customerName: string;
    balanceDue: number;
    paidAmount: number;
    total: number;
    onClose: () => void;
    onRecorded: (result: { amount: number; proofUrl: string | null; fullyReconciled: boolean }) => void;
}

const PaymentRecordModal: React.FC<PaymentRecordModalProps> = ({
    orderId, orderNumber, customerName, balanceDue, paidAmount, total, onClose, onRecorded,
}) => {
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const [amount, setAmount] = useState<string>(balanceDue.toFixed(2));
    const [paymentMethod, setPaymentMethod] = useState<string>('cash');
    const [notes, setNotes] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const parsedAmount = parseFloat(amount);
    const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= balanceDue;

    // Escape + focus containment while the recorder is open. Gated on
    // `!isSubmitting` to match the disabled Cancel button: once the recording is
    // in flight every control including Cancel is inert, so Escape must not
    // close the dialog (and drag focus out of it) mid-write.
    useFocusTrap({
        active: !isSubmitting,
        containerRef: dialogRef,
        onEscape: onClose,
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validation = validatePaymentProofFile(file);
        if (!validation.valid) { setError(validation.error || 'Invalid file'); return; }
        setProofFile(file);
        setError(null);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => setProofPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else { setProofPreview(null); }
    };

    const handleSubmit = async () => {
        if (!isValidAmount) { setError('Enter a valid amount (up to $' + balanceDue.toFixed(2) + ').'); return; }
        setIsSubmitting(true);
        setError(null);
        try {
            let proofUrl: string | null = null;
            if (proofFile) {
                setIsUploading(true);
                try { proofUrl = await uploadPaymentProof(proofFile, orderId); }
                catch (uploadErr) { setError('Failed to upload proof: ' + errorMessage(uploadErr)); setIsUploading(false); setIsSubmitting(false); return; }
                setIsUploading(false);
            }
            const result = await recordPartialPayment(orderId, parsedAmount, proofUrl, notes, paymentMethod);
            if (result.success) {
                addToast(result.fully_reconciled ? 'Balance fully paid! Order is now complete.' : '$' + parsedAmount.toFixed(2) + ' recorded. $' + (result.new_balance_due || 0).toFixed(2) + ' remaining.', 'success');
                onRecorded({ amount: parsedAmount, proofUrl, fullyReconciled: result.fully_reconciled || false });
            } else { setError(result.error || 'Payment recording failed.'); }
        } catch (err) { setError(errorMessage(err) || 'Unexpected error.'); }
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="record-payment-title"
                className="bg-gray-900 border border-white/10 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
                {/* A real form, so Enter in any field submits it exactly like
                    pressing the Record button. Cancel stays type="button": a
                    <button> defaults to submit inside a form. */}
                <form
                    onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}
                    noValidate
                >
                    <div className="p-5 border-b border-white/10 flex justify-between items-center">
                        <div>
                            <h2 id="record-payment-title" className="text-lg font-bold text-white uppercase">Record Payment</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{orderNumber} — {customerName}</p>
                        </div>
                        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition" aria-label="Close record payment dialog"><X size={20} /></button>
                    </div>
                    <div className="p-5 space-y-5">
                        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                            <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Already paid</span><span className="text-white font-bold">${paidAmount.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Balance due</span><span className="text-amber-400 font-bold">${balanceDue.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm pt-2 border-t border-white/10"><span className="text-gray-400">Order total</span><span className="text-white font-bold">${total.toFixed(2)}</span></div>
                        </div>
                        <div>
                            <label htmlFor="record-payment-amount" className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Payment Amount ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input id="record-payment-amount" type="number" step="0.01" min="0.01" max={balanceDue} value={amount}
                                    onChange={(e) => { setAmount(e.target.value); setError(null); }}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white text-lg font-bold focus:border-amber-500/50 focus:outline-none transition" placeholder="0.00" />
                            </div>
                            {!isValidAmount && amount && <p className="text-red-400 text-xs mt-1">Amount must be between $0.01 and ${balanceDue.toFixed(2)}.</p>}
                            <div className="flex gap-2 mt-2">
                                {[5, 10, 20, balanceDue].filter(v => v <= balanceDue).slice(0, 4).map((quick) => (
                                    <button key={quick} type="button" onClick={() => setAmount(quick.toFixed(2))}
                                        className="px-3 py-1 text-xs bg-white/5 border border-white/10 rounded hover:bg-white/10 text-gray-300 transition">${quick.toFixed(2)}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="record-payment-method" className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Payment Method</label>
                            <select id="record-payment-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:border-white/30 outline-none text-sm">
                                <option value="cash">Cash</option><option value="cashapp">Cash App</option><option value="venmo">Venmo</option>
                                <option value="zelle">Zelle</option><option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Proof of Payment (optional)</label>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileSelect} className="hidden" />
                            {proofPreview ? (
                                <div className="relative rounded-lg overflow-hidden border border-white/10">
                                    <img src={proofPreview} alt="Proof preview" className="w-full max-h-48 object-cover" />
                                    <button type="button" onClick={() => { setProofFile(null); setProofPreview(null); }} className="absolute top-2 right-2 p-1 bg-black/60 rounded hover:bg-black/80 transition" aria-label="Remove payment proof"><X size={14} className="text-white" /></button>
                                </div>
                            ) : proofFile ? (
                                <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                                    <FileText className="w-5 h-5 text-gray-400" /><span className="text-sm text-gray-300 flex-1 truncate">{proofFile.name}</span>
                                    <button type="button" onClick={() => setProofFile(null)} className="text-gray-400 hover:text-white" aria-label="Remove payment proof"><X size={14} /></button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-lg hover:border-white/30 text-gray-400 hover:text-gray-200 transition text-sm">
                                    <Camera className="w-4 h-4" />Attach receipt or screenshot</button>
                            )}
                        </div>
                        <div>
                            <label htmlFor="record-payment-notes" className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
                            <textarea id="record-payment-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-white/30 outline-none text-sm resize-none" rows={2}
                                placeholder="e.g., Paid in person at the shop..." />
                        </div>
                        {error && <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 text-sm">{error}</div>}
                    </div>
                    <div className="p-5 border-t border-white/10 flex gap-3">
                        <button type="button" onClick={onClose} disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition text-sm font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                        <button type="submit" disabled={!isValidAmount || isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg hover:bg-amber-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                            {isUploading ? <><Loader className="w-4 h-4 animate-spin" />Uploading...</>
                            : isSubmitting ? <><Loader className="w-4 h-4 animate-spin" />Recording...</>
                            : <><Upload size={16} />Record ${parsedAmount.toFixed(2)} Payment</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaymentRecordModal;
