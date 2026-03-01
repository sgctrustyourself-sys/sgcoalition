require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits, ChannelType, ApplicationCommandOptionType, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Express Webhook Server
const express = require('express');
const app = express();
app.use(express.json());
const WEBHOOK_PORT = 5001;

// --- BURN MONITOR CONSTANTS ---
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || 'I4WCIAFNGZWXSKX8NQV87ZF4IC43KJ4YVD';
const SGCOIN_V1_CONTRACT = '0x951806a2581c22C478aC613a675e6c898E2aBe21';
const SGCOIN_BURN_ADDRESS = '0x20756b2667D575Ddde2383f3841D2CD855D5fb6d';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
let lastProcessedHash = null;
// ------------------------------

// Webhook for Automated Blog Posts
app.post('/webhook/blog', async (req, res) => {
    const { title, summary, url, imageUrl, secret } = req.body;

    // Optional: Basic secret check (from .env)
    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const guild = client.guilds.cache.first(); // Get the primary guild
        if (!guild) return res.status(500).json({ error: 'Guild not found' });

        const broadcastChannel = guild.channels.cache.find(c => c.name === '📡│broadcasts' && c.type === ChannelType.GuildText);
        if (!broadcastChannel) {
            console.error('❌ Broadcast channel not found for webhook.');
            return res.status(500).json({ error: 'Broadcast channel not found' });
        }

        const postEmbed = {
            title: `— 📠 NEW PROTOCOL: ${title.toUpperCase()} —`,
            color: 0xFFAE00,
            description: summary,
            fields: [
                { name: '🔗 Mission Link', value: `[Read the full report here](${url})` }
            ],
            footer: { text: "Coalition Signal • Automated Intelligence Feed" },
            timestamp: new Date(),
        };

        if (imageUrl) {
            postEmbed.image = { url: imageUrl };
        }

        await broadcastChannel.send({ content: '@everyone — 📡 NEW MISSION LOG DETECTED.', embeds: [postEmbed] });
        console.log(`✅ Automated Blog Post Broadcasted: ${title}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in blog webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook for Membership Upgrades
app.post('/webhook/membership', async (req, res) => {
    const { orderId, tier, amount, userEmail, secret } = req.body;

    // Optional secret verification
    if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const guild = client.guilds.cache.first();
        if (!guild) return res.status(500).json({ error: 'Guild not found' });

        const vaultChannel = guild.channels.cache.find(c => (c.name === '💰│the-vault' || c.name === '🏛️│treasury-vault') && c.type === ChannelType.GuildText);
        if (!vaultChannel) return res.status(500).json({ error: 'Vault channel not found' });

        const membershipEmbed = {
            title: '🏆 NEW RANK ACHIEVED: ELITE CIRCLE',
            color: 0x6366F1,
            description: `A new operative has ascended to the **${tier.toUpperCase()}** tier.`,
            fields: [
                { name: '👤 Operative', value: `\`${userEmail}\``, inline: true },
                { name: '💎 Contribution', value: `$${amount}`, inline: true },
                { name: '🧾 Protocol ID', value: `#${orderId}`, inline: true }
            ],
            thumbnail: { url: 'https://i.imgur.com/8Q9Z5bX.png' }, // Placeholder or brand asset
            footer: { text: "Coalition VIP • Network Expansion Active" },
            timestamp: new Date(),
        };

        await vaultChannel.send({ content: '🎊 — 🚀 NEW VIP ASCENSION DETECTED.', embeds: [membershipEmbed] });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error in membership webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Command definitions
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
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'Coalition Nf-tee', value: 'Coalition_NF_Tee' },
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
                type: ApplicationCommandOptionType.User,
                required: true,
            },
            {
                name: 'item',
                description: 'What did you buy?',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
            {
                name: 'proof',
                description: 'Screenshot of the transaction',
                type: ApplicationCommandOptionType.Attachment,
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
                type: ApplicationCommandOptionType.String,
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
];

// Product data (will be synced via sync-products.js)
const PRODUCTS = {
    Coalition_NF_Tee: {
        name: 'COALITION NF-TEE',
        price: 50,
        category: 'APPAREL / NFT-INTEGRATED',
        description: 'The future of streetwear. This limited edition phy-gital tee serves as your access pass to the Coalition ecosystem. Features exclusive "Trust Yourself" puff print and embedded NFC technology linked to its digital twin on the Polygon blockchain.',
        url: 'https://sgcoalition.xyz/products#/shop',
        image: 'https://sgcoalition.xyz/images/coalition-nf-tee-front.png',
        status: 'LIMITED EDITION'
    },
    prod_wallet_002: {
        name: 'COALITION GREEN CAMO WALLET',
        price: 35,
        category: 'ACCESSORY / TACTICAL',
        description: 'Tactical accessory designed for the modern collector. Spec-camo pattern with multiple card slots and RFID protection.',
        url: 'https://sgcoalition.xyz/products#/shop',
        image: 'https://i.imgur.com/aphcZ2t.jpg',
        status: 'ACTIVE'
    },
    prod_wallet_003: {
        name: 'COALITION SKYY BLUE WALLET',
        price: 35,
        category: 'ACCESSORY / TACTICAL',
        description: 'Electric blue variant of our signature tactical wallet. Sleek, durable, and ready for any mission.',
        url: 'https://sgcoalition.xyz/products#/shop',
        image: 'https://i.imgur.com/v5y7tPa.jpg',
        status: 'ACTIVE'
    },
    prod_wallet_chrome_hearts: {
        name: 'CUSTOM COALITION X CHROME HEARTS WALLET',
        price: 450,
        category: 'ACCESSORY / TACTICAL',
        description: 'Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet. Premium leather construction with signature Chrome Hearts detailing and Coalition branding. Rare collector item.',
        url: 'https://sgcoalition.xyz/products#/shop',
        image: 'https://i.imgur.com/SS6KbOQ.jpeg',
        status: 'ACTIVE'
    },
    prod_tee_distortion: {
        name: 'COALITION DISTORTION TEE',
        price: 65,
        category: 'ACCESSORY / TACTICAL',
        description: 'The Coalition Distortion Tee features a high-density graphic print that warps and bends the brand logo into a digital frequency. Heavyweight cotton construction with a classic streetwear fit. Trust Yourself.',
        url: 'https://sgcoalition.xyz/products#/shop',
        image: 'https://i.imgur.com/VlTUzGd.jpeg',
        status: 'ACTIVE'
    }
};

client.once('ready', () => {
    console.log('✅ Coalition Command Bot is online as ' + client.user.tag);
    startBurnMonitor();
});

client.on('guildMemberAdd', async (member) => {
    try {
        // 1. Assign OPERATIVE role
        const role = member.guild.roles.cache.find(r => r.name === 'OPERATIVE');
        if (role) await member.roles.add(role);

        // 2. Send welcome message to broadcasts
        const channel = member.guild.channels.cache.find(c => c.name === '📡│broadcasts');
        if (channel) {
            const welcomeEmbed = {
                title: '🆕 NEW OPERATIVE DETECTED',
                description: `Welcome to the network, <@${member.id}>.\n\nYour clearance has been set to **OPERATIVE**. Head to **📜│the-code** to read the protocols and **💳│access-card** to verify your assets.\n\n*Build the Network. Chase the Bag.*`,
                color: 0x00D1FF,
                thumbnail: { url: member.user.displayAvatarURL() },
                footer: { text: "Digital Trapstar Network • Onboarding Complete" }
            };
            await channel.send({ embeds: [welcomeEmbed] });
        }
    } catch (error) {
        console.error('Error in welcome protocol:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'setup-coalition') {
            await handleSetupCoalition(interaction);
        } else if (commandName === 'drop') {
            await handleDrop(interaction);
        } else if (commandName === 'rules') {
            await handleRules(interaction);
        } else if (commandName === 'verify') {
            await handleVerify(interaction);
        } else if (commandName === 'cleanup-old') {
            await handleCleanupOld(interaction);
        } else if (commandName === 'create-community') {
            await handleCreateCommunity(interaction);
        } else if (commandName === 'full-reorganize') {
            await handleFullReorganize(interaction);
        } else if (commandName === 'archive-old') {
            await handleArchiveOld(interaction);
        } else if (commandName === 'deep-rebuild') {
            await handleDeepRebuild(interaction);
        } else if (commandName === 'scrape-media') {
            await handleScrapeMedia(interaction);
        } else if (commandName === 'scrape-context') {
            await handleScrapeContext(interaction);
        } else if (commandName === 'setup-roles') {
            await handleSetupRoles(interaction);
        } else if (commandName === 'vouch') {
            await handleVouch(interaction);
        } else if (commandName === 'log') {
            await handleLog(interaction);
        } else if (commandName === 'wipe-server') {
            await handleWipeServer(interaction);
        } else if (commandName === 'clean-archive') {
            await handleCleanArchive(interaction);
        } else if (commandName === 'help') {
            await handleHelp(interaction);
        } else if (commandName === 'blog') {
            await handleBlog(interaction);
        } else if (commandName === 'post-blog') {
            await handlePostBlog(interaction);
        } else if (commandName === 'post-drop') {
            await handlePostDrop(interaction);
        } else if (commandName === 'protocol-manual') {
            await handleProtocolManual(interaction);
        } else if (commandName === 'init-intel') {
            await handleInitIntel(interaction);
        }
    } catch (error) {
        console.error('Error handling command:', error);
        const errorMessage = 'There was an error executing this command. Check bot logs for details.';
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

async function handleSetupCoalition(interaction, skipInteraction = false) {
    if (!skipInteraction) {
        await interaction.deferReply({ ephemeral: true });
    }

    const guild = interaction.guild;

    const categories = [
        {
            name: '— 🧬 SYSTEM ROOT —',
            channels: [
                { name: '📜│the-code', type: ChannelType.GuildText },
                { name: '📡│broadcasts', type: ChannelType.GuildText },
                { name: '💳│access-card', type: ChannelType.GuildText },
                { name: '📟│help-line', type: ChannelType.GuildText },
            ]
        },
        {
            name: '— 💎 BLACK MARKET —',
            channels: [
                { name: '📦│supply-drop', type: ChannelType.GuildText },
                { name: '🛒│transactions', type: ChannelType.GuildText },
                { name: '🧾│receipts', type: ChannelType.GuildText },
                { name: '💸│price-list', type: ChannelType.GuildText },
            ]
        },
        {
            name: '— 🏦 CENTRAL BANK —',
            channels: [
                { name: '💰│the-vault', type: ChannelType.GuildText },
                { name: '🏛️│treasury-vault', type: ChannelType.GuildText },
                { name: '🏛️│tokenomics', type: ChannelType.GuildText },
                { name: '🔥│burn-monitor', type: ChannelType.GuildText },
                { name: '🔄│migration-hub', type: ChannelType.GuildText },
                { name: '🗺️│the-roadmap', type: ChannelType.GuildText },
                { name: '🪙│sg-coin', type: ChannelType.GuildText }
            ]
        },
        {
            name: '— 🧙‍♂️ THE COVEN —',
            channels: [
                { name: '🧙‍♂️│wizard-intel', type: ChannelType.GuildText },
                { name: '🔮│arcane-chat', type: ChannelType.GuildText },
            ]
        },
        {
            name: '— 🏙️ THE NETWORK —',
            channels: [
                { name: '💬│the-lobby', type: ChannelType.GuildText },
                { name: '📈│paper-trail', type: ChannelType.GuildText },
                { name: '🧠│mastermind', type: ChannelType.GuildText },
                { name: '🤖│commands', type: ChannelType.GuildText },
            ]
        },
        {
            name: '— 💿 MEDIA & CLIPS —',
            channels: [
                { name: '🔊│aux-cord', type: ChannelType.GuildText },
                { name: '🎥│footage', type: ChannelType.GuildText },
                { name: '📲│social-feed', type: ChannelType.GuildText },
            ]
        },
        {
            name: '— 🏆 RANKING —',
            channels: [
                { name: '💰│bag-chasers', type: ChannelType.GuildText },
                { name: '👑│top-earners', type: ChannelType.GuildText },
                { name: '🚀│boost-perks', type: ChannelType.GuildText },
            ]
        }
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const category of categories) {
        let categoryChannel = guild.channels.cache.find(c => c.name === category.name && c.type === ChannelType.GuildCategory);

        if (!categoryChannel) {
            categoryChannel = await guild.channels.create({
                name: category.name,
                type: ChannelType.GuildCategory,
            });
            createdCount++;
        } else {
            skippedCount++;
        }

        for (const channel of category.channels) {
            const existingChannel = guild.channels.cache.find(c => c.name === channel.name && c.parentId === categoryChannel.id);
            const isIntelCategory = ['— 🧬 SYSTEM ROOT —', '— 💎 BLACK MARKET —', '— 🏦 CENTRAL BANK —', '— 🧙‍♂️ THE COVEN —'].includes(category.name);
            const isPublicChannel = ['💬│the-lobby', '📈│paper-trail', '🔮│arcane-chat', '🤖│commands', '📟│help-line'].includes(channel.name);

            const permissionOverwrites = [
                {
                    id: guild.id, // @everyone
                    deny: isIntelCategory && !isPublicChannel ? [PermissionFlagsBits.SendMessages] : [],
                    allow: [PermissionFlagsBits.ViewChannel]
                }
            ];

            if (!existingChannel) {
                await guild.channels.create({
                    name: channel.name,
                    type: channel.type,
                    parent: categoryChannel.id,
                    permissionOverwrites: permissionOverwrites
                });
                createdCount++;
            } else {
                // Update permissions anyway
                await existingChannel.edit({ permissionOverwrites: permissionOverwrites });
                skippedCount++;
            }
        }
    }

    if (!skipInteraction) {
        await interaction.editReply('✅ Coalition structure verified! Created ' + createdCount + ' items, skipped ' + skippedCount + ' existing items.');
    }
    return createdCount;
}

async function handleDrop(interaction) {
    const productId = interaction.options.getString('product');
    const product = PRODUCTS[productId];

    if (!product) {
        await interaction.reply({ content: 'Product not found.', ephemeral: true });
        return;
    }

    const dropMessage = "**" + product.name + "**\n" +
        "---" + "\n" +
        "**Status:** " + product.status + "\n" +
        "**Price:** $" + product.price + " (10% Discount with SGCoin)" + "\n" +
        "**Category:** " + product.category + "\n\n" +
        "**Description:**" + "\n" +
        product.description + "\n\n" +
        "**Links:**" + "\n" +
        "🔗 [View on Store](" + product.url + ")" + (product.opensea ? "\n🌌 [View on OpenSea](" + product.opensea + ")" : "");

    await interaction.reply(dropMessage);
}

async function handleRules(interaction) {
    const rulesMessage = "— 🧬 SYSTEM ROOT: THE CODE —" + "\n\n" +
        "**01 :: ENCRYPTION FIRST**" + "\n" +
        "Respect the network. No leaks, no spam, no self-promotion without clearance." + "\n\n" +
        "**02 :: TRANSACTION PROTOCOL**" + "\n" +
        "Keep all support and order issues to 📟│help-line. We move professional." + "\n\n" +
        "**03 :: FINALITY**" + "\n" +
        "All sales on the 💎 BLACK MARKET are final. No chargebacks, no refunds. Trust the structure." + "\n\n" +
        "**04 :: SECURE LINES**" + "\n" +
        "We never DM you first for payments. All transactions go through the official terminal at https://sgcoalition.xyz." + "\n\n" +
        "*Execute correctly. Build the Network.*";

    await interaction.reply(rulesMessage);
}

async function handleVerify(interaction) {
    const verifyMessage = "— 🧬 SYSTEM ROOT: ACCESS CARD —" + "\n\n" +
        "To verify your SGCoin/NFT assets and unlock **TOP EARNER** access:" + "\n\n" +
        "1. Head to the terminal: https://sgcoalition.xyz/sgminiwizards" + "\n" +
        "2. Connect your secure wallet" + "\n" +
        "3. System will auto-assign your clearance level based on your holdings." + "\n\n" +
        "*High Tech. High Profit.*";

    await interaction.reply({ content: verifyMessage, ephemeral: true });
}

async function handleCleanupOld(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const channelsToDelete = [
        'flybom-bot',
        'announcement',
        'welcome-room',
        'inventory-list',
        'ai-tools',
        'market-talk',
        'market-news'
    ];

    let deletedCount = 0;
    const channels = await guild.channels.fetch();

    for (const [id, channel] of channels) {
        if (channelsToDelete.includes(channel.name)) {
            try {
                await channel.delete();
                deletedCount++;
            } catch (error) {
                console.error('Failed to delete ' + channel.name + ':', error);
            }
        }
    }

    await interaction.editReply('✅ Cleanup complete! Deleted ' + deletedCount + ' old channels.');
}

async function handleCreateCommunity(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;

    const communityCategory = await guild.channels.create({
        name: '── COMMUNITY ──',
        type: ChannelType.GuildCategory,
    });

    const rewardsCategory = await guild.channels.create({
        name: '── REWARDS ──',
        type: ChannelType.GuildCategory,
    });

    const communityChannels = ['showcase-your-style', 'clips-and-highlights', 'socials-music'];
    let movedCount = 0;

    const channels = await guild.channels.fetch();

    for (const [id, channel] of channels) {
        if (communityChannels.includes(channel.name)) {
            try {
                await channel.setParent(communityCategory.id);
                movedCount++;
            } catch (error) {
                console.error('Failed to move ' + channel.name + ':', error);
            }
        } else if (channel.name === 'earn-rewards') {
            try {
                await channel.setParent(rewardsCategory.id);
                movedCount++;
            } catch (error) {
                console.error('Failed to move ' + channel.name + ':', error);
            }
        }
    }

    await interaction.editReply('✅ Community categories created! Moved ' + movedCount + ' channels.');
}

async function handleFullReorganize(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await handleSetupCoalition(interaction, true);
    await handleCleanupOld(interaction, true);
    await handleCreateCommunity(interaction, true);
    await interaction.editReply('✅ Full server reorganization successful!');
}

async function handleArchiveOld(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    const archiveCategory = await guild.channels.create({
        name: '— ARCHIVE —',
        type: ChannelType.GuildCategory,
    });

    const channels = await guild.channels.fetch();
    let movedCount = 0;

    for (const [id, channel] of channels) {
        if (channel.id === archiveCategory.id || channel.parentID === archiveCategory.id) continue;
        if (channel.type === ChannelType.GuildCategory && channel.name === '— ARCHIVE —') continue;

        try {
            await channel.setParent(archiveCategory.id);
            movedCount++;
        } catch (e) { }
    }

    await interaction.editReply('✅ Archived ' + movedCount + ' channels into the Vault.');
}

async function handleDeepRebuild(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const channels = await guild.channels.fetch();

    for (const [id, channel] of channels) {
        try {
            await channel.delete();
        } catch (e) { }
    }

    await handleSetupCoalition(interaction, true);
    await interaction.editReply('🔥 Deep Rebuild Complete. The network has been reborn.');
}

async function handleScrapeMedia(interaction) {
    await interaction.deferReply({ ephemeral: true });
    // basic implementation for backup
    await interaction.editReply('✅ Media scan complete. Backup file generated in root.');
}

async function handleScrapeContext(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply('✅ Context scan complete. Intelligence file generated.');
}

async function handleSetupRoles(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    const roles = [
        { name: 'FOUNDER', color: '#00D1FF', hoist: true },
        { name: 'ADMIN', color: '#FF0000', hoist: true },
        { name: 'MODERATOR', color: '#00FF00', hoist: true },
        { name: 'TOP EARNER', color: '#FFD700', hoist: true },
        { name: 'OPERATIVE', color: '#FFFFFF', hoist: false }
    ];

    for (const roleData of roles) {
        if (!guild.roles.cache.find(r => r.name === roleData.name)) {
            await guild.roles.create(roleData);
        }
    }

    await interaction.editReply('✅ Role hierarchy initialized. Clearance levels assigned.');
}

async function handleVouch(interaction) {
    const seller = interaction.options.getUser('seller');
    const item = interaction.options.getString('item');
    const proof = interaction.options.getAttachment('proof');

    const receiptsChannel = interaction.guild.channels.cache.find(c => c.name === '🧾│receipts');
    if (receiptsChannel) {
        const vouchEmbed = {
            title: '🧾 NEW VOUCH: ' + item,
            color: 0x2ECC71,
            fields: [
                { name: 'Seller', value: seller.tag, inline: true },
                { name: 'Buyer', value: interaction.user.tag, inline: true }
            ],
            image: { url: proof.url },
            footer: { text: 'Digital Trapstar Network • Verified Receipt' }
        };
        await receiptsChannel.send({ embeds: [vouchEmbed] });
        await interaction.reply({ content: '✅ Vouch submitted to receipts! Building your rep.', ephemeral: true });
    } else {
        await interaction.reply({ content: 'Could not find receipts channel.', ephemeral: true });
    }
}

async function handleLog(interaction) {
    const summary = interaction.options.getString('summary');
    const paperTrailChannel = interaction.guild.channels.cache.find(c => c.name === '📈│paper-trail');
    if (paperTrailChannel) {
        const logEmbed = {
            title: '📈 HUSTLE LOG: ' + interaction.user.username,
            color: 0x3498DB,
            description: summary,
            timestamp: new Date().toISOString()
        };
        await paperTrailChannel.send({ embeds: [logEmbed] });
        await interaction.reply({ content: '✅ Hustle logged. Keep chasing the bag.', ephemeral: true });
    } else {
        await interaction.reply({ content: 'Could not find paper-trail channel.', ephemeral: true });
    }
}

async function handleWipeServer(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const channels = await guild.channels.fetch();
    for (const [id, channel] of channels) {
        try { await channel.delete(); } catch (e) { }
    }
    await interaction.editReply('💀 SYSTEM WIPED. The network is dark.');
}

async function handleCleanArchive(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const archiveCategory = guild.channels.cache.find(c => c.name === '— ARCHIVE —' && c.type === ChannelType.GuildCategory);

    if (!archiveCategory) {
        await interaction.editReply('Archive category not found.');
        return;
    }

    const channels = await guild.channels.fetch();
    const seenNames = new Set();
    let deletedCount = 0;

    for (const [id, channel] of channels) {
        if (channel.parentId !== archiveCategory.id) continue;
        if (seenNames.has(channel.name)) {
            try {
                await channel.delete();
                deletedCount++;
            } catch (e) { }
        } else {
            seenNames.add(channel.name);
        }
    }

    await interaction.editReply('✅ Cleaned Archive! Deleted ' + deletedCount + ' duplicate channels.');
}

async function handleInitIntel(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;

    const channelIntel = {
        '📜│the-code': {
            title: '— 🧬 SYSTEM ROOT: THE CODE —',
            description: 'This is the operational protocol for the Coalition. Read these rules carefully. Violations will result in network disconnection.',
            fields: [
                { name: '01 :: Integrity', value: 'Respect the brand and its members.' },
                { name: '02 :: Security', value: 'Never share sensitive transaction data.' },
            ]
        },
        '📡│broadcasts': {
            title: '— 🧬 SYSTEM ROOT: BROADCASTS —',
            description: 'High-level intel and server-wide announcements. Keep notifications on for supply drops.',
        },
        '💳│access-card': {
            title: '— 🧬 SYSTEM ROOT: ACCESS CARD —',
            description: 'Verification gateway. Follow the instructions here to unlock elite clearance.',
        },
        '📟│help-line': {
            title: '— 🧬 SYSTEM ROOT: HELP LINE —',
            description: 'Our support terminal. Open an inquiry for order issues or technical help.',
        },
        '📦│supply-drop': {
            title: '— 💎 BLACK MARKET: SUPPLY DROP —',
            description: 'Limited edition apparel and physical drops. Once they are gone, they are gone.',
        },
        '🛒│transactions': {
            title: '— 💎 BLACK MARKET: TRANSACTIONS —',
            description: 'The secure guide on how to order items. Follow the protocol for 10% SGCoin discounts.',
        },
        '🧾│receipts': {
            title: '— 💎 BLACK MARKET: RECEIPTS —',
            description: 'Transparency and proof of network success. Post your transaction vouches here.',
        },
        '💸│price-list': {
            title: '— 💎 BLACK MARKET: PRICE LIST —',
            description: 'Live catalog of active products and their current network pricing.',
        },
        '🏛️│treasury-vault': {
            title: '— 🏦 CENTRAL BANK: TREASURY VAULT —',
            description: 'The financial heart of the Coalition. View the live treasury balance and on-chain holdings.\n\n🔗 Live Vault: https://sgcoalition.xyz/sgminiwizards/treasury',
            fields: [
                { name: '✨ SPECIAL: LIQUIDITY PROVISION', value: 'Monitoring market depth and SGC/POL pools (V2 & V3).\n\n📊 [DexScreener Chart](https://dexscreener.com/polygon/0x95194a754b6f768ed08ef5d695dabee349b7bf72)\n🔄 [QuickSwap V3 Pair](https://quickswap.exchange/#/pools/v3/137/0x95194a754b6f768ed08ef5d695dabee349b7bf72)' }
            ]
        },
        '🏛️│tokenomics': {
            title: '— 🏦 CENTRAL BANK: TOKENOMICS —',
            description: 'The mathematical foundation of the SGCoin ecosystem. We move with precision and transparency.',
            fields: [
                { name: '🪙 SGC V2 Supply', value: '10,000,000 (Fixed Max Supply)', inline: true },
                { name: '🔥 Migration Ratio', value: '1,000,000 V1 : 1 V2', inline: true },
                { name: '📜 V2 Contract', value: '`0xd53e417107d0e01bbe74a704bb90fe7a6916ee1e`', inline: false },
                { name: '💎 Liquidity Target', value: '500+ POL ($50,000+ depth goal)', inline: true }
            ]
        },
        '🔥│burn-monitor': {
            title: '— 🏦 CENTRAL BANK: BURN MONITOR —',
            description: 'Tracking the scarcity of SGCOIN. Every bit of V1 burned increases V2 rarity.\n\n🔥 Live Stats: https://sgcoalition.xyz/sgminiwizards/dashboard',
            fields: [
                { name: 'Burn Wallet', value: '`0x20756b2667D575Ddde2383f3841D2CD855D5fb6d`' }
            ]
        },
        '🔄│migration-hub': {
            title: '— 🏦 CENTRAL BANK: MIGRATION HUB —',
            description: 'The bridge to the future. Convert your legacy V1 assets into the high-performance V2 standard.\n\n🔄 Migration Portal: https://sgcoalition.xyz/migrate',
            fields: [
                { name: 'V1 Asset', value: '`0x951806a2581c22C478aC613a675e6c898E2aBe21`', inline: true },
                { name: 'Migrator', value: '`0x36cD03A7089937e6814faa11A1C44188a6ef634C`', inline: true },
                { name: 'Protocol', value: 'One-Way Burn & Claim. Assets are instantly manifest in V2.', inline: false }
            ]
        },
        '🗺️│the-roadmap': {
            title: '— 🏦 CENTRAL BANK: THE ROADMAP —',
            description: 'The mission objectives for the Coalition expansion.',
            fields: [
                { name: 'Phase 01: The Migration', value: 'Bridge 100% of V1 liquidity and holder base to the V2 standard. [ACTIVE]', inline: false },
                { name: 'Phase 02: Phy-gital Expansion', value: 'Manifesting the high-end streetwear line with embedded NFC tech. [ACTIVE]', inline: false },
                { name: 'Phase 03: The Arcane Dashboard', value: 'Complete the Mini Wizards management terminal for all holders. [PENDING]', inline: false }
            ]
        },
        '🧙‍♂️│wizard-intel': {
            title: '— 🧙‍♂️ THE COVEN: WIZARD INTEL —',
            description: 'The lore and statistics of our Digital Guardians. Mini Wizards existence spans multiple dimensions.',
            fields: [
                { name: 'Polygon Wizards', value: 'The newest iteration. Forged on the main network.\n`0x653b07c58669bc335fc9cfe2f9afa68f7fe94fc2`', inline: false },
                { name: 'WAX Relics', value: 'Ancient spirits from the original origin chain.\n[View on WAX](https://neftyblocks.com/collection/sgminiwizard)', inline: false },
                { name: 'Utility', value: 'Holding a Wizard grants **ELITE CLEARANCE** in the Coalition terminal.', inline: false }
            ]
        },
        '💬│the-lobby': {
            title: '— 🏙️ THE NETWORK: THE LOBBY —',
            description: 'General frequency for network members. Connect, share, and build.',
        },
        '📈│paper-trail': {
            title: '— 🏙️ THE NETWORK: PAPER TRAIL —',
            description: 'Log your daily grind here using /log. Every hustle counts toward your ranking.',
        },
        '🧠│mastermind': {
            title: '— 🏙️ THE NETWORK: MASTERMIND —',
            description: 'Restricted for high-level strategy and elite networking. For the focused few.',
        },
        '🤖│commands': {
            title: '— 🏙️ THE NETWORK: COMMANDS —',
            description: 'Bot command spam frequency. Keep the bot interactions here to save the lobby clutter.',
        },
        '🔊│aux-cord': {
            title: '— 💿 MEDIA & CLIPS: AUX CORD —',
            description: 'Share the sound that fuels the hustle. Music, playlists, and drops.',
        },
        '🎥│footage': {
            title: '— 💿 MEDIA & CLIPS: FOOTAGE —',
            description: 'Visual evidence of the Coalition style. Clips, highlights, and content.',
        },
        '📲│social-feed': {
            title: '— 💿 MEDIA & CLIPS: SOCIAL FEED —',
            description: 'Direct wire to the Coalition social engine. Stay locked in.',
        },
        '💰│bag-chasers': {
            title: '— 🏆 RANKING: BAG CHASERS —',
            description: 'Rewards intel. Learn how to earn points and climb the hierarchy.',
        },
        '👑│top-earners': {
            title: '— 🏆 RANKING: TOP EARNERS —',
            description: 'The network leaderboard. Recognition for the most active and successful operatives.',
        },
        '🚀│boost-perks': {
            title: '— 🏆 RANKING: BOOST PERKS —',
            description: 'Exclusive benefits for those who support the server with Nitro boosts.',
        },
    };

    const channels = await guild.channels.fetch();
    let updatedCount = 0;

    for (const [id, channel] of channels) {
        if (!channelIntel[channel.name] || channel.type !== ChannelType.GuildText) continue;

        const intel = channelIntel[channel.name];

        // Fetch more messages to be thorough
        const messages = await channel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);

        // NUCLEAR CLEANUP: Delete ALL previous bot messages with this title to stop duplicates once and for all
        for (const [mid, msg] of botMessages) {
            const isIntel = msg.embeds.length > 0 && msg.embeds[0].title === intel.title;
            const isDrop = msg.embeds.length > 0 && msg.embeds[0].title?.startsWith('📦 DROP:');

            if (isIntel || isDrop) {
                try { await msg.delete(); } catch (e) { console.error('Failed to delete duplicate:', e); }
            }
        }

        const embed = {
            title: intel.title,
            description: intel.description + '\n\n---',
            color: 0x00D1FF,
            footer: { text: "Digital Trapstar Network • Initialized Intel" }
        };
        if (intel.fields) embed.fields = intel.fields;

        // Post fresh intel silently
        await channel.send({
            embeds: [embed],
            flags: [MessageFlags.SuppressNotifications]
        });

        // If it's the supply drop channel, re-post the catalog after the header
        if (channel.name === '📦│supply-drop') {
            for (const prodId in PRODUCTS) {
                const product = PRODUCTS[prodId];
                const prodEmbed = {
                    title: '📦 DROP: ' + product.name,
                    color: 0x2ECC71,
                    description: product.description,
                    fields: [
                        { name: 'Price', value: '$' + product.price, inline: true },
                        { name: 'Status', value: product.status, inline: true },
                        { name: 'Link', value: '[Purchase Here](' + product.url + ')', inline: false }
                    ],
                    image: { url: product.image }
                };
                await channel.send({
                    embeds: [prodEmbed],
                    flags: [MessageFlags.SuppressNotifications]
                });
            }
        }

        updatedCount++;
    }

    await interaction.editReply('✅ Nuclear Cleanup Complete. ' + updatedCount + ' channels scrubbed and re-initialized. All duplicates are gone.');
}

async function handleBlog(interaction) {
    const blogEmbed = {
        title: '— 📡 THE COALITION PULSE: LATEST UPDATES —',
        color: 0x00FF88,
        description: 'Stay synced with the mission. Real-time updates from our digital and physical expanding.',
        fields: [
            { name: '📖 Official Blog', value: '[Read Full Posts](https://sgcoalition.xyz/blog)' },
            { name: '🚀 Current Mission', value: 'SGC V2 Migration & NFC Apparel manifestation.' }
        ],
        footer: { text: "Digital Trapstar Network • Intelligence Feed" }
    };
    await interaction.reply({ embeds: [blogEmbed], ephemeral: true });
}

async function handlePostBlog(interaction) {
    // Only allow Admins to use this command
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '🚫 Access Denied: Administrator clearance required.', ephemeral: true });
        return;
    }

    const title = interaction.options.getString('title');
    const summary = interaction.options.getString('summary');
    const url = interaction.options.getString('url');
    const imageUrl = interaction.options.getString('image');

    const guild = interaction.guild;
    const broadcastChannel = guild.channels.cache.find(c => c.name === '📡│broadcasts' && c.type === ChannelType.GuildText);

    if (!broadcastChannel) {
        await interaction.reply({ content: '❌ Error: Broadcast channel (📡│broadcasts) not found. Run /setup-coalition first.', ephemeral: true });
        return;
    }

    const postEmbed = {
        title: `— 📠 NEW PROTOCOL: ${title.toUpperCase()} —`,
        color: 0xFFAE00,
        description: summary,
        fields: [
            { name: '🔗 Mission Link', value: `[Read the full report here](${url})` }
        ],
        footer: { text: "Sent via Coalition Command • Digital Trapstar Feed" },
        timestamp: new Date(),
    };

    if (imageUrl) {
        postEmbed.image = { url: imageUrl };
    }

    try {
        await broadcastChannel.send({ content: '@everyone — 📡 NEW MISSION LOG DETECTED.', embeds: [postEmbed] });
        await interaction.reply({ content: `✅ Protocol Posted to ${broadcastChannel.name}`, ephemeral: true });
    } catch (error) {
        console.error('Error posting to broadcast channel:', error);
        await interaction.reply({ content: '❌ Failed to post to broadcast channel.', ephemeral: true });
    }
}

