import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Product, SizeChartSpec } from '../../types';

type SizeChartRow = SizeChartSpec['rows'][number];
type SizeChartColumn = Exclude<keyof SizeChartRow, 'label'>;

interface SizeChartModalProps {
    open: boolean;
    onClose: () => void;
    product: Pick<Product, 'category' | 'name' | 'sizes' | 'specs'>;
}

/**
 * Category-aware default charts. The PDP wires this through the existing
 * "Size guide" link (which currently points at href="#" - wired into a
 * button that toggles this modal). Per-product overrides on
 * `ProductSpecs.sizeChart` win over the category default.
 */
const DEFAULT_CHART_BY_CATEGORY: Record<Product['category'], SizeChartSpec> = {
    shirt: {
        title: 'T-shirt fit guide',
        rows: [
            { label: 'S', chest: '34-36 in', length: '27 in' },
            { label: 'M', chest: '38-40 in', length: '28 in' },
            { label: 'L', chest: '42-44 in', length: '29 in' },
            { label: 'XL', chest: '46-48 in', length: '30 in' },
            { label: '2XL', chest: '50-52 in', length: '31 in' },
        ],
        tip: 'Measurements are taken across the chest, lying flat. Length is from the high-point shoulder to the hem.',
    },
    shorts: {
        title: 'Shorts fit guide',
        rows: [
            { label: 'S', waist: '28-30 in', inseam: '7 in' },
            { label: 'M', waist: '32-34 in', inseam: '7.5 in' },
            { label: 'L', waist: '36-38 in', inseam: '8 in' },
            { label: 'XL', waist: '40-42 in', inseam: '8.5 in' },
            { label: '2XL', waist: '44-46 in', inseam: '9 in' },
        ],
        tip: 'Waist is measured flat across the elastic relaxed. Inseam runs from crotch to leg hem.',
    },
    sweatshirt: {
        title: 'Hoodie fit guide',
        rows: [
            { label: 'S', chest: '40-42 in', length: '27 in' },
            { label: 'M', chest: '42-44 in', length: '28 in' },
            { label: 'L', chest: '44-46 in', length: '29 in' },
            { label: 'XL', chest: '46-48 in', length: '30 in' },
            { label: '2XL', chest: '48-50 in', length: '31 in' },
        ],
        tip: 'Hoodies run roomy. Size down for a fitted silhouette, size up for an oversized drape.',
    },
    dress: {
        title: 'Dress fit guide',
        rows: [
            { label: 'S', chest: '32-34 in', length: '32 in' },
            { label: 'M', chest: '34-36 in', length: '33 in' },
            { label: 'L', chest: '36-38 in', length: '34 in' },
            { label: 'XL', chest: '38-40 in', length: '35 in' },
        ],
        tip: 'Length is measured from the high-point shoulder to the hem.',
    },
    jeans: {
        title: 'Jeans fit guide',
        rows: [
            { label: '30', waist: '30 in', inseam: '32 in' },
            { label: '32', waist: '32 in', inseam: '32 in' },
            { label: '34', waist: '34 in', inseam: '32 in' },
            { label: '36', waist: '36 in', inseam: '32 in' },
        ],
        tip: 'Waist is taken flat across the top of the waistband. Inseam runs from crotch to leg hem.',
    },
    wallet: {
        title: 'Wallet dimensions',
        rows: [
            { label: 'One Size', notes: '4.25 in x 3.25 in folded. Six card slots, two hidden pockets, one billfold.' },
        ],
        tip: 'Hand-cut and hand-stitched - dimensions can flex +/- 0.05 in per piece.',
    },
    hat: {
        title: 'Hat fit guide',
        rows: [
            { label: 'One Size', circumference: '21.5-23 in' },
        ],
        tip: 'Snapback closure adjusts from 21.5 in to 23 in. Trucker-style sweatband on the inside.',
    },
    apparel: {
        title: 'Apparel fit guide',
        rows: [
            { label: 'S', chest: '34-36 in' },
            { label: 'M', chest: '38-40 in' },
            { label: 'L', chest: '42-44 in' },
            { label: 'XL', chest: '46-48 in' },
            { label: '2XL', chest: '50-52 in' },
        ],
        tip: 'Measurements are taken across the chest, lying flat.',
    },
    accessory: {
        title: 'Accessory dimensions',
        rows: [
            { label: 'One Size', notes: 'See product description for dimensions.' },
        ],
        tip: 'Hand-finished - dimensions can flex per piece.',
    },
};

const SizeChartModal: React.FC<SizeChartModalProps> = ({ open, onClose, product }) => {
    useEffect(() => {
        if (!open) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', handleKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    const override = product.specs?.sizeChart;
    const chart = override ?? DEFAULT_CHART_BY_CATEGORY[product.category] ?? DEFAULT_CHART_BY_CATEGORY.apparel;
    const title = chart.title ?? `${product.name} - Size guide`;

    const columns = uniqueColumns(chart.rows);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
            onClick={onClose}
            data-testid="size-chart-modal"
        >
            <div
                className="relative w-full max-w-2xl rounded-md border border-white/10 bg-black/95 p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close size guide"
                    className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>

                <h2 className="text-xl font-display font-bold uppercase tracking-tight text-white text-glow">
                    {title}
                </h2>

                <p className="mt-2 text-xs text-gray-400">
                    {product.sizes?.length
                        ? `Available sizes: ${product.sizes.join(', ')}`
                        : 'One-size piece.'}
                </p>

                <table className="mt-5 w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                            <th className="py-2 pr-4">Size</th>
                            {columns.map(column => (
                                <th key={column} className="py-2 pr-4">{columnLabels[column]}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {chart.rows.map(row => (
                            <tr key={row.label} className="border-b border-white/5 text-xs text-gray-200">
                                <td className="py-2 pr-4 font-bold uppercase tracking-widest text-white">{row.label}</td>
                                {columns.map(column => (
                                    <td key={column} className="py-2 pr-4">{row[column] ?? '-'}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {chart.tip && (
                    <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-gray-400">
                        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-accent">Heads up</span>
                        <br />
                        {chart.tip}
                    </p>
                )}
            </div>
        </div>
    );
};

function uniqueColumns(rows: SizeChartRow[]): SizeChartColumn[] {
    const seen = new Set<SizeChartColumn>();
    for (const row of rows) {
        for (const key of Object.keys(row) as SizeChartColumn[]) {
            seen.add(key);
        }
    }
    return Array.from(seen);
}

const columnLabels: Record<SizeChartColumn, string> = {
    chest: 'Chest',
    length: 'Length',
    waist: 'Waist',
    inseam: 'Inseam',
    circumference: 'Circumference',
    notes: 'Notes',
};

export default SizeChartModal;
