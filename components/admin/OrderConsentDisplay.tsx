import React from 'react';
import { Shield, Calendar, Globe, Monitor } from 'lucide-react';

interface ConsentData {
    consentText?: string;
    consentTimestamp?: string;
    consentIp?: string;
    consentUserAgent?: string;
    consentUserId?: string;
}

interface OrderConsentDisplayProps {
    consent: ConsentData;
}

const OrderConsentDisplay: React.FC<OrderConsentDisplayProps> = ({ consent }) => {
    if (!consent.consentText || !consent.consentTimestamp) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">No consent data recorded for this order.</p>
                <p className="text-xs text-gray-400 mt-1">This order was placed before the no-refunds policy was implemented.</p>
            </div>
        );
    }

    const consentDate = new Date(consent.consentTimestamp);

    return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-600" />
                <h4 className="font-bold text-gray-900">No-Refunds Policy Consent</h4>
            </div>

            <div className="bg-white border border-yellow-200 rounded p-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Customer Agreement:</p>
                <p className="text-sm text-gray-600 italic">"{consent.consentText}"</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-gray-700">Consent Given</p>
                        <p className="text-gray-600">{consentDate.toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-gray-700">IP Address</p>
                        <p className="text-gray-600 font-mono">{consent.consentIp || 'N/A'}</p>
                    </div>
                </div>

                <div className="flex items-start gap-2 col-span-2">
                    <Monitor className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-medium text-gray-700">User Agent</p>
                        <p className="text-gray-600 break-all">{consent.consentUserAgent || 'N/A'}</p>
                    </div>
                </div>

                {consent.consentUserId && (
                    <div className="col-span-2 pt-2 border-t border-yellow-200">
                        <p className="font-medium text-gray-700">User ID</p>
                        <p className="text-gray-600 font-mono text-xs">{consent.consentUserId}</p>
                    </div>
                )}
            </div>

            <div className="pt-2 border-t border-yellow-200">
                <p className="text-xs text-gray-500">
                    ⚠️ This customer explicitly agreed to the no-refunds policy. Refund requests should be denied unless an admin exception is granted.
                </p>
            </div>
        </div>
    );
};

export default OrderConsentDisplay;
