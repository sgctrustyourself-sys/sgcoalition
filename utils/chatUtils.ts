import { ChatMessage, ChatConversation, QuickReply } from '../types/chatTypes';

/**
 * Generate unique conversation ID
 */
export const generateConversationId = (): string => {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate unique message ID
 */
export const generateMessageId = (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get conversation from localStorage
 */
export const getConversation = (conversationId: string): ChatConversation | null => {
    const key = `chat_conversation_${conversationId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};

/**
 * Save conversation to localStorage
 */
export const saveConversation = (conversation: ChatConversation): void => {
    const key = `chat_conversation_${conversation.id}`;
    localStorage.setItem(key, JSON.stringify(conversation));
};

/**
 * Get all conversations
 */
export const getAllConversations = (): ChatConversation[] => {
    const conversations: ChatConversation[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('chat_conversation_')) {
            const data = localStorage.getItem(key);
            if (data) {
                conversations.push(JSON.parse(data));
            }
        }
    }
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
};

/**
 * Get user's active conversation
 */
export const getUserConversation = (userId: string): ChatConversation | null => {
    const conversations = getAllConversations();
    return conversations.find(c => c.userId === userId && c.status === 'active') || null;
};

/**
 * Create new conversation
 */
export const createConversation = (userId: string, userName: string, userEmail?: string): ChatConversation => {
    const conversation: ChatConversation = {
        id: generateConversationId(),
        userId,
        userName,
        userEmail,
        status: 'active',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        unreadCount: 0,
        tags: []
    };

    // Add welcome message
    const welcomeMessage: ChatMessage = {
        id: generateMessageId(),
        conversationId: conversation.id,
        sender: 'admin',
        senderName: 'Coalition Support',
        message: "Hi! 👋 How can we help you today?",
        timestamp: Date.now(),
        read: false,
        type: 'system'
    };

    conversation.messages.push(welcomeMessage);
    saveConversation(conversation);

    return conversation;
};

/**
 * Add message to conversation
 */
export const addMessage = (
    conversationId: string,
    sender: 'user' | 'admin',
    senderName: string,
    message: string,
    type: 'text' | 'image' | 'product' | 'system' = 'text',
    metadata?: ChatMessage['metadata']
): ChatMessage => {
    const conversation = getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const newMessage: ChatMessage = {
        id: generateMessageId(),
        conversationId,
        sender,
        senderName,
        message,
        timestamp: Date.now(),
        read: sender === 'user', // Mark user messages as read immediately
        type,
        metadata
    };

    conversation.messages.push(newMessage);
    conversation.updatedAt = Date.now();

    // Update unread count for admin messages
    if (sender === 'admin') {
        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    }

    saveConversation(conversation);
    return newMessage;
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = (conversationId: string): void => {
    const conversation = getConversation(conversationId);
    if (!conversation) return;

    conversation.messages.forEach(msg => {
        if (!msg.read && msg.sender === 'admin') {
            msg.read = true;
        }
    });

    conversation.unreadCount = 0;
    saveConversation(conversation);
};

/**
 * Get unread message count
 */
export const getUnreadCount = (conversationId: string): number => {
    const conversation = getConversation(conversationId);
    return conversation?.unreadCount || 0;
};

/**
 * Quick reply templates
 */
export const QUICK_REPLIES: QuickReply[] = [
    {
        id: 'greeting',
        trigger: 'hello',
        response: "Hi! How can we help you today?",
        category: 'greeting'
    },
    {
        id: 'shipping',
        trigger: 'shipping',
        response: "We offer free shipping on orders over $100! Standard shipping takes 5-7 business days.",
        category: 'faq'
    },
    {
        id: 'returns',
        trigger: 'return',
        response: "All sales are final. We do not accept returns or offer refunds. Please review our policy before purchasing.",
        category: 'faq'
    },
    {
        id: 'sizing',
        trigger: 'size',
        response: "Our items run true to size. Check the product page for detailed measurements!",
        category: 'product'
    },
    {
        id: 'nft',
        trigger: 'nft',
        response: "Select products include a digital NFT twin on Polygon! Look for the 'Digital Twin' badge.",
        category: 'product'
    }
];

/**
 * Get quick reply by trigger
 */
export const getQuickReply = (trigger: string): QuickReply | undefined => {
    return QUICK_REPLIES.find(qr =>
        trigger.toLowerCase().includes(qr.trigger.toLowerCase())
    );
};

/**
 * Check if admin is online (business hours)
 */
export const isAdminOnline = (): boolean => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = now.getHours();

    // Monday-Friday, 9am-5pm EST
    const isWeekday = day >= 1 && day <= 5;
    const isBusinessHours = hour >= 9 && hour < 17;

    return isWeekday && isBusinessHours;
};