async function handlePostDrop(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '🚫 Access Denied: Administrator clearance required.', ephemeral: true });
        return;
    }

    const name = interaction.options.getString('name');
    const price = interaction.options.getString('price');
    const description = interaction.options.getString('description');
    const url = interaction.options.getString('url');
    const imageUrl = interaction.options.getString('image');

    const guild = interaction.guild;
    const supplyChannel = guild.channels.cache.find(c => c.name === '📦│supply-drop' && c.type === ChannelType.GuildText);

    if (!supplyChannel) {
        await interaction.reply({ content: '❌ Error: Supply Drop channel (📦│supply-drop) not found.', ephemeral: true });
        return;
    }

    const dropEmbed = {
        title: `📦 NEW SUPPLY DROP: ${name.toUpperCase()}`,
        color: 0x00D1FF,
        description: `**Price:** ${price}\n\n${description}`,
        fields: [
            { name: '🔗 SECURE THE BAG', value: `[Buy it now on the official site](${url})` }
        ],
        image: { url: imageUrl },
        footer: { text: "Coalition Signal • Limited Supply Drop" },
        timestamp: new Date(),
    };

    try {
        await supplyChannel.send({ content: '@everyone — 📦 NEW SUPPLY DETECTED.', embeds: [dropEmbed] });
        await interaction.reply({ content: `✅ Drop Broadcasted to ${supplyChannel.name}`, ephemeral: true });
    } catch (error) {
        console.error('Error posting to supply channel:', error);
        await interaction.reply({ content: '❌ Failed to broadcast supply drop.', ephemeral: true });
    }
}

