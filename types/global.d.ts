// Centralized global type augmentations for the project

declare global {
    interface Window {
        ethereum?: any; // MetaMask / Web3 provider
        paypal?: any; // PayPal JavaScript SDK
    }
}

export {};
