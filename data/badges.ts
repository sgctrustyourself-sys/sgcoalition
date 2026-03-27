import { LucideIcon, Award, Zap, ShoppingBag, Shield, Users } from 'lucide-react';

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    color: string; // Tailwind color class for glow/text
    tier: 'common' | 'rare' | 'epic' | 'legendary';
    acquiredDate?: string;
}

export const BADGE_DEFINITIONS: Record<string, Omit<Badge, 'acquiredDate'>> = {
    'founding_supporter': {
        id: 'founding_supporter',
        name: 'Founding Supporter',
        description: 'Interacted with the ecosystem before the Genesis cutoff.',
        icon: Shield,
        color: 'text-amber-400',
        tier: 'legendary'
    },
    'first_100': {
        id: 'first_100',
        name: 'First 100 Orders',
        description: 'One of the first 100 believers to place an order.',
        icon: Zap,
        color: 'text-blue-400',
        tier: 'epic'
    },
    'multi_drop': {
        id: 'multi_drop',
        name: 'Multi-Drop Buyer',
        description: 'Collected items from 3+ different drops.',
        icon: ShoppingBag,
        color: 'text-purple-400',
        tier: 'rare'
    },
    'coalition_wizard': {
        id: 'coalition_wizard',
        name: 'Coalition × Wizard',
        description: 'Active holder in both SG Coalition and Mini Wizards communities.',
        icon: Users,
        color: 'text-emerald-400',
        tier: 'epic'
    },
    'genesis_holder': {
        id: 'genesis_holder',
        name: 'Genesis Holder',
        description: 'Held SGCOIN since day 1.',
        icon: Award,
        color: 'text-pink-500',
        tier: 'legendary'
    }
};

// Mock function to get badges based on wallet address
export const getBadgesForWallet = (address: string): Badge[] => {
    const badges: Badge[] = [];

    if (!address) return [];

    // Simulate "Founding Supporter" for everyone for demo
    badges.push({
        ...BADGE_DEFINITIONS['founding_supporter'],
        acquiredDate: '2023-11-15'
    });

    // Simulate random badges based on address char codes to be deterministic-ish
    if (address.toLowerCase().includes('a')) {
        badges.push({
            ...BADGE_DEFINITIONS['first_100'],
            acquiredDate: '2024-01-20'
        });
    }

    if (address.toLowerCase().includes('b')) {
        badges.push({
            ...BADGE_DEFINITIONS['coalition_wizard'],
            acquiredDate: '2024-02-10'
        });
    }

    return badges;
};
