export interface MiniWizard {
    id: string;
    name: string;
    image: string;
    tokenUri: string;
    attributes: { trait_type: string; value: string }[];
    element: string;
    level: number;
    power: number;
    isLegacy: boolean;
}
