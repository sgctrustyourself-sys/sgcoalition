const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Import Git service functions
const gitService = require('./services/gitService.cjs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Git operations endpoint
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase for sync operations
const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

// Git operations endpoint
app.all('/api/git-operations', async (req, res) => {
    try {
        // Check if Git repository exists
        const isRepo = await gitService.isGitRepository();
        if (!isRepo) {
            return res.status(500).json({ error: 'Git repository not initialized' });
        }

        const { action } = req.query;

        switch (action) {
            case 'upload-imgur': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { image, title, description } = req.body;
                if (!image) {
                    return res.status(400).json({ error: 'Image data is required' });
                }

                const clientId = process.env.IMGUR_CLIENT_ID;
                if (!clientId) {
                    return res.status(500).json({ error: 'Imgur Client ID not configured in server environment' });
                }

                console.log('🖼️ Uploading image to Imgur...');

                // Imgur API expects base64 without the prefix
                const base64Data = image.split(',')[1] || image;

                const response = await fetch('https://api.imgur.com/3/image', {
                    method: 'POST',
                    headers: {
                        Authorization: `Client-ID ${clientId}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        image: base64Data,
                        type: 'base64',
                        title: title || 'Coalition Drop',
                        description: description || 'Uploaded via Admin Dashboard'
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.data?.error || 'Imgur upload failed');
                }

                const data = await response.json();
                console.log('✅ Imgur Upload Success:', data.data.link);
                return res.status(200).json({ success: true, url: data.data.link });
            }

            case 'sync-constants': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                console.log('🔄 Syncing Supabase products to constants.ts...');

                const { data: products, error } = await supabase.from('products').select('*');
                if (error) throw error;

                if (!products) {
                    return res.status(404).json({ error: 'No products found in database' });
                }

                const formattedProducts = products.map(p => {
                    const product = {
                        id: p.id,
                        name: p.name,
                        price: p.price,
                        images: p.images,
                        description: p.description,
                        category: p.category,
                        isFeatured: !!p.is_featured,
                        sizes: p.sizes || ['S', 'M', 'L', 'XL'],
                        sizeInventory: p.size_inventory || {},
                        archived: !!p.archived
                    };

                    if (p.nft) product.nft = p.nft;
                    if (p.is_limited_edition) product.isLimitedEdition = !!p.is_limited_edition;

                    return product;
                });

                const productsJs = JSON.stringify(formattedProducts, null, 2);

                const CONSTANTS_PATH = path.join(__dirname, 'constants.ts');
                // Read current constants.ts
                let content = fs.readFileSync(CONSTANTS_PATH, 'utf8');

                // Replace INITIAL_PRODUCTS array
                const startMarker = 'export const INITIAL_PRODUCTS: Product[] = [';
                const endMarker = '];';

                const startIndex = content.indexOf(startMarker);
                if (startIndex === -1) {
                    throw new Error('Could not find INITIAL_PRODUCTS in constants.ts');
                }

                const contentAfterStart = content.substring(startIndex + startMarker.length - 1); // Start from [
                const endIndexWithinRemaining = contentAfterStart.indexOf(endMarker);

                if (endIndexWithinRemaining === -1) {
                    throw new Error('Could not find end of INITIAL_PRODUCTS array');
                }

                const fullEndIndex = startIndex + startMarker.length - 1 + endIndexWithinRemaining + endMarker.length;

                const newContent = content.substring(0, startIndex) +
                    `export const INITIAL_PRODUCTS: Product[] = ${productsJs};` +
                    content.substring(fullEndIndex);

                fs.writeFileSync(CONSTANTS_PATH, newContent);
                console.log('✅ constants.ts updated with DB data');

                // Auto-commit the sync (optional)
                let hash = 'local-only';
                const isRepo = await gitService.isGitRepository();
                if (isRepo) {
                    hash = await gitService.createCommit('chore: Sync constants.ts with database products', 'Coalition Admin <admin@coalition.local>');
                } else {
                    console.log('ℹ️ Not a Git repository, skipped commit.');
                }

                return res.status(200).json({ success: true, hash });
            }

            case 'commit': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { message, author } = req.body;
                if (!message) {
                    return res.status(400).json({ error: 'Commit message is required' });
                }

                const hash = await gitService.createCommit(message, author);
                return res.status(200).json({ success: true, hash });
            }

            case 'log': {
                const limit = parseInt(req.query.limit) || 50;
                const commits = await gitService.getCommitHistory(limit);
                return res.status(200).json({ commits });
            }

            case 'branches': {
                const branches = await gitService.getBranches();
                const currentBranch = await gitService.getCurrentBranch();
                return res.status(200).json({ branches, currentBranch });
            }

            case 'checkout': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { branch } = req.body;
                if (!branch) {
                    return res.status(400).json({ error: 'Branch name is required' });
                }

                await gitService.switchBranch(branch);
                return res.status(200).json({ success: true, branch });
            }

            case 'reset': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { commitHash, hard } = req.body;
                if (!commitHash) {
                    return res.status(400).json({ error: 'Commit hash is required' });
                }

                await gitService.resetToCommit(commitHash, hard || false);
                return res.status(200).json({ success: true, commitHash });
            }

            case 'diff': {
                const { commitHash } = req.query;
                if (!commitHash) {
                    return res.status(400).json({ error: 'Commit hash is required' });
                }

                const diff = await gitService.getCommitDiff(commitHash);
                return res.status(200).json({ diff });
            }

            case 'status': {
                const status = await gitService.getStatus();
                const currentBranch = await gitService.getCurrentBranch();
                return res.status(200).json({ status, currentBranch });
            }

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Git operation error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Git API server is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Git API server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api/git-operations`);
});
