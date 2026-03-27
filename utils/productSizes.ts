const ONE_SIZE_LABEL = 'One Size';

export const getProductEditableSizes = (
    sizes?: string[],
    sizeInventory?: Record<string, number>
): string[] => {
    if (sizes && sizes.length > 0) {
        return sizes;
    }

    const inventoryKeys = sizeInventory ? Object.keys(sizeInventory).filter(Boolean) : [];
    if (inventoryKeys.length > 0) {
        return inventoryKeys;
    }

    return [ONE_SIZE_LABEL];
};

export const normalizeProductSizeData = (
    sizes?: string[],
    sizeInventory?: Record<string, number>
) => {
    const resolvedSizes = getProductEditableSizes(sizes, sizeInventory);
    const resolvedInventory: Record<string, number> = {};

    resolvedSizes.forEach(size => {
        const rawValue = sizeInventory?.[size];
        resolvedInventory[size] = Number.isFinite(Number(rawValue)) ? Number(rawValue) : 0;
    });

    return {
        sizes: resolvedSizes,
        sizeInventory: resolvedInventory,
    };
};
