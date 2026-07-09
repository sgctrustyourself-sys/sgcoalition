import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory, type Part } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { setCorsHeaders, createHttpError, parseBody, type HttpError, LOCAL_DEV_ORIGINS } from '../_helpers';
import type { ApiRequest, ApiResponse, BrainEntry, SupabaseClient } from '../_types';

type ChatMode = 'brand' | 'full';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    image?: string;
}

const BRAND_MODE_PROMPT = `You are Coalition Brand Assistant, a sophisticated AI powered by Google's Gemini model. You represent Coalition - a premium streetwear brand that bridges physical fashion with blockchain technology.

KEY INFORMATION:
- Products: Premium streetwear with embedded NFC tags linking to NFTs
- SGCoin: Loyalty cryptocurrency (ERC-20 on Polygon network)
- NFTs: Each physical item comes with a unique digital NFT
- Support Email: sgctrustyourself@gmail.com
- Website: https://sgcoalition.xyz

CAPABILITIES:
- Answer questions about products, prices, sizing, and availability
- Explain SGCoin rewards system and how to earn/use coins
- Help with NFT verification and blockchain features
- Assist with orders, shipping, and account issues
- Guide users through wallet setup and MetaMask connection
- If a user asks to generate an image, guide them to use the Generate Image button or type /image to open the tool.

CONSTRAINTS:
- Only answer questions related to Coalition brand, products, and services
- If asked about unrelated topics, politely say: "I'm focused on helping with Coalition-related questions. For general assistance, you can unlock Full AI Mode with a special password!"
- Be professional, friendly, and concise
- Direct urgent issues to: sgctrustyourself@gmail.com

Remember: You represent the Coalition brand - be helpful and showcase our innovative blend of fashion and technology!`;

const FULL_AI_PROMPT = `You are a Coalition-themed AI assistant powered by Google's Gemini model with unrestricted capabilities. You have been unlocked with the special password.

While you can assist with any topic, maintain a friendly, professional tone that reflects Coalition's innovative and premium brand identity.

IMPORTANT: If the user asks to generate an image, explicitly tell them: "I can help you with that! Please click the Generate Image button or type /image to open the creation tool." Do not try to generate ASCII art or descriptions as images.

You are helpful, intelligent, and precise.`;

const COALITION_SHIRT_DESIGN_STYLE = `
COALITION BRAND STYLE GUIDE (SG Coalition / Trust Yourself):

- AESTHETIC: Dark streetwear with high-end tactical/industrial edge. Baltimore grit meets digital futurism.
- COLOR PALETTE: Black base, charcoal grays, dark navy, electric blue accents, neon purple/pink highlights, white hits for contrast. Avoid bright warm colors, neons, and pastels.
- LOGO/TYPOGRAPHY: "COALITION" in bold condensed uppercase, often with glitch/distortion effects. "TRUST YOURSELF" tagline. Crowned-bird emblem (phoenix/eagle silhouette with a crown).
- GRAPHIC STYLE: High-density prints, distortion/glitch effects, frequency/wave patterns, digital noise, double-exposure overlays, tactical grid lines, binary/data-moshing elements.
- SHIRT BASE: Heavyweight cotton, boxy/oversized fit, drop shoulders. Typically black or charcoal base tee.
- PRINT PLACEMENT: Large back print centered with full coverage, front left chest logo, sleeve hits optional.
- VIBE: Mysterious, confident, anti-establishment luxury. "Built in Baltimore, trusted everywhere."
- INSPIRATION: Balenciaga, Vetements, Rick Owens, Brain Dead, Off-White industrial era, Chrome Hearts gothic.
- NO: Cartoonish elements, clip-art, Comic Sans, corporate aesthetic, pastels, overly bright/cheerful designs, AI watermarks.

Make the design feel like it belongs in a premium streetwear lookbook. Dark, moody, architectural.
`;

const FULL_AI_TOKEN_SCOPE = 'coalition-full-ai';
const FULL_AI_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_IMAGE_DATA_URL_LENGTH = 8_000_000;

function getGeminiApiKey() {
    return (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        ''
    ).trim();
}

function getFullAIPassword() {
    return (process.env.FULL_AI_PASSWORD || '').trim();
}

function getTokenSecret() {
    return (process.env.AI_SESSION_SECRET || getFullAIPassword()).trim();
}

