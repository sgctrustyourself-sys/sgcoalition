import { Product, Section } from './types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_001',
    name: 'Coalition Classic Tee',
    price: 45,
    images: ['/images/tee-front.png', '/images/tee-back.png'],
    description: 'The staple piece. Heavyweight cotton, boxy fit. Crafted in Baltimore, Maryland. Each tee includes dual NFC tags for digital verification.',
    category: 'apparel',
    isFeatured: true,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    sizeInventory: {
      'S': 15,
      'M': 25,
      'L': 30,
      'XL': 20,
      'XXL': 10
    },
    nft: {
      contractAddress: '0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201',
      tokenId: '6915469788939700255662107688630493008422408564534094781606241966635645665283',
      chain: 'polygon',
      openseaUrl: 'https://opensea.io/assets/polygon/0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201/6915469788939700255662107688630493008422408564534094781606241966635645665283',
      nfcTags: {
        neck: 'https://linktr.ee/sgcoalition',
        tag: 'https://opensea.io/assets/polygon/0x7b9cfeb2af83f6b4b5fe87b6a71edf5346543201/6915469788939700255662107688630493008422408564534094781606241966635645665283'
      }
    }
  },
  {
    id: 'prod_002',
    name: 'Baltimore Hoodie',
    price: 85,
    images: ['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
    description: 'Ultra-soft french terry. Perfect for city nights.',
    category: 'apparel',
    isFeatured: false,
    sizes: ['M', 'L', 'XL'],
    sizeInventory: {
      'M': 15,
      'L': 20,
      'XL': 15
    }
  },
  {
    id: 'prod_003',
    name: 'Logo Cap',
    price: 30,
    images: ['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
    description: '6-panel structured cap with embroidered Coalition logo.',
    category: 'accessory',
    isFeatured: false,
    sizes: ['One Size'],
    sizeInventory: {
      'One Size': 200
    }
  }
];

export const ABOUT_TEXT = `Coalition is more than a brand; it is a movement born on the streets of Baltimore. We believe in the power of unity and the strength of the collective. Every stitch represents our commitment to quality, community, and the hustle that defines our city. Join the Coalition.`;

export const INITIAL_SECTIONS: Section[] = [
  {
    id: 'sec_hero',
    type: 'hero',
    title: 'Crafted in Baltimore',
    isVisible: true,
    order: 0,
    content: 'Premium streetwear designed for the city that built us.'
  },
  {
    id: 'sec_featured',
    type: 'featured',
    title: 'Spotlight',
    isVisible: true,
    order: 1
  },
  {
    id: 'sec_grid',
    type: 'grid',
    title: 'Latest Drops',
    isVisible: true,
    order: 2
  },
  {
    id: 'sec_about',
    type: 'about_teaser',
    title: 'The Coalition',
    isVisible: true,
    order: 3,
    content: ABOUT_TEXT.substring(0, 200) + '...'
  },
];

export const COIN_REWARD_RATE = 1500; // 30,000 coins per $20 = 1500 per $1