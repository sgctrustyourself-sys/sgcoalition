/**
 * Chat system type definitions
 */

export interface ChatMessage {
    id: string;
    conversationId: string;
    sender: 'user' | 'admin';
    senderName: string;
    message: string;
    timestamp: number;
    read: boolean;
    type: 'text' | 'image' | 'product' | 'system';
    metadata?: {
        productId?: string;
        orderId?: string;
        imageUrl?: string;
    };
}

export interface ChatConversation {
    id: string;
    userId: string;
    userEmail?: string;
    userName: string;
    status: 'active' | 'resolved' | 'pending';
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    unreadCount: number;
    tags?: string[];
}

export interface QuickReply {
    id: string;
    trigger: string;
    response: string;
    category: 'greeting' | 'faq' | 'product' | 'order' | 'other';
}

export interface ChatState {
    isOpen: boolean;
    currentConversation: ChatConversation | null;
    unreadCount: number;
    isTyping: boolean;
    isOnline: boolean;
}
