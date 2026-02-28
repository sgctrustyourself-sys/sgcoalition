import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = 4242;

app.use(cors());
app.use(express.json());

// Mock Vercel response object
function mockRes(res) {
    res.setHeader = (name, value) => res.set(name, value);
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    // res.json and res.end are handled by express already
    return res;
}

// Admin Verify Handler (mirrored from api/admin/verify.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'coalition-brand-super-secret-key-2025';
const ADMIN_PASSWORDS = (process.env.ADMIN_PASSWORDS || 'admin123,founder2024').split(',');

app.post('/api/admin/verify', async (req, res) => {
    console.log('🔐 [DevServer] POST /api/admin/verify');
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const isValid = ADMIN_PASSWORDS.some(p => p.trim() === password.trim());
    if (isValid) {
        const token = jwt.sign({ role: 'admin', timestamp: Date.now() }, JWT_SECRET, { expiresIn: '24h' });
        return res.status(200).json({ success: true, token, message: 'Access granted' });
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    return res.status(401).json({ error: 'Invalid passphrase' });
});

// Complete Order Handler (simplified mirror from api/complete-order.ts)
app.all('/api/complete-order', async (req, res) => {
    console.log(`📦 [DevServer] ${req.method} /api/complete-order`);

    // Auth Check
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    let isAdmin = false;
    try {
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            isAdmin = decoded && decoded.role === 'admin';
        }
    } catch (e) { }

    if (req.method === 'GET') {
        if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
        const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
        if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
        const { id, updates } = req.body;
        const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
        const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, data });
    }

    res.status(405).json({ error: 'Method not allowed' });
});

app.listen(PORT, () => {
    console.log(`🚀 Dev API Server running on http://localhost:${PORT}`);
    console.log(`🔑 Admin Password: ${ADMIN_PASSWORDS[ADMIN_PASSWORDS.length - 1]}`);
});
