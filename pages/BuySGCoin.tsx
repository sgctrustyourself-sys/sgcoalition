import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Wallet, Mail, DollarSign, CreditCard, FileText, CheckCircle, Loader } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { submitPurchaseRequest } from '../services/purchaseRequest';
import { uploadPaymentProof, validateProofFile } from '../services/proofUpload';
import { sendAdminNotification } from '../services/emailService';

const BuySGCoin = () => {
    const navigate = useNavigate();
    const { user } = useApp();

    const [formData, setFormData] = useState({
        email: user?.email || '',
        walletAddress: '',
        amount: '',
        paymentMethod: 'crypto',
        notes: ''
    });

    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const paymentMethods = [
        { value: 'crypto', label: 'Cryptocurrency (USDT, ETH, BTC)' },
        { value: 'paypal', label: 'PayPal' },
        { value: 'venmo', label: 'Venmo' },
        { value: 'cashapp', label: 'Cash App' },
        { value: 'zelle', label: 'Zelle' },
        { value: 'bank', label: 'Bank Transfer' },
        { value: 'other', label: 'Other' }
    ];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateProofFile(file);
        if (!validation.valid) {
            setError(validation.error || 'Invalid file');
            return;
        }

        setProofFile(file);
        setError(null);

        // Create preview for images
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProofPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setProofPreview(null);
        }
    };

    const validateForm = (): boolean => {
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }

        if (!formData.walletAddress || formData.walletAddress.length < 10) {
            setError('Please enter a valid wallet address');
            return false;
        }

        const amount = parseFloat(formData.amount);
        if (!amount || amount <= 0) {
            setError('Please enter a valid amount greater than 0');
            return false;
        }

        if (!formData.paymentMethod) {
            setError('Please select a payment method');
            return false;
        }

        if (!proofFile) {
            setError('Please upload proof of payment');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // First, submit the request to get the ID
            const request = await submitPurchaseRequest({
                email: formData.email,
                walletAddress: formData.walletAddress,
                amount: parseFloat(formData.amount),
                paymentMethod: formData.paymentMethod,
                notes: formData.notes,
                userId: user?.uid
            });

            // Upload proof with request ID
            let proofUrl: string | undefined;
            if (proofFile) {
                proofUrl = await uploadPaymentProof(proofFile, request.id);

                // Update request with proof URL
                // Note: This would require an update function, or we can include it in the initial submission
            }

            // Send admin notification
            await sendAdminNotification(
                parseFloat(formData.amount),
                formData.email,
                formData.walletAddress
            );

            setSuccess(true);
        } catch (err: any) {
            console.error('Error submitting request:', err);
            setError(err.message || 'Failed to submit request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen pt-24 pb-16 px-4 bg-black">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-500/30 rounded-2xl p-12 text-center">
                        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
                        <h1 className="font-display text-4xl font-bold uppercase mb-4 text-white">Request Submitted!</h1>
                        <p className="text-gray-300 text-lg mb-8">
                            Your SGCoin purchase request has been received and is being reviewed by our team.
                        </p>
                        <div className="bg-black/50 rounded-lg p-6 mb-8 text-left">
                            <h3 className="font-bold text-white mb-4">What happens next?</h3>
                            <ul className="space-y-3 text-gray-300">
                                <li className="flex items-start gap-3">
                                    <span className="text-green-500 mt-1">✓</span>
                                    <span>Our team will review your payment proof</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-green-500 mt-1">✓</span>
                                    <span>Once approved, SGCoin will be sent to your wallet</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-green-500 mt-1">✓</span>
                                    <span>You'll receive an email confirmation</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="text-green-500 mt-1">✓</span>
                                    <span>Check your profile to track the status</span>
                                </li>
                            </ul>
                        </div>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={() => navigate('/profile')}
                                className="bg-white text-black px-8 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition"
                            >
                                View My Requests
                            </button>
                            <button
                                onClick={() => navigate('/ecosystem')}
                                className="border-2 border-white/30 text-white px-8 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-white/10 transition"
                            >
                                Back to Ecosystem
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-black">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-sm text-gray-400 hover:text-white mb-8 transition"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>

                <div className="text-center mb-12">
                    <h1 className="font-display text-5xl font-bold uppercase mb-4 text-white">
                        Buy <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">SGCoin</span>
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Submit a purchase request and our team will process it manually
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm space-y-6">
                    {/* Email */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder="your@email.com"
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                            required
                        />
                    </div>

                    {/* Wallet Address */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <Wallet className="w-4 h-4" />
                            Wallet Address <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="walletAddress"
                            value={formData.walletAddress}
                            onChange={handleInputChange}
                            placeholder="0x..."
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition font-mono text-sm"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            SGCoin will be sent to this wallet address on Polygon network
                        </p>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Amount of SGCoin <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleInputChange}
                            placeholder="1000000"
                            step="0.01"
                            min="0"
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Enter the amount of SGCoin you want to purchase
                        </p>
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label htmlFor="paymentMethod" className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Payment Method <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="paymentMethod"
                            name="paymentMethod"
                            value={formData.paymentMethod}
                            onChange={handleInputChange}
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-white/30 focus:outline-none transition"
                            required
                        >
                            {paymentMethods.map(method => (
                                <option key={method.value} value={method.value} className="bg-gray-900">
                                    {method.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {formData.paymentMethod === 'cashapp' && (
                        <div className="p-4 bg-green-900/20 border border-green-500/50 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-green-400 text-sm font-bold mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Send Payment Here:
                            </p>
                            <div className="flex items-center justify-between bg-black/40 p-3 rounded border border-green-500/20">
                                <span className="font-mono text-xl text-white font-bold tracking-wider">$sgscrap</span>
                                <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText('$sgscrap')}
                                    className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded transition font-bold uppercase tracking-wide"
                                >
                                    Copy
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                Please upload the screenshot below after sending.
                            </p>
                        </div>
                    )}

                    {/* Proof of Payment */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            Proof of Payment <span className="text-red-500">*</span>
                        </label>
                        <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center hover:border-white/40 transition">
                            <input
                                type="file"
                                id="proof-upload"
                                onChange={handleFileChange}
                                accept="image/*,.pdf"
                                className="hidden"
                                required
                            />
                            <label htmlFor="proof-upload" className="cursor-pointer">
                                {proofPreview ? (
                                    <div className="space-y-3">
                                        <img src={proofPreview} alt="Payment proof" className="max-h-48 mx-auto rounded" />
                                        <p className="text-sm text-green-400">✓ {proofFile?.name}</p>
                                        <p className="text-xs text-gray-500">Click to change</p>
                                    </div>
                                ) : proofFile ? (
                                    <div className="space-y-3">
                                        <FileText className="w-12 h-12 mx-auto text-blue-400" />
                                        <p className="text-sm text-green-400">✓ {proofFile.name}</p>
                                        <p className="text-xs text-gray-500">Click to change</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Upload className="w-12 h-12 mx-auto text-gray-500" />
                                        <p className="text-white">Click to upload proof of payment</p>
                                        <p className="text-xs text-gray-500">PNG, JPG, WebP, or PDF (max 10MB)</p>
                                    </div>
                                )}
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Upload a screenshot or receipt showing your payment
                        </p>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Additional Notes (Optional)
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            placeholder="Any additional information..."
                            rows={4}
                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-white text-black py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Submit Purchase Request'
                        )}
                    </button>

                    <p className="text-xs text-center text-gray-500">
                        By submitting this request, you acknowledge that SGCoin will be sent manually by our team after verification.
                    </p>
                </form>

                {/* Contact & Community Section */}
                <div className="mt-12 text-center space-y-4">
                    <p className="text-gray-400 mb-4">Need help or want to join the community?</p>

                    {/* Discord Button */}
                    <a
                        href="https://discord.gg/coalition"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full bg-[#5865F2] text-white py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-[#4752C4] transition flex items-center justify-center gap-2"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" />
                        </svg>
                        Join our Discord
                    </a>

                    {/* Contact Button */}
                    <a
                        href="mailto:sgctrustyourself@gmail.com?subject=SGCoin Purchase Inquiry"
                        className="block w-full border border-white/30 text-white py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-white/10 transition flex items-center justify-center gap-2"
                    >
                        <Mail className="w-5 h-5" />
                        Contact via Email
                    </a>

                    <div className="pt-4 border-t border-white/10">
                        <p className="text-gray-400 text-sm mb-2">Or DM me directly on Discord:</p>
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-center gap-3">
                            <span className="font-mono text-blue-400 font-bold">sgscrap</span>
                            <button
                                onClick={() => navigator.clipboard.writeText('sgscrap')}
                                className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-gray-300 transition"
                            >
                                Copy
                            </button>
                        </div>
                    </div>


                </div>
            </div>
        </div>
    );
};

export default BuySGCoin;
