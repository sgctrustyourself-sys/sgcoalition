import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChatConversation, ChatMessage } from '../types/chatTypes';
import {
    getUserConversation,
    createConversation,
    addMessage,
    markMessagesAsRead,
    getUnreadCount,
    isAdminOnline
} from '../utils/chatUtils';

const ChatWidget = () => {
    const { user } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [conversation, setConversation] = useState<ChatConversation | null>(null);
    const [message, setMessage] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const online = isAdminOnline();

    // Load or create conversation
    useEffect(() => {
        if (user) {
            let conv = getUserConversation(user.uid);
            if (!conv) {
                conv = createConversation(user.uid, user.displayName || 'Guest', user.email || undefined);
            }
            setConversation(conv);
            setUnreadCount(getUnreadCount(conv.id));
        }
    }, [user]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conversation?.messages, isOpen]);

    // Mark as read when opened
    useEffect(() => {
        if (isOpen && conversation) {
            markMessagesAsRead(conversation.id);
            setUnreadCount(0);
        }
    }, [isOpen, conversation]);

    const handleSend = () => {
        if (!message.trim() || !conversation) return;

        const newMessage = addMessage(
            conversation.id,
            'user',
            user?.displayName || 'Guest',
            message.trim()
        );

        // Update local state
        setConversation(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                messages: [...prev.messages, newMessage],
                updatedAt: Date.now()
            };
        });

        setMessage('');

        // Auto-response if offline
        if (!online) {
            setTimeout(() => {
                const autoResponse = addMessage(
                    conversation.id,
                    'admin',
                    'Coalition Support',
                    "Thanks for your message! We're currently offline (Mon-Fri 9am-5pm EST). We'll respond within 24 hours. For urgent matters, email support@sgcoalition.xyz",
                    'system'
                );

                setConversation(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        messages: [...prev.messages, autoResponse]
                    };
                });
            }, 1000);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!user) return null; // Only show for logged-in users

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-white hover:bg-gray-200 text-black rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110"
                    aria-label="Open chat"
                >
                    <MessageCircle className="w-7 h-7" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {unreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-gray-900 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Coalition Support</h3>
                                <p className="text-xs text-blue-100">
                                    {online ? '🟢 Online' : '🔴 Offline'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-white/20 rounded-full transition"
                                aria-label="Minimize chat"
                            >
                                <Minimize2 className="w-5 h-5 text-white" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-white/20 rounded-full transition"
                                aria-label="Close chat"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
                        {conversation?.messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.sender === 'user'
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                                            : msg.type === 'system'
                                                ? 'bg-gray-800 text-gray-300 border border-white/10'
                                                : 'bg-white/10 text-white'
                                        }`}
                                >
                                    {msg.sender === 'admin' && msg.type !== 'system' && (
                                        <p className="text-xs text-gray-400 mb-1">{msg.senderName}</p>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                    <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                                        }`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-gray-900 border-t border-white/10">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your message..."
                                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 text-sm"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!message.trim()}
                                className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Send message"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                        {!online && (
                            <p className="text-xs text-gray-400 mt-2">
                                We're offline. We'll respond within 24 hours!
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatWidget;
