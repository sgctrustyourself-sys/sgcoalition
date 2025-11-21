// Decentraland Products Data
export interface DecentralandProduct {
    id: string;
    name: string;
    description: string;
    url: string;
    imageUrl: string;
    category: 'upper_body' | 'lower_body' | 'feet' | 'hat' | 'accessory' | 'skin';
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'unique';
    collaboration?: string;
    colorways?: string[];
}

export const DECENTRALAND_PRODUCTS: DecentralandProduct[] = [
    {
        id: '136fa3f9-3ad8-4007-ba05-d4bb1db5a028',
        name: 'Coalition Sword Shirt',
        description: 'Black/Yellow Colorways with Red Glow - Wearable shirt with sword included',
        url: 'https://decentraland.org/builder/items/136fa3f9-3ad8-4007-ba05-d4bb1db5a028',
        imageUrl: 'https://peer.decentraland.org/content/contents/QmYourImageHash', // Placeholder - will update with actual image
        category: 'upper_body',
        rarity: 'rare',
        collaboration: 'LingXing',
        colorways: ['Black', 'Yellow', 'Red Glow']
    }
    // Add more products here as you provide them
];

// OpenSea Collections Data
export interface OpenSeaCollection {
    name: string;
    slug: string;
    description: string;
    url: string;
    imageUrl?: string;
    itemCount?: number;
    floorPrice?: string;
}

export const OPENSEA_COLLECTIONS: OpenSeaCollection[] = [
    // Add your OpenSea collections here
    // Example:
    // {
    //     name: "Coalition Wearables",
    //     slug: "coalition-wearables",
    //     description: "Virtual fashion for the metaverse",
    //     url: "https://opensea.io/collection/coalition-wearables",
    //     itemCount: 12
    // }
];
