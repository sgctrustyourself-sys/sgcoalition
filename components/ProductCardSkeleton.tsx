import React from 'react';
import Skeleton from './ui/Skeleton';

const ProductCardSkeleton = () => {
    return (
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
            <Skeleton className="h-64 w-full" />
            <div className="p-4 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </div>
        </div>
    );
};

export default ProductCardSkeleton;
