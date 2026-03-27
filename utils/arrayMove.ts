export const moveArrayItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
    if (
        fromIndex < 0 ||
        fromIndex >= items.length ||
        toIndex < 0 ||
        toIndex >= items.length ||
        fromIndex === toIndex
    ) {
        return items;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    return nextItems;
};

export const remapIndexAfterMove = (currentIndex: number, fromIndex: number, toIndex: number): number => {
    if (currentIndex === fromIndex) {
        return toIndex;
    }

    if (fromIndex < toIndex && currentIndex > fromIndex && currentIndex <= toIndex) {
        return currentIndex - 1;
    }

    if (fromIndex > toIndex && currentIndex >= toIndex && currentIndex < fromIndex) {
        return currentIndex + 1;
    }

    return currentIndex;
};
