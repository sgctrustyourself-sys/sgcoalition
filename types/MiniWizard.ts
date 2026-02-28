export interface MiniWizard {
    id: string; // Token ID
    name: string;
    image: string;
    tokenUri: string;
    attributes: {
        trait_type: string;
        value: string | number;
    }[];
    // Derived properties for the dashboard
    element: 'Fire' | 'Ice' | 'Void' | 'Earth' | 'Lightning' | 'Unknown';
    level: number;
    power: number;
    isLegacy: boolean;
}