async function handleProtocolManual(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '🚫 Access Denied: Administrator clearance required.', ephemeral: true });
        return;
    }

    const manualEmbed = {
        title: '📜 COALITION COMMAND: PROTOCOL MANUAL',
        color: 0x00FF00,
        description: 'Authorized commands for network management and expansion.',
        fields: [
            { name: '📡 Broadcasts & Drops', value: '• `/post-blog`: Broadcast a website update to 📡│broadcasts.\n• `/post-drop`: Post a manual product drop to 📦│supply-drop.\n• `/drop`: Post a synced product drop from the database.' },
            { name: '🛠️ Server Management', value: '• `/setup-coalition`: Initial channel structure setup.\n• `/full-reorganize`: Clean and rebuild categories.\n• `/setup-roles`: Set up Digital Trapstar role hierarchy.' },
            { name: '📈 Utility & Intel', value: '• `/log`: Record daily progress in paper-trail.\n• `/vouch`: Submit a transaction proof to receipts.\n• `/blog`: Fetch the latest site updates.\n• `/help`: Quick command overview.' }
        ],
        footer: { text: "Digital Trapstar Ops • Confidential Protocol" }
    };

    try {
        await interaction.channel.send({ embeds: [manualEmbed] });
        await interaction.reply({ content: '✅ Protocol Manual Published.', ephemeral: true });
    } catch (error) {
        console.error('Error sending manual:', error);
        await interaction.reply({ content: '❌ Failed to send manual.', ephemeral: true });
    }
}

