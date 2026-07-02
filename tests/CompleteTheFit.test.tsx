import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Mock } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { Product } from '../types';

const mocks = vi.hoisted(() => ({
    useAppMock: vi.fn(),
    useToastMock: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
    useApp: () => mocks.useAppMock(),
}));

vi.mock('../context/ToastContext', () => ({
    useToast: () => mocks.useToastMock(),
}));

import CompleteTheFit from '../components/CompleteTheFit';
import {
    WOMENS_ABOVE_AS_BELOW_CONTRAST_SHORTS_ID,
    WOMENS_ABOVE_AS_BELOW_CROP_TANK_ID,
    WOMENS_ABOVE_AS_BELOW_SET_ID,
} from '../utils/aboveAsBelowSet';

const cropTankProduct: Product = {
    id: WOMENS_ABOVE_AS_BELOW_CROP_TANK_ID,
    name: "WOMEN'S COALITION ABOVE AS BELOW CREWNECK CROP TANK",
    price: 40,
    category: 'shirt',
    images: ['/images/womens-above-as-below-crop-tank-front.png'],
    description: 'Crop tank',
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 },
    archived: false,
};

const contrastShortsProduct: Product = {
    id: WOMENS_ABOVE_AS_BELOW_CONTRAST_SHORTS_ID,
    name: "WOMEN'S COALITION ABOVE AS BELOW CONTRAST SHORTS",
    price: 40,
    category: 'shorts',
    images: ['/images/womens-above-as-below-contrast-shorts-front.png'],
    description: 'Contrast shorts',
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 },
    archived: false,
};

const womensSetProduct: Product = {
    id: WOMENS_ABOVE_AS_BELOW_SET_ID,
    name: "WOMEN'S COALITION ABOVE AS BELOW SET",
    price: 75,
    category: 'apparel',
    images: ['/images/womens-above-as-below-set-front.png'],
    description: 'Crop tank and contrast shorts set',
    sizes: ['S', 'M', 'L', 'XL'],
    sizeInventory: { S: 1, M: 1, L: 1, XL: 1 },
    archived: false,
};

function setupCompleteTheFit(currentProduct: Product) {
    const addToCartFn = vi.fn();
    mocks.useAppMock.mockImplementation(() => ({
        products: [cropTankProduct, contrastShortsProduct, womensSetProduct],
        cart: [],
        addToCart: addToCartFn,
    }));
    mocks.useToastMock.mockImplementation(() => ({
        addToast: vi.fn(),
        removeToast: vi.fn(),
        toasts: [],
    }));

    render(
        <MemoryRouter>
            <CompleteTheFit
                currentProduct={currentProduct}
                selectedSize="M"
                isUnavailable={false}
            />
        </MemoryRouter>,
    );

    return { addToCartFn };
}

describe('CompleteTheFit -- women set suggestion', () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('shows the $75 women set suggestion on the crop tank PDP and adds the set SKU', () => {
        const { addToCartFn } = setupCompleteTheFit(cropTankProduct);

        expect(
            screen.getByRole('heading', { name: /Women's Above as Below Set - \$75/i }),
        ).toBeInTheDocument();
        expect(screen.getByText('$80.00')).toBeInTheDocument();
        expect(screen.getByText('$75.00')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {
            name: /Add WOMEN'S COALITION ABOVE AS BELOW SET at size M for \$75.00/i,
        }));

        expect(addToCartFn as Mock).toHaveBeenCalledTimes(1);
        expect(addToCartFn as Mock).toHaveBeenCalledWith(
            expect.objectContaining({ id: WOMENS_ABOVE_AS_BELOW_SET_ID }),
            'M',
        );
    });

    it('shows the same $75 women set suggestion on the contrast shorts PDP', () => {
        setupCompleteTheFit(contrastShortsProduct);

        expect(
            screen.getByRole('heading', { name: /Women's Above as Below Set - \$75/i }),
        ).toBeInTheDocument();
        expect(screen.getByText('Crop tank + contrast shorts together in one set SKU.')).toBeInTheDocument();
    });
});
