import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Try multiple ways to get API key (for different deployment environments)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined' && process.env?.VITE_GEMINI_API_KEY) ||
    'AIzaSyCU4LC3SXpQK0cwmV1RrFtf2W_D_RsnI98'; // Fallback to hardcoded for now

const FULL_AI_PASSWORD = import.meta.env.VITE_FULL_AI_PASSWORD ||
    (typeof process !== 'undefined' && process.env?.VITE_FULL_AI_PASSWORD) ||
    'Gmoneyworld';

const genAI = new GoogleGenerativeAI(API_KEY);

export type ChatMode = 'brand' | 'full';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    image?: string; // Base64 string
    timestamp: number;
}

const BRAND_MODE_PROMPT = `You are Coalition Brand Assistant, a sophisticated AI powered by Google's advanced Transformer architecture (Gemini 2.0). You represent Coalition - a premium streetwear brand that bridges physical fashion with blockchain technology.

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
    - If a user asks to GENERATE AN IMAGE, guide them to use the "Generate Image" button or type "/image" to open the tool.
    
    CONSTRAINTS:
    - ONLY answer questions related to Coalition brand, products, and services
    - If asked about unrelated topics, politely say: "I'm focused on helping with Coalition-related questions. For general assistance, you can unlock Full AI Mode with a special password!"
    - Be professional, friendly, and concise
    - Direct urgent issues to: sgctrustyourself@gmail.com
    
    Remember: You represent the Coalition brand - be helpful and showcase our innovative blend of fashion and technology!`;

const FULL_AI_PROMPT = `You are a Coalition-themed AI assistant powered by an advanced Transformer model (Gemini 2.0) with unrestricted capabilities. You've been unlocked with the special password.
    
    While you can assist with any topic (coding, creative writing, analysis, etc.), maintain a friendly, professional tone that reflects Coalition's innovative and premium brand identity.
    
    IMPORTANT: If the user asks to GENERATE AN IMAGE, explicitly tell them: "I can help you with that! Please click the 'Generate Image' button or type '/image' to open the creation tool." Do NOT try to generate ASCII art or descriptions as images.
    
    You are helpful, intelligent, and precise.`;

export const sendChatMessage = async (
    message: string,
    mode: ChatMode,
    history: ChatMessage[] = [],
    image?: string // Base64 string
): Promise<string> => {
    try {
        // Check if API key exists
        if (!API_KEY || API_KEY === '') {
            console.error('[AI Chat] No API key configured!');
            return 'Sorry, the AI service is not configured. Please contact support at sgctrustyourself@gmail.com';
        }

        console.log('[AI Chat] Sending message:', message.substring(0, 50) + '...');
        if (image) console.log('[AI Chat] Image attached');

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp', // Supports vision
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
            },
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                },
            ],
        });

        const systemPrompt = mode === 'brand' ? BRAND_MODE_PROMPT : FULL_AI_PROMPT;

        // Build conversation history
        const conversationHistory = history.map(msg => {
            const parts: any[] = [{ text: msg.content }];
            if (msg.image) {
                parts.push({
                    inlineData: {
                        data: msg.image.split(',')[1], // Remove data:image/jpeg;base64, prefix
                        mimeType: msg.image.split(';')[0].split(':')[1]
                    }
                });
            }
            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts: parts
            };
        });

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Understood! I\'m ready to assist.' }]
                },
                ...conversationHistory
            ]
        });

        console.log('[AI Chat] Sending to Gemini API...');

        // Prepare current message parts
        const currentParts: any[] = [{ text: message }];
        if (image) {
            currentParts.push({
                inlineData: {
                    data: image.split(',')[1],
                    mimeType: image.split(';')[0].split(':')[1]
                }
            });
        }

        const result = await chat.sendMessage(currentParts);
        const response = await result.response;
        const text = response.text();

        console.log('[AI Chat] Response received:', text.substring(0, 100) + '...');
        return text;
    } catch (error: any) {
        console.error('[AI Chat] Detailed error:', error);
        // ... (Error handling remains the same)
        return `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again or contact support at sgctrustyourself@gmail.com`;
    }
};

/**
 * Generate an image from a text prompt
 */
export const generateImage = async (prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
    try {
        if (!API_KEY) return { success: false, error: 'API Key missing' };

        // Note: The Google Generative AI SDK for Node/Web might not support Imagen directly yet in the same way.
        // We will try to use the model if available, or fetch via REST if needed.
        // For now, let's try the standard generation method if the model supports it, 
        // OR we might need to use a different endpoint. 
        // Since we are in a browser environment, we'll try to use the gemini-2.0-flash-exp model 
        // which might have some generation capabilities or we use a placeholder if it fails.

        // ACTUALLY: Google's Image Generation usually requires a different API call structure (predict endpoint on Vertex AI)
        // or a specific model in AI Studio. 
        // Let's try to use a REST call to the image generation endpoint if the SDK doesn't support it easily.

        // Fallback: For this demo, since we might not have the exact Imagen setup, 
        // we will return a placeholder error if we can't hit the API, 
        // BUT let's try to use the 'imagen-3.0-generate-001' model.

        // NOTE: As of now, image generation via the JS SDK might be limited. 
        // We will try to use a fetch call to the REST API if possible, or just mock it for now if we can't.

        // Let's try a direct fetch to the generative language API for image generation
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                instances: [{ prompt: prompt }],
                parameters: { sampleCount: 1 }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('Image Gen Error:', err);
            // Fallback to Gemini 2.0 Flash if Imagen fails (it might generate ASCII or description)
            return { success: false, error: 'Image generation not available with current key/model.' };
        }

        const data = await response.json();
        // Assuming response structure for Imagen
        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
            return { success: true, imageUrl: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}` };
        }

        return { success: false, error: 'No image returned' };

    } catch (error: any) {
        console.error('Generate Image Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check if password is correct for Full AI Mode
 */
export const verifyFullAIPassword = (password: string): boolean => {
    return password === FULL_AI_PASSWORD;
};

/**
 * Get welcome message based on mode
 */
export const getWelcomeMessage = (mode: ChatMode): string => {
    if (mode === 'brand') {
        return 'Hi! 👋 I\'m your Coalition AI Assistant. I can help you with questions about our products, SGCoin rewards, NFTs, orders, and more. How can I assist you today?';
    } else {
        return '🚀 Full AI Mode Activated! I\'m now your Coalition-themed AI assistant with unrestricted capabilities. I can help you with anything - from coding to creative writing to problem-solving. What would you like to explore?';
    }
};
