import { CartItem, OrderItem, Product } from '../types';

export const WALLET_KEYCHAIN_CLIP_PRICE = 10;
export const WALLET_KEYCHAIN_CLIP_LABEL = 'Keychain clip-on';

export const isWalletProduct = (product?: Pick<Product, 'category'> | null) => product?.category === 'wallet';

export const getCartItemAddOnPrice = (item: Pick<CartItem, 'keychainClipOn'>) =>
    item.keychainClipOn ? WALLET_KEYCHAIN_CLIP_PRICE : 0;

export const getCartItemUnitPrice = (item: Pick<CartItem, 'price' | 'keychainClipOn'>) =>
    item.price + getCartItemAddOnPrice(item);

export const getCartItemLineTotal = (item: Pick<CartItem, 'price' | 'quantity' | 'keychainClipOn'>) =>
    getCartItemUnitPrice(item) * item.quantity;

export const getOrderItemAddOnPrice = (item: Pick<OrderItem, 'addOnPrice' | 'keychainClipOn'>) => {
    const explicitAddOnPrice = Number(item.addOnPrice || 0);
    if (explicitAddOnPrice > 0) return explicitAddOnPrice;
    return item.keychainClipOn ? WALLET_KEYCHAIN_CLIP_PRICE : 0;
};

export const getOrderItemAddOnLabel = (item: Pick<OrderItem, 'addOnLabel' | 'keychainClipOn'>) =>
    item.addOnLabel || (item.keychainClipOn ? WALLET_KEYCHAIN_CLIP_LABEL : '');
