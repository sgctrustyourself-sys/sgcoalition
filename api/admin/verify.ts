import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-prod';
const ADMIN_PASSWORDS = (process.env.ADMIN_PASSWORDS || 'admin123,founder2024').split(',');

export default async function handler(req: any, res: any) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    const isValid = ADMIN_PASSWORDS.some(p => p.trim() === password.trim());

    if (isValid) {
        // Generate a token valid for 24 hours
        const token = jwt.sign(
            { role: 'admin', timestamp: Date.now() },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            success: true,
            token,
            message: 'Access granted'
        });
    }

    // Delay response on failure to prevent brute forcing
    await new Promise(resolve => setTimeout(resolve, 1500));
    return res.status(401).json({ error: 'Invalid passphrase' });
}
