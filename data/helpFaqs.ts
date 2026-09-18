// Single source of truth for the /help FAQ copy.
//
// Three consumers read this list, so the answers can never drift apart:
//   - pages/Help.tsx        — renders it (icons are keyed off `id`)
//   - scripts/generateSeoArtifacts.mjs — parses it into the prerendered
//     FAQPage JSON-LD. The build script is plain Node (.mjs), so it cannot
//     `import` this TS module; it regex-parses the array instead, the same
//     contract constants/products.ts already lives under.
//   - tests/structuredData.test.ts — pins the parser against this list.
//
// `answer` is a plain string on purpose: answers feed FAQPage.acceptedAnswer.text,
// so a JSX answer would silently ship nothing to crawlers. Keep them strings.

export interface HelpFaq {
    id: string;
    question: string;
    answer: string;
}

export const HELP_FAQS: readonly HelpFaq[] = [
    {
        id: 'orders',
        question: 'How do I place an order?',
        answer: "Browse our shop, select your size, and click 'Add to Cart'. When ready, click the cart icon in the header and proceed to checkout. We accept card payments, crypto, and store credit.",
    },
    {
        id: 'vip',
        question: 'What is Coalition VIP?',
        answer: 'Coalition VIP is our premium membership that offers exclusive benefits including monthly store credit, free shipping, and early access to drops. You can manage your membership in your profile or the dedicated VIP page.',
    },
    {
        id: 'payments',
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards, Apple Pay, Google Pay, and cryptocurrency via the Polygon network. Store credit can also be applied at checkout for VIP members.',
    },
    {
        id: 'sgcoin',
        question: 'What is SGCoin and how do I earn it?',
        answer: 'SGCoin is our digital currency used within the Coalition ecosystem. You can earn it through purchases, participation in community events, and by holding select physical items with digital twins.',
    },
    {
        id: 'wallet',
        question: 'How do I link my crypto wallet? (Optional)',
        answer: 'Visit your settings or the wallet connect modal in the header. We support MetaMask and other WalletConnect-compatible wallets. This is optional but unlocks Web3-exclusive perks.',
    },
    {
        id: 'shipping',
        question: 'What is your shipping policy?',
        answer: 'We ship worldwide. US orders typically arrive in 3-5 business days. International shipping times vary by location. VIP members receive complimentary express shipping on all orders.',
    },
    {
        id: 'returns',
        question: 'What is your return policy?',
        answer: 'Returns are accepted within 14 days of receipt for unused items in original packaging. Some limited releases may be final sale. Please check the product description for specific terms.',
    },
    {
        id: 'tracking',
        question: 'How can I track my order?',
        answer: "Once your order ships, you'll receive a confirmation email with a tracking link. You can also view your order history and status in your profile dashboard.",
    },
    {
        id: 'support',
        question: 'I have another question. How do I contact support?',
        answer: 'Our support team is available 24/7. You can reach us via email at sgctrustyourself@gmail.com or through our community Discord channel.',
    },
];
