import React from 'react';
import { TUTORIAL_STEPS } from '../../constants';

interface ProgressBarProps {
    currentStep: number;
    completedSteps: number[];
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, completedSteps }) => {
    const percentage = Math.round((completedSteps.length / TUTORIAL_STEPS) * 100);

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">
                    Step {currentStep} of {TUTORIAL_STEPS}
                </span>
                <span className="text-sm text-green-400 font-bold">
                    {percentage}% Complete
                </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <div className="flex justify-between mt-2">
                {Array.from({ length: TUTORIAL_STEPS }, (_, i) => i + 1).map((step) => (
                    <div
                        key={step}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${completedSteps.includes(step)
                                ? 'bg-green-500 text-white'
                                : step === currentStep
                                    ? 'bg-white text-black'
                                    : 'bg-gray-700 text-gray-400'
                            }`}
                    >
                        {step}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProgressBar;
