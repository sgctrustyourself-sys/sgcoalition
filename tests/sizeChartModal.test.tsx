import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SizeChartModal from '../components/ui/SizeChartModal';

vi.mock('lucide-react', () => ({
    X: () => null,
}));

const walletProduct = {
    category: 'wallet' as const,
    name: 'Test Wallet',
    sizes: ['One Size'],
    specs: undefined,
};

const shirtProduct = {
    category: 'shirt' as const,
    name: 'Test Tee',
    sizes: ['S', 'M', 'L', 'XL'],
    specs: undefined,
};

describe('SizeChartModal', () => {
    afterEach(() => cleanup());

    it('renders nothing when closed', () => {
        render(
            <SizeChartModal
                open={false}
                onClose={() => undefined}
                product={shirtProduct}
            />,
        );
        expect(screen.queryByTestId('size-chart-modal')).toBeNull();
    });

    it('renders a dialog when open with the category default title', () => {
        render(
            <SizeChartModal
                open
                onClose={() => undefined}
                product={shirtProduct}
            />,
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog.getAttribute('aria-label')).toMatch(/T-shirt fit guide/);
        expect(screen.getByText(/Available sizes: S, M, L, XL/)).toBeInTheDocument();
    });

    it('renders the wallet default chart with One Size and the dimension note', () => {
        render(
            <SizeChartModal
                open
                onClose={() => undefined}
                product={walletProduct}
            />,
        );

        expect(screen.getByRole('dialog').getAttribute('aria-label')).toMatch(/Wallet dimensions/);
        expect(screen.getByText(/Available sizes: One Size/)).toBeInTheDocument();
        expect(screen.getByText(/Six card slots/)).toBeInTheDocument();
    });

    it('uses product.specs.sizeChart.title override when provided', () => {
        render(
            <SizeChartModal
                open
                onClose={() => undefined}
                product={{
                    ...shirtProduct,
                    specs: {
                        sizeChart: {
                            title: 'NF-Tee custom cut',
                            rows: [{ label: 'M', chest: '38-40 in' }],
                            tip: 'Tailored for streetwear fit.',
                        },
                    },
                }}
            />,
        );

        expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('NF-Tee custom cut');
        expect(screen.getByText(/Tailored for streetwear fit/)).toBeInTheDocument();
    });

    it('invokes onClose when the overlay is clicked', () => {
        const onClose = vi.fn();
        render(
            <SizeChartModal
                open
                onClose={onClose}
                product={shirtProduct}
            />,
        );

        fireEvent.click(screen.getByTestId('size-chart-modal'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT invoke onClose when the inner card is clicked (stopPropagation)', () => {
        const onClose = vi.fn();
        render(
            <SizeChartModal
                open
                onClose={onClose}
                product={shirtProduct}
            />,
        );

        const dialog = screen.getByRole('dialog');
        const card = dialog.firstChild as HTMLElement;
        fireEvent.click(card);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('invokes onClose when the close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <SizeChartModal
                open
                onClose={onClose}
                product={shirtProduct}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: /close size guide/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
