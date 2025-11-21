import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, ShoppingBag } from 'lucide-react';

const OrderCancel = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-gradient-to-b from-gray-50 to-white">
            <div className="max-w-2xl mx-auto text-center">
                {/* Cancel Icon */}
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-200 rounded-full mb-4">
                        <XCircle className="w-12 h-12 text-gray-600" />
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl font-bold uppercase mb-2">
                        Order Cancelled
                    </h1>
                    <p className="text-xl text-gray-600">
                        Your payment was not processed
                    </p>
                </div>

                {/* Message */}
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <p className="text-gray-700 mb-6">
                        No worries! Your order has been cancelled and no charges were made to your account.
                        Your items are still in your cart if you'd like to try again.
                    </p>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-bold text-blue-900 mb-2">Need Help?</h3>
                        <p className="text-sm text-blue-800">
                            If you experienced any issues during checkout, please contact our support team.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={() => navigate('/checkout')}
                        className="inline-flex items-center justify-center gap-2 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Try Again
                    </button>
                    <Link
                        to="/shop"
                        className="inline-flex items-center justify-center gap-2 border-2 border-black text-black px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white transition"
                    >
                        <ShoppingBag className="w-5 h-5" />
                        Continue Shopping
                    </Link>
                </div>

                {/* Support */}
                <p className="text-sm text-gray-500 mt-8">
                    Questions? Contact us at{' '}
                    <a href="mailto:support@coalition.com" className="text-brand-accent hover:underline">
                        support@coalition.com
                    </a>
                </p>
            </div>
        </div>
    );
};

export default OrderCancel;
