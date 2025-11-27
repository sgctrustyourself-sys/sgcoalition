import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, HelpCircle } from 'lucide-react';
import { useTutorial } from '../../context/TutorialContext';
import ProgressBar from './ProgressBar';
import { TUTORIAL_STEP_NAMES } from '../../constants';

interface TutorialLayoutProps {
    children: ReactNode;
    title: string;
    stepIndex: number;
    nextRoute?: string;
    prevRoute?: string;
    onNext?: () => void;
    onPrev?: () => void;
}

const TutorialLayout: React.FC<TutorialLayoutProps> = ({
    children,
    title,
    stepIndex,
    nextRoute,
    prevRoute,
    onNext,
    onPrev
}) => {
    const navigate = useNavigate();
    const { progress, nextStep, previousStep, completeStep } = useTutorial();

    const handleNext = () => {
        completeStep(stepIndex);
        if (onNext) {
            onNext();
        }
        if (nextRoute) {
            nextStep();
            navigate(nextRoute);
        }
    };

    const handlePrev = () => {
        if (onPrev) {
            onPrev();
        }
        if (prevRoute) {
            previousStep();
            navigate(prevRoute);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-black">
            <div className="max-w-4xl mx-auto">
                {/* Progress Bar */}
                <ProgressBar currentStep={stepIndex} completedSteps={progress.completedSteps} />

                {/* Page Title */}
                <h1 className="font-display text-4xl font-bold uppercase mb-2 text-white">
                    {title}
                </h1>
                <p className="text-gray-400 mb-8">
                    {TUTORIAL_STEP_NAMES[stepIndex - 1]}
                </p>

                {/* Content */}
                <div className="mb-8">
                    {children}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center gap-4">
                    {prevRoute ? (
                        <button
                            onClick={handlePrev}
                            className="flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-lg hover:bg-white/20 transition font-bold"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex gap-4">
                        {/* Help Link */}
                        <a
                            href="mailto:support@sgcoalition.xyz"
                            className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-gray-400 rounded-lg hover:text-white hover:border-white/30 transition"
                        >
                            <HelpCircle className="w-5 h-5" />
                            Need Help?
                        </a>

                        {nextRoute && (
                            <button
                                onClick={handleNext}
                                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-bold shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                            >
                                Next
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TutorialLayout;
