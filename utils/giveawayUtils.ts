/**
 * Giveaway utilities
 */

export const addGiveawayEntry = async (entry: any) => {
    // Add giveaway entry to localStorage
    const entries = JSON.parse(localStorage.getItem('giveaway_entries') || '[]');
    entries.push(entry);
    localStorage.setItem('giveaway_entries', JSON.stringify(entries));
    return entry;
};
