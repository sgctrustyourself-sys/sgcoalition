import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS } from '../constants/products';
import fullProducts from '../full_products.json';

interface FullProduct {
    id: string;
    name: string;
    price: number;
}

const typedFullProducts = fullProducts as FullProduct[];

describe('product price consistency', () => {
    it('every product shared between INITIAL_PRODUCTS and full_products.json has the same price', () => {
        const initialMap = new Map(INITIAL_PRODUCTS.map(p => [p.id, p]));
        const mismatches: string[] = [];

        for (const fullProduct of typedFullProducts) {
            const initialProduct = initialMap.get(fullProduct.id);
            if (!initialProduct) continue;

            if (initialProduct.price !== fullProduct.price) {
                mismatches.push(
                    `${fullProduct.id} ("${fullProduct.name}") — INITIAL_PRODUCTS=$${initialProduct.price}, full_products.json=$${fullProduct.price}`
                );
            }
        }

        expect(mismatches).toEqual([]);
    });
});