function hashValue(value: string) {
    return createHash('sha256').update(value).digest();
}

function constantTimeEqual(a: string, b: string) {
    return timingSafeEqual(hashValue(a), hashValue(b));
}

function base64UrlEncode(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function signTokenPayload(encodedPayload: string) {
    const secret = getTokenSecret();
    if (!secret) throw createHttpError(503, 'Full AI unlock is not configured.');
    return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function issueFullAIToken() {
    const expiresAt = Date.now() + FULL_AI_TOKEN_TTL_MS;
    const encodedPayload = base64UrlEncode(JSON.stringify({
        scope: FULL_AI_TOKEN_SCOPE,
        exp: expiresAt,
    }));
    const signature = signTokenPayload(encodedPayload);

    return {
        unlockToken: `${encodedPayload}.${signature}`,
        expiresAt,
    };
}

function verifyFullAIToken(unlockToken: unknown) {
    if (!unlockToken || typeof unlockToken !== 'string') return false;
    const [encodedPayload, signature] = unlockToken.split('.');
    if (!encodedPayload || !signature) return false;

    const expectedSignature = signTokenPayload(encodedPayload);
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedSignatureBuffer.length) return false;
    if (!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) return false;

    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        return payload.scope === FULL_AI_TOKEN_SCOPE && typeof payload.exp === 'number' && payload.exp > Date.now();
    } catch {
        return false;
    }
}

function requireFullAccess(body: Record<string, unknown>) {
    if (!verifyFullAIToken(body?.unlockToken)) {
        throw createHttpError(401, 'Full AI unlock required.');
    }
}

function json(res: ApiResponse, status: number, body: Record<string, unknown>): void {
    res.status(status).json(body);
}

function getGenAI() {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw createHttpError(503, 'AI service is not configured.');
    return new GoogleGenerativeAI(apiKey);
}

function getSupabaseClient(requireServiceRole = false): SupabaseClient | null {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = requireServiceRole
        ? process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        : process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
        if (requireServiceRole) throw createHttpError(503, 'Brain write service is not configured.');
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

function getBearerToken(req: ApiRequest): string | null {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

async function isAdminRequest(req: ApiRequest): Promise<boolean> {
    try {
        const token = getBearerToken(req);
        if (!token) return false;

        const authClient = getSupabaseClient(false);
        const adminClient = getSupabaseClient(true);
        if (!authClient || !adminClient) return false;

        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        const userId = userData?.user?.id;
        if (userError || !userId) return false;

        const { data, error } = await adminClient
            .from('admin_users')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

        return !error && Boolean(data);
    } catch {
        return false;
    }
}

function safeSearchTerms(topic: string) {
    return topic
        .split(/\s+/)
        .map(term => term.replace(/[^a-z0-9#@-]/gi, '').toLowerCase())
        .filter(term => term.length > 2)
        .slice(0, 3);
}

async function recallBrainContext(topic: string) {
    const supabase = getSupabaseClient(true);
    const searchTerms = safeSearchTerms(topic);
    if (!supabase || searchTerms.length === 0) return null;

    const conditions = searchTerms.map(term => `title.ilike.%${term}%,content.ilike.%${term}%`).join(',');
    const { data, error } = await supabase
        .from('brain_entries')
        .select('title, content')
        .or(conditions)
        .order('importance', { ascending: false })
        .limit(3);

    if (error || !data?.length) return null;

    return data
        .map((entry: BrainEntry) => `[BRAIN: ${entry.title}] ${String(entry.content || '').substring(0, 500)}`)
        .join('\n\n');
}

function toInlineImage(image?: string): Part | null {
    if (!image || typeof image !== 'string') return null;
    if (!image.startsWith('data:image/') || image.length > MAX_IMAGE_DATA_URL_LENGTH) return null;

    const match = image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
    if (!match) return null;

    return {
        inlineData: {
            mimeType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
            data: match[2],
        },
    };
}

function messageToParts(content: string, image?: string): Part[] {
    const parts: Part[] = [];
    if (content) parts.push({ text: content });

    const inlineImage = toInlineImage(image);
    if (inlineImage) parts.push(inlineImage);

    if (!parts.length) parts.push({ text: '' });
    return parts;
}

function getTextModel() {
    return getGenAI().getGenerativeModel({
        model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash-exp',
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
        },
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
    });
}

async function handleChat(req: ApiRequest, body: Record<string, unknown>) {
    const message = String(body.message || '').trim();
    const mode: ChatMode = body.mode === 'full' ? 'full' : 'brand';
    const history = Array.isArray(body.history) ? body.history as ChatMessage[] : [];
    const image = typeof body.image === 'string' ? body.image : undefined;

    if (!message && !image) throw createHttpError(400, 'Message is required.');
    if (mode === 'full') requireFullAccess(body);

    const isAdmin = await isAdminRequest(req);
    const brainContext = isAdmin ? await recallBrainContext(message) : null;
    const effectiveMessage = brainContext
        ? `RELEVANT COALITION BRAIN KNOWLEDGE (use this context when applicable):\n${brainContext}\n\n---\n\nUSER MESSAGE:\n${message}`
        : message;

    const model = getTextModel();
    const systemPrompt = mode === 'brand' ? BRAND_MODE_PROMPT : FULL_AI_PROMPT;
    const conversationHistory = history
        .slice(-MAX_HISTORY_MESSAGES)
        .map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: messageToParts(String(msg.content || ''), msg.image),
        }));

    const chat = model.startChat({
        history: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: 'Understood. I am ready to assist.' }] },
            ...conversationHistory,
        ],
    });

    const result = await chat.sendMessage(messageToParts(effectiveMessage, image));
    const response = await result.response;
    return { response: response.text() };
}