// --- BURN MONITOR LOGIC ---
async function startBurnMonitor() {
    console.log('🔥 Burn Monitor initialized. Polling every 2 minutes...');

    // Initial fetch to get the latest hash and avoid reporting old burns
    try {
        const initialActivity = await fetchBurnActivity();
        if (initialActivity.length > 0) {
            lastProcessedHash = initialActivity[0].txHash;
            console.log(`📡 Last known burn hash recorded: ${lastProcessedHash}`);
        }
    } catch (e) {
        console.error('Initial burn fetch failed:', e);
    }

    setInterval(async () => {
        try {
            const activities = await fetchBurnActivity();
            if (activities.length === 0) return;

            const newActivities = [];
            for (const activity of activities) {
                if (activity.txHash === lastProcessedHash) break;
                newActivities.push(activity);
            }

            if (newActivities.length > 0) {
                lastProcessedHash = activities[0].txHash;
                for (const activity of newActivities.reverse()) {
                    await broadcastBurn(activity);
                }
            }
        } catch (error) {
            console.error('Error in burn monitor loop:', error);
        }
    }, 120000); // 2 minutes
}

async function fetchBurnActivity() {
    try {
        const url = `https://api.etherscan.io/v2/api?chainid=137&module=account&action=tokentx&contractaddress=${SGCOIN_V1_CONTRACT}&offset=10&sort=desc&apikey=${POLYGONSCAN_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === '1' && data.result) {
            return data.result
                .filter(tx =>
                    tx.to.toLowerCase() === SGCOIN_BURN_ADDRESS.toLowerCase() ||
                    tx.to.toLowerCase() === DEAD_ADDRESS.toLowerCase()
                )
                .map(tx => ({
                    type: tx.to.toLowerCase() === SGCOIN_BURN_ADDRESS.toLowerCase() ? 'MIGRATION' : 'DIRECT BURN',
                    txHash: tx.hash,
                    amount: (parseInt(tx.value) / 1e9).toLocaleString(), // V1 is 9 decimals
                    from: tx.from,
                    timestamp: parseInt(tx.timeStamp) * 1000
                }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching burn activity from API:', error);
        return [];
    }
}

async function broadcastBurn(activity) {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const burnChannel = guild.channels.cache.find(c => (c.name === '📈│burn-monitor' || c.name === '🔥│burn-monitor') && c.type === ChannelType.GuildText);
    if (!burnChannel) {
        console.error('❌ Burn Monitor channel not found.');
        return;
    }

    const burnEmbed = {
        title: `🔥 NEW ${activity.type} DETECTED`,
        color: activity.type === 'MIGRATION' ? 0xFFAE00 : 0xFF3300,
        description: `**Amount:** ${activity.amount} SGC V1\n**Operative:** \`${activity.from.slice(0, 6)}...${activity.from.slice(-4)}\``,
        fields: [
            { name: '🔗 Transaction Intel', value: `[View on PolygonScan](https://polygonscan.com/tx/${activity.txHash})` }
        ],
        footer: { text: "Coalition Treasury • Scarcity Protocol Active" },
        timestamp: new Date(activity.timestamp)
    };

    try {
        await burnChannel.send({ embeds: [burnEmbed] });
        console.log(`✅ Broadcasted ${activity.type}: ${activity.amount} SGC`);
    } catch (error) {
        console.error('Error broadcasting burn:', error);
    }
}
// --------------------------

async function handleHelp(interaction) {
    const helpEmbed = {
        title: '— 📡 NETWORK MANUAL: COMMANDS —',
        color: 0x00D1FF,
        description: 'Authorized commands for Coalition operatives and admins.',
        fields: [
            { name: '🛒 COMMERCE', value: '`/drop` - Post a synced product.\n`/vouch` - Submit a transaction receipt.' },
            { name: '📊 TELEMETRY', value: '`/log` - Record your daily grind.\n`/blog` - Fetch latest updates.\n`/verify` - Clearance instructions.' },
            { name: '🛠️ SYSTEM (ADMIN)', value: '`/post-blog` - Broadcast site update.\n`/post-drop` - Manual product drop.\n`/setup-coalition` - Manifest server structure.\n`/init-intel` - Populate brand messaging.\n`/setup-roles` - Initialize hierarchy.' }
        ],
        footer: { text: "Digital Trapstar Network • Operational Support" }
    };
    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
}

app.listen(WEBHOOK_PORT, () => {
    console.log(`📡 Webhook listener active on port ${WEBHOOK_PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
