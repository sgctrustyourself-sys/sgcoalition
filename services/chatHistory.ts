import { supabase } from './supabase';

export interface ChatSession {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface ChatMessage {
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    content: string;
    image_url?: string;
    created_at: string;
}

/**
 * Upload an image to Supabase Storage
 */
export const uploadImage = async (file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading image:', uploadError);
            return { success: false, error: uploadError.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);

        return { success: true, url: publicUrl };
    } catch (error: any) {
        console.error('Error uploading image:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Create a new chat session
 */
export const createChatSession = async (title: string = 'New Chat'): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, error: 'User not authenticated' };
        }

        const { data, error } = await supabase
            .from('ai_chat_sessions')
            .insert({
                user_id: user.id,
                title
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating chat session:', error);
            return { success: false, error: error.message };
        }

        return { success: true, sessionId: data.id };
    } catch (error: any) {
        console.error('Error creating chat session:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Save a message to a chat session
 */
export const saveMessage = async (
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    imageUrl?: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('ai_chat_messages')
            .insert({
                session_id: sessionId,
                role,
                content,
                image_url: imageUrl
            });

        if (error) {
            console.error('Error saving message:', error);
            return { success: false, error: error.message };
        }

        // Update session's updated_at timestamp
        await supabase
            .from('ai_chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId);

        return { success: true };
    } catch (error: any) {
        console.error('Error saving message:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all chat sessions for current user
 */
export const getChatSessions = async (): Promise<ChatSession[]> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return [];
        }

        const { data, error } = await supabase
            .from('ai_chat_sessions')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching chat sessions:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error fetching chat sessions:', error);
        return [];
    }
};

/**
 * Get all messages for a specific chat session
 */
export const getChatMessages = async (sessionId: string): Promise<ChatMessage[]> => {
    try {
        const { data, error } = await supabase
            .from('ai_chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching chat messages:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        return [];
    }
};

/**
 * Update chat session title
 */
export const updateChatTitle = async (sessionId: string, title: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('ai_chat_sessions')
            .update({ title })
            .eq('id', sessionId);

        if (error) {
            console.error('Error updating chat title:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error updating chat title:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a chat session and all its messages
 */
export const deleteChatSession = async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('ai_chat_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            console.error('Error deleting chat session:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting chat session:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Generate a title from the first user message
 */
export const generateChatTitle = (firstMessage: string): string => {
    // Take first 50 characters or until first period/question mark
    const truncated = firstMessage.slice(0, 50);
    const stopIndex = Math.min(
        truncated.indexOf('.') > 0 ? truncated.indexOf('.') : 50,
        truncated.indexOf('?') > 0 ? truncated.indexOf('?') : 50,
        truncated.indexOf('!') > 0 ? truncated.indexOf('!') : 50
    );

    let title = truncated.slice(0, stopIndex).trim();
    if (title.length === 0) title = 'New Chat';
    if (truncated.length >= 50) title += '...';

    return title;
};
