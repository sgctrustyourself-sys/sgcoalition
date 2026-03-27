import { Giveaway, GiveawayEntry, GiveawayStatus, UserProfile } from '../types';

export const SUBSCRIBER_GIVEAWAY_TICKETS = 15;

export const isSubscriberEligible = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;

  return user.subscriptionStatus === 'active' || (user.isVIP === true && !user.isAdmin);
};

export const getGiveawayTicketCount = (entries: GiveawayEntry[] = []): number => {
  return entries.reduce((total, entry) => total + Math.max(1, Number(entry.entryCount) || 1), 0);
};

const buildSubscriberGiveawayEntry = (user: UserProfile, giveawayId: string): GiveawayEntry => ({
  id: `subscriber_${giveawayId}_${user.uid}`,
  giveawayId,
  userId: user.uid,
  name: user.displayName || user.email || 'Subscriber',
  email: user.email || user.uid,
  entryCount: SUBSCRIBER_GIVEAWAY_TICKETS,
  timestamp: Date.now(),
  source: 'subscriber'
});

export const ensureSubscriberGiveawayEntries = (
  giveaways: Giveaway[],
  user: UserProfile | null | undefined
): Giveaway[] => {
  if (!isSubscriberEligible(user) || !user?.uid) return giveaways;

  let changed = false;

  const nextGiveaways = giveaways.map(giveaway => {
    if (giveaway.status === GiveawayStatus.ENDED) return giveaway;

    const subscriberEntries = giveaway.entries.filter(
      entry => entry.userId === user.uid && entry.source === 'subscriber'
    );

    const normalizedSubscriberEntry = buildSubscriberGiveawayEntry(user, giveaway.id);

    if (subscriberEntries.length === 1) {
      const existing = subscriberEntries[0];
      const normalizedEntry = {
        ...normalizedSubscriberEntry,
        timestamp: existing.timestamp
      };
      const shouldNormalize =
        existing.entryCount !== SUBSCRIBER_GIVEAWAY_TICKETS ||
        existing.name !== normalizedSubscriberEntry.name ||
        existing.email !== normalizedSubscriberEntry.email ||
        existing.giveawayId !== normalizedSubscriberEntry.giveawayId;

      if (!shouldNormalize) return giveaway;

      changed = true;
      return {
        ...giveaway,
        entries: [
          ...giveaway.entries.filter(entry => !(entry.userId === user.uid && entry.source === 'subscriber')),
          { ...existing, ...normalizedEntry }
        ]
      };
    }

    if (subscriberEntries.length > 1) {
      const normalizedEntry = {
        ...normalizedSubscriberEntry,
        timestamp: subscriberEntries[0].timestamp
      };
      changed = true;
      return {
        ...giveaway,
        entries: [
          ...giveaway.entries.filter(entry => !(entry.userId === user.uid && entry.source === 'subscriber')),
          normalizedEntry
        ]
      };
    }

    changed = true;
    return {
      ...giveaway,
      entries: [...giveaway.entries, normalizedSubscriberEntry]
    };
  });

  return changed ? nextGiveaways : giveaways;
};

export const pickWeightedGiveawayWinners = (
  entries: GiveawayEntry[],
  count: number
): GiveawayEntry[] => {
  const remainingEntries = [...entries];
  const winners: GiveawayEntry[] = [];

  const getWeight = (entry: GiveawayEntry) => Math.max(1, Number(entry.entryCount) || 1);

  for (let i = 0; i < count && remainingEntries.length > 0; i += 1) {
    const totalWeight = remainingEntries.reduce((sum, entry) => sum + getWeight(entry), 0);
    const roll = Math.random() * totalWeight;

    let cursor = 0;
    let pickedIndex = 0;

    for (let index = 0; index < remainingEntries.length; index += 1) {
      cursor += getWeight(remainingEntries[index]);
      if (roll < cursor) {
        pickedIndex = index;
        break;
      }
    }

    winners.push(remainingEntries.splice(pickedIndex, 1)[0]);
  }

  return winners;
};
