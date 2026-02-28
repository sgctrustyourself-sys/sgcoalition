import { useState, useEffect } from 'react';
import { TUTORIAL_STORAGE_KEY, TUTORIAL_STEPS } from '../constants';

export interface TutorialProgress {
    currentStep: number; // 0-7 (0=not started, 7=completed)
    completedSteps: number[]; // Array of completed step indices
    lastVisited: string; // ISO timestamp
}

const defaultProgress: TutorialProgress = {
    currentStep: 0,
    completedSteps: [],
    lastVisited: new Date().toISOString()
};

export const useTutorialProgress = () => {
    const [progress, setProgress] = useState<TutorialProgress>(defaultProgress);

    // Load progress from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(TUTORIAL_STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setProgress(parsed);
            } catch (error) {
                console.error('Failed to parse tutorial progress:', error);
            }
        }
    }, []);

    // Save progress to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(progress));
    }, [progress]);

    const goToStep = (step: number) => {
        if (step >= 0 && step <= TUTORIAL_STEPS + 1) {
            setProgress(prev => ({
                ...prev,
                currentStep: step,
                lastVisited: new Date().toISOString()
            }));
        }
    };

    const completeStep = (step: number) => {
        setProgress(prev => ({
            ...prev,
            completedSteps: prev.completedSteps.includes(step)
                ? prev.completedSteps
                : [...prev.completedSteps, step],
            lastVisited: new Date().toISOString()
        }));
    };

    const nextStep = () => {
        const next = progress.currentStep + 1;
        completeStep(progress.currentStep);
        goToStep(next);
    };

    const previousStep = () => {
        const prev = progress.currentStep - 1;
        goToStep(prev);
    };

    const resetProgress = () => {
        setProgress(defaultProgress);
        localStorage.removeItem(TUTORIAL_STORAGE_KEY);
    };

    const isStepCompleted = (step: number): boolean => {
        return progress.completedSteps.includes(step);
    };

    const getProgressPercentage = (): number => {
        return Math.round((progress.completedSteps.length / TUTORIAL_STEPS) * 100);
    };

    return {
        progress,
        goToStep,
        completeStep,
        nextStep,
        previousStep,
        resetProgress,
        isStepCompleted,
        getProgressPercentage
    };
};
