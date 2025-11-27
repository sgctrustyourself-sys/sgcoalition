import React, { ReactNode } from 'react';

interface StepCardProps {
    stepNumber: number;
    title: string;
    children: ReactNode;
}

const StepCard: React.FC<StepCardProps> = ({ stepNumber, title, children }) => {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-4 backdrop-blur-sm">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-lg">
                    {stepNumber}
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
                    <div className="text-gray-300 space-y-2">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StepCard;
