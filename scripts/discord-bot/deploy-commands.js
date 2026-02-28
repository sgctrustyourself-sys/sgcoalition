require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
    {
        name: 'setup-coalition',
        description: 'Automatically set up the Coalition server structure',
    },
    {
        name: 'drop',
        description: 'Post a professional product drop',
        options: [
            {
                name: 'product',
                description: 'Product to drop',
                type: 3,
                required: true,
                choices: [
                    { name: 'Coalition Nf-tee', value: 'prod_nft_001' },
                    { name: 'Coalition Green Camo Wallet', value: 'prod_wallet_002' },
                    { name: 'Coalition Skyy Blue Wallet', value: 'prod_wallet_003' },
                    { name: 'Custom Coalition X Chrome Hearts Wallet', value: 'prod_wallet_chrome_hearts' },
                    { name: 'Coalition Distortion Tee', value: 'prod_tee_distortion' },
                ],
            },
        ],
    },
    {
        name: 'rules',
        description: 'Post the server rules protocol',
    },
    {
        name: 'verify',
        description: 'Get verification instructions',
    },
    {
        name: 'cleanup-old',
        description: 'Delete old/outdated channels from the server',
    },
    {
        name: 'create-community',
        description: 'Create COMMUNITY and REWARDS categories with existing channels',
    },
    {
        name: 'full-reorganize',
        description: 'Complete server reorganization (setup + cleanup + community)',
    },
    {
        name: 'archive-old',
        description: 'Move all current channels into an ARCHIVE category to clear the sidebar',
    },
    {
        name: 'deep-rebuild',
        description: 'Nuke old channels and rebuild the Coalition structure from scratch',
    },
    {
        name: 'scrape-media',
        description: 'Scan channels for images and videos and save them to a backup file',
    },
    {
        name: 'scrape-context',
        description: 'Save pinned messages and important announcements to a backup file',
    },
    {
        name: 'setup-roles',
        description: 'Automatically set up the Digital Trapstar role hierarchy',
    },
    {
        name: 'vouch',
        description: 'Submit a transaction vouch to 🧾│receipts',
        options: [
            {
                name: 'seller',
                description: 'The user you are vouching for',
                type: 6,
                required: true,
            },
            {
                name: 'item',
                description: 'What did you buy?',
                type: 3,
                required: true,
            },
            {
                name: 'proof',
                description: 'Screenshot of the transaction',
                type: 11,
                required: true,
            },
        ],
    },
    {
        name: 'log',
        description: 'Record your daily hustle in 📈│paper-trail',
        options: [
            {
                name: 'summary',
                description: 'What did you get done today?',
                type: 3,
                required: true,
            },
        ],
    },
    {
        name: 'wipe-server',
        description: '⚠️ NUCLEAR OPTION: Delete EVERY channel and category for a total reset',
    },
    {
        name: 'clean-archive',
        description: 'Remove duplicate channels and empty categories from the Archive',
    },
    {
        name: 'init-intel',
        description: 'Initialize each channel with its purpose and brand messaging',
    },
    {
        name: 'help',
        description: 'Get the Network Manual for all Coalition commands',
    },
    {
        name: 'blog',
        description: 'Fetch the latest updates and lore from the Coalition blog',
    },
    {
        name: 'post-blog',
        description: 'Broadcast a new blog post to the 📡│broadcasts channel',
        options: [
            { name: 'title', description: 'The title of the blog post', type: 3, required: true },
            { name: 'summary', description: 'A brief summary of the post', type: 3, required: true },
            { name: 'url', description: 'The URL to the full post', type: 3, required: true },
            { name: 'image', description: 'Optional image URL for the post', type: 3, required: false }
        ],
    },
    {
        name: 'post-drop',
        description: 'Broadcast a new product drop to the 📦│supply-drop channel',
        options: [
            { name: 'name', description: 'The name of the product', type: 3, required: true },
            { name: 'price', description: 'The price (e.g., $65)', type: 3, required: true },
            { name: 'description', description: 'Brief product hype text', type: 3, required: true },
            { name: 'url', description: 'The URL to the product page', type: 3, required: true },
            { name: 'image', description: 'Image URL for the product', type: 3, required: true }
        ],
    },
    {
        name: 'protocol-manual',
        description: 'Post the official Coalition Command protocol manual to the current channel',
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