async function generateImageFromPrompt(prompt: string) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw createHttpError(503, 'AI image service is not configured.');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1 },
        }),
    });

    if (!response.ok) {
        throw createHttpError(502, 'Image generation is not available with the configured model or key.');
    }

    const data = await response.json();
    const imageData = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!imageData) throw createHttpError(502, 'No image was returned.');

    return { success: true, imageUrl: `data:image/png;base64,${imageData}` };
}

async function handleGenerateImage(body: Record<string, unknown>) {
    requireFullAccess(body);
    const prompt = String(body.prompt || '').trim();
    if (!prompt) throw createHttpError(400, 'Prompt is required.');

    return generateImageFromPrompt(prompt);
}

async function analyzeShirtReference(referenceImage: string, userInstructions = '') {
    const inlineImage = toInlineImage(referenceImage);
    if (!inlineImage) throw createHttpError(400, 'A valid image data URL is required.');

    const model = getTextModel();
    const analysisPrompt = `You are a streetwear design director for "Coalition" (SG Coalition), a premium dark streetwear brand.

Analyze the attached reference image. Extract these design elements:
- Overall vibe and aesthetic
- Key visual motifs (shapes, symbols, patterns)
- Color palette observed
- Composition style (centered, scattered, geometric)
- Any text/typography style
- What makes it visually striking

${COALITION_SHIRT_DESIGN_STYLE}

${userInstructions ? `ADDITIONAL INSTRUCTIONS FROM USER: "${userInstructions}"` : ''}

TASK: Write a single detailed image generation prompt for an AI image generator that creates a new Coalition-branded t-shirt design. The design must:
1. Preserve the essence/vibe of the reference image
2. Transform it through the Coalition style guide above
3. Look like a flat-lay t-shirt product photo in a high-end e-commerce style
4. Include "COALITION" branding and/or "TRUST YOURSELF" in the design naturally

OUTPUT FORMAT: Write only the image generation prompt, with no preamble or explanation. The prompt should be 2-4 sentences and use professional art-direction language.`;

    const result = await model.generateContent([
        { text: analysisPrompt },
        inlineImage,
    ]);
    const response = await result.response;
    return response.text().trim();
}

async function handleAnalyzeShirtReference(body: Record<string, unknown>) {
    requireFullAccess(body);
    const referenceImage = String(body.referenceImage || '');
    const userInstructions = String(body.userInstructions || '');

    return { designPrompt: await analyzeShirtReference(referenceImage, userInstructions) };
}

