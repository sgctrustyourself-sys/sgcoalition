// Global type definitions
interface Window {
    ethereum?: any;
    paypal?: any;
    __coalitionBooted?: boolean;
    __coalitionPaypalReady?: boolean;
    __coalitionPaypalLoadFailed?: boolean;
}

declare module 'ethers';
