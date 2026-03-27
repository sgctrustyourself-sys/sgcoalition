import { Zap, Lock, Package, Crown, Globe } from 'lucide-react';

export interface UnlockTier {
    id: string;
    threshold: number;
    title: string;
    description: string;
    icon: any;
    color: string;
}

export const UNLOCK_TIERS: UnlockTier[] = [
    {
        id: 'early_access',
        threshold: 250,
        title: 'Early Drop Access',
        description: 'Get notified 1 hour before public drops.',
        icon: Zap,
        color: 'text-yellow-400'
    },
    {
        id: 'wizard_quest',
        threshold: 1000,
        title: 'Wizard Quest Access',
        description: 'Unlock exclusive Mini Wizard missions.',
        icon: Globe,
        color: 'text-purple-400'
    },
    {
        id: 'free_shipping',
        threshold: 3000,
        title: 'Global Free Shipping',
        description: 'Free shipping on all physical orders.',
        icon: Package,
        color: 'text-blue-400'
    },
    {
        id: 'governance',
        threshold: 10000,
        title: 'Governance x2',
        description: 'Double voting power on community proposals.',
        icon: Crown,
        color: 'text-amber-500'
    }
];

export const getNextUnlock = (balance: number) => {
    return UNLOCK_TIERS.find(tier => tier.threshold > balance) || null;
};
