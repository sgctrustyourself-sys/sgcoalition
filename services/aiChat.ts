import { buildApiUrl } from './apiBase';
import { supabase } from './supabase';

export type ChatMode = 'brand' | 'full';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    image?: string;
    timestamp: number;
}

type AiActionResponse<T> = T & {
    error?: string;
};

const FULL_AI_UNLOCK_TOKEN_KEY = 'coalition.fullAi.unlockToken';
const FULL_AI_UNLOCK_EXPIRES_KEY = 'coalition.fullAi.expiresAt';

async function getAuthHeaders() {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
    }

    return headers;
}

async function postAI<T>(payload: Record<string, unknown>): Promise<AiActionResponse<T>> {
    const response = await fetch(buildApiUrl('/api/ai-chat'), {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'AI request failed.');
    }

    return data;
}

function readStoredUnlockToken() {
    if (typeof window === 'undefined') return null;

    const token = window.localStorage.getItem(FULL_AI_UNLOCK_TOKEN_KEY);
    const expiresAt = Number(window.localStorage.getItem(FULL_AI_UNLOCK_EXPIRES_KEY) || 0);

    if (!token || !expiresAt || expiresAt <= Date.now()) {
        clearFullAIUnlock();
        return null;
    }

    return token;
}

function storeUnlockToken(unlockToken: string, expiresAt: number) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FULL_AI_UNLOCK_TOKEN_KEY, unlockToken);
    window.localStorage.setItem(FULL_AI_UNLOCK_EXPIRES_KEY, String(expiresAt));
}

export function clearFullAIUnlock() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(FULL_AI_UNLOCK_TOKEN_KEY);
    window.localStorage.removeItem(FULL_AI_UNLOCK_EXPIRES_KEY);
}

export async function validateFullAIUnlock(): Promise<boolean> {
    const unlockToken = readStoredUnlockToken();
    if (!unlockToken) return false;

    try {
        const result = await postAI<{ success: boolean }>({
            action: 'validateFullAIToken',
            unlockToken,
        });

        if (!result.success) clearFullAIUnlock();
        return Boolean(result.success);
    } catch {
        clearFullAIUnlock();
        return false;
    }
}

export const sendChatMessage = async (
    message: string,
    mode: ChatMode,
    history: ChatMessage[] = [],
    image?: string
): Promise<string> => {
    try {
        const result = await postAI<{ response: string }>({
            action: 'chat',
            message,
            mode,
            history,
            image,
            unlockToken: mode === 'full' ? readStoredUnlockToken() : undefined,
        });

        return result.response;
    } catch (error: any) {
        console.error('[AI Chat] Request failed:', error);
        return `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again or contact support at sgctrustyourself@gmail.com`;
    }
};

export const generateImage = async (prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
    try {
        return await postAI<{ success: boolean; imageUrl?: string; error?: string }>({
            action: 'generateImage',
            prompt,
            unlockToken: readStoredUnlockToken(),
        });
    } catch (error: any) {
        console.error('[AI Image] Request failed:', error);
        return { success: false, error: error.message || 'Image generation failed' };
    }
};

export const analyzeShirtReference = async (
    referenceImage: string,
    userInstructions: string = ''
): Promise<string> => {
    const result = await postAI<{ designPrompt: string }>({
        action: 'analyzeShirtReference',
        referenceImage,
        userInstructions,
        unlockToken: readStoredUnlockToken(),
    });

    return result.designPrompt;
};

export const generateShirtDesign = async (
    designPrompt: string,
    baseGarment: string = 'heavyweight cotton t-shirt'
): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
    try {
        return await postAI<{ success: boolean; imageUrl?: string; error?: string }>({
            action: 'generateShirtDesign',
            designPrompt,
            baseGarment,
            unlockToken: readStoredUnlockToken(),
        });
    } catch (error: any) {
        return { success: false, error: error.message || 'Shirt design generation failed' };
    }
};

export const designShirtFromReference = async (
    referenceImage: string,
    userInstructions: string = ''
): Promise<{ success: boolean; imageUrl?: string; designPrompt?: string; error?: string }> => {
    try {
        return await postAI<{ success: boolean; imageUrl?: string; designPrompt?: string; error?: string }>({
            action: 'designShirtFromReference',
            referenceImage,
            userInstructions,
            unlockToken: readStoredUnlockToken(),
        });
    } catch (error: any) {
        console.error('[Shirt Designer] Request failed:', error);
        return { success: false, error: error.message || 'Design generation failed' };
    }
};

export const verifyFullAIPassword = async (password: string): Promise<boolean> => {
    try {
        const result = await postAI<{ success: boolean; unlockToken?: string; expiresAt?: number }>({
            action: 'verifyFullAIPassword',
            password,
        });

        if (result.success && result.unlockToken && result.expiresAt) {
            storeUnlockToken(result.unlockToken, result.expiresAt);
            return true;
        }

        return false;
    } catch {
        return false;
    }
};

export const getWelcomeMessage = (mode: ChatMode): string => {
    if (mode === 'brand') {
        return 'Hi! I am your Coalition AI Assistant. I can help with products, SGCoin rewards, NFTs, orders, and account questions. How can I assist you today?';
    }

    return 'Full AI Mode activated. I am now your Coalition-themed AI assistant with expanded capabilities. What would you like to explore?';
};

export const recallBrainContext = async (topic: string): Promise<string | null> => {
    const result = await postAI<{ context: string | null }>({
        action: 'recallBrainContext',
        topic,
    });

    return result.context || null;
};

export const saveToBrain = async (title: string, content: string, tags: string[] = []): Promise<boolean> => {
    try {
        const result = await postAI<{ success: boolean }>({
            action: 'saveToBrain',
            title,
            content,
            tags,
            unlockToken: readStoredUnlockToken(),
        });

        return Boolean(result.success);
    } catch (error) {
        console.error('[AI Brain] Save failed:', error);
        return false;
    }
};
