import { MiniWizard } from '../types/MiniWizard';

export const MOCK_WIZARDS: MiniWizard[] = [
    {
        id: '1',
        name: 'Inferno Mage',
        image: 'https://gateway.pinata.cloud/ipfs/QmZ8y7Jv1xRz1m9q6V8m7q8m7q8m7q8m7q8m7q8m7q8m7q', // Placeholder
        tokenUri: '',
        attributes: [
            { trait_type: 'Element', value: 'Fire' },
            { trait_type: 'Rarity', value: 'Legendary' }
        ],
        element: 'Fire',
        level: 12,
        power: 850,
        isLegacy: false
    },
    {
        id: '2',
        name: 'Frost Weaver',
        image: 'https://gateway.pinata.cloud/ipfs/QmZ8y7Jv1xRz1m9q6V8m7q8m7q8m7q8m7q8m7q8m7q8m7q8m7q', // Placeholder
        tokenUri: '',
        attributes: [
            { trait_type: 'Element', value: 'Ice' },
            { trait_type: 'Rarity', value: 'Rare' }
        ],
        element: 'Ice',
        level: 8,
        power: 420,
        isLegacy: false
    },
    {
        id: '3',
        name: 'Void Stalker',
        image: 'https://gateway.pinata.cloud/ipfs/QmZ8y7Jv1xRz1m9q6V8m7q8m7q8m7q8m7q8m7q8m7q8m7q8m7q', // Placeholder
        tokenUri: '',
        attributes: [
            { trait_type: 'Element', value: 'Void' },
            { trait_type: 'Rarity', value: 'Epic' }
        ],
        element: 'Void',
        level: 15,
        power: 1200,
        isLegacy: false
    }
];