async function handleGenerateShirtDesign(body: Record<string, unknown>) {
    requireFullAccess(body);
    const designPrompt = String(body.designPrompt || '').trim();
    const baseGarment = String(body.baseGarment || 'heavyweight cotton t-shirt').trim();
    if (!designPrompt) throw createHttpError(400, 'Design prompt is required.');

    const fullPrompt = `Flat-lay product photo of a ${baseGarment} on a dark surface, featuring a streetwear design: ${designPrompt}. Premium e-commerce product photography, studio lighting, 8K detail, dark moody aesthetic.`;
    return generateImageFromPrompt(fullPrompt);
}

async function handleDesignShirtFromReference(body: Record<string, unknown>) {
    requireFullAccess(body);
    const referenceImage = String(body.referenceImage || '');
    const userInstructions = String(body.userInstructions || '');
    const designPrompt = await analyzeShirtReference(referenceImage, userInstructions);
    const imageResult = await generateImageFromPrompt(`Flat-lay product photo of a heavyweight cotton t-shirt on a dark surface, featuring a streetwear design: ${designPrompt}. Premium e-commerce product photography, studio lighting, 8K detail, dark moody aesthetic.`);

    return {
        ...imageResult,
        designPrompt,
    };
}

async function handleSaveToBrain(body: Record<string, unknown>) {
    if (!body.__isAdmin) throw createHttpError(403, 'Admin access required.');
    const supabase = getSupabaseClient(true);
    if (!supabase) throw createHttpError(503, 'Brain write service is not configured.');
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();
    const tags = Array.isArray(body.tags) ? body.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 10) : [];

    if (!title || !content) throw createHttpError(400, 'Title and content are required.');

    const { error } = await supabase
        .from('brain_entries')
        .insert([{
            category: 'chat_insight',
            title,
            content,
            tags,
            source: 'ai_chat',
            importance: 3,
        }]);

    if (error) throw createHttpError(500, 'Failed to save brain insight.');
    return { success: true };
}

async function handleRecallBrainContext(body: Record<string, unknown>) {
    if (!body.__isAdmin) throw createHttpError(403, 'Admin access required.');
    const topic = String(body.topic || '').trim();
    if (!topic) return { context: null };

    return { context: await recallBrainContext(topic) };
}

async function handleVerifyPassword(body: Record<string, unknown>) {
    const configuredPassword = getFullAIPassword();
    const providedPassword = String(body.password || '');

    if (!configuredPassword) throw createHttpError(503, 'Full AI unlock is not configured.');
    if (!providedPassword || !constantTimeEqual(providedPassword, configuredPassword)) {
        throw createHttpError(401, 'Incorrect password.');
    }

    return {
        success: true,
        ...issueFullAIToken(),
    };
}

async function handleValidateToken(body: Record<string, unknown>) {
    return { success: verifyFullAIToken(body.unlockToken) };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { originWhitelist: LOCAL_DEV_ORIGINS, methods: 'POST,OPTIONS' });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        json(res, 405, { error: 'Method not allowed' });
        return;
    }

    try {
        const body = parseBody(req);
        const action = String(body.action || '');

        switch (action) {
            case 'chat':
                json(res, 200, await handleChat(req, body));
                return;
            case 'generateImage':
                json(res, 200, await handleGenerateImage(body));
                return;
            case 'analyzeShirtReference':
                json(res, 200, await handleAnalyzeShirtReference(body));
                return;
            case 'generateShirtDesign':
                json(res, 200, await handleGenerateShirtDesign(body));
                return;
            case 'designShirtFromReference':
                json(res, 200, await handleDesignShirtFromReference(body));
                return;
            case 'saveToBrain':
                json(res, 200, await handleSaveToBrain({ ...body, __isAdmin: await isAdminRequest(req) }));
                return;
            case 'recallBrainContext':
                json(res, 200, await handleRecallBrainContext({ ...body, __isAdmin: await isAdminRequest(req) }));
                return;
            case 'verifyFullAIPassword':
                json(res, 200, await handleVerifyPassword(body));
                return;
            case 'validateFullAIToken':
                json(res, 200, await handleValidateToken(body));
                return;
            default:
                json(res, 400, { error: 'Invalid AI action.' });
        }
    } catch (error: unknown) {
        const e = error as { status?: number; message?: string } | null;
        const status = Number(e?.status ?? 500);
        const message = status >= 500 ? (e?.message || 'AI request failed.') : e?.message;
        console.error('[AI API]', message);
        json(res, status, { error: message });
    }
}
