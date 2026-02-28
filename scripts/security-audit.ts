import axios from 'axios';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const API_URL = 'http://localhost:5173/api'; // Or the production URL for final check
const PROD_URL = 'https://sgcoalition.xyz/api';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-prod';

async function runAudit() {
    console.log('🛡️ Starting Security Audit...');

    const targets = [PROD_URL]; // Test against production if deployed, or local if running dev

    for (const url of targets) {
        console.log(`\n--- Testing Target: ${url} ---`);

        // 1. Test Unauthorized Access (No Token)
        try {
            console.log('Test 1: Accessing /complete-order without token...');
            const res = await axios.get(`${url}/complete-order`);
            console.log('❌ FAIL: Access granted without token!');
        } catch (err: any) {
            if (err.response?.status === 401) {
                console.log('✅ PASS: Access denied (401)');
            } else {
                console.log(`⚠️ Unexpected response: ${err.response?.status} ${err.message}`);
            }
        }

        // 2. Test Invalid Token
        try {
            console.log('Test 2: Accessing /complete-order with invalid token...');
            const res = await axios.get(`${url}/complete-order`, {
                headers: { 'Authorization': 'Bearer invalid-token-here' }
            });
            console.log('❌ FAIL: Access granted with invalid token!');
        } catch (err: any) {
            if (err.response?.status === 401) {
                console.log('✅ PASS: Access denied (401)');
            } else {
                console.log(`⚠️ Unexpected response: ${err.response?.status} ${err.message}`);
            }
        }

        // 3. Test Wrong Role Token
        try {
            console.log('Test 3: Accessing /complete-order with wrong role token...');
            const wrongToken = jwt.sign({ role: 'user' }, JWT_SECRET);
            const res = await axios.get(`${url}/complete-order`, {
                headers: { 'Authorization': `Bearer ${wrongToken}` }
            });
            console.log('❌ FAIL: Access granted to non-admin role!');
        } catch (err: any) {
            if (err.response?.status === 401) {
                console.log('✅ PASS: Access denied (401)');
            } else {
                console.log(`⚠️ Unexpected response: ${err.response?.status} ${err.message}`);
            }
        }

        // 4. Test Valid Token (Only if secret is known)
        try {
            console.log('Test 4: Accessing /complete-order with valid admin token...');
            const validToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
            const res = await axios.get(`${url}/complete-order`, {
                headers: { 'Authorization': `Bearer ${validToken}` }
            });
            if (res.status === 200) {
                console.log('✅ PASS: Access granted with valid token');
                console.log(`Found ${res.data?.length || 0} orders.`);
            }
        } catch (err: any) {
            console.log(`❌ FAIL: Component is locked even with valid token: ${err.response?.status} ${err.message}`);
            console.log('Note: This might fail if the deployed secret is different from local .env');
        }
    }
}

runAudit();
