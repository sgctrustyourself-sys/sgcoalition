import React from 'react';
import Skeleton from './ui/Skeleton';

const OrderSkeleton = () => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="space-y-2 text-right">
                        <Skeleton className="h-3 w-16 ml-auto" />
                        <Skeleton className="h-6 w-24 ml-auto" />
                    </div>
                </div>
            </div>
            <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-16 h-16 rounded" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                </div>
            </div>
        </div>
    );
};

export default OrderSkeleton;
