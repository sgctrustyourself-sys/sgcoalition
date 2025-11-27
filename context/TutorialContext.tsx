import React, { createContext, useContext, ReactNode } from 'react';
import { useTutorialProgress, TutorialProgress } from '../hooks/useTutorialProgress';

interface TutorialContextType {
    progress: TutorialProgress;
    goToStep: (step: number) => void;
    completeStep: (step: number) => void;
    nextStep: () => void;
    previousStep: () => void;
    resetProgress: () => void;
    isStepCompleted: (step: number) => boolean;
    getProgressPercentage: () => number;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const tutorialState = useTutorialProgress();

    return (
        <TutorialContext.Provider value={tutorialState}>
            {children}
        </TutorialContext.Provider>
    );
};

export const useTutorial = () => {
    const context = useContext(TutorialContext);
    if (context === undefined) {
        throw new Error('useTutorial must be used within a TutorialProvider');
    }
    return context;
};
