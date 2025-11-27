import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Check, Clock, User as UserIcon } from 'lucide-react';
import { ChatConversation, ChatMessage } from '../types/chatTypes';
import { getAllConversations, addMessage, getConversation, saveConversation } from '../utils/chatUtils';

const AdminChatDashboard = () => {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load conversations
    useEffect(() => {
        loadConversations();
        // Refresh every 5 seconds
        const interval = setInterval(loadConversations, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadConversations = () => {
        const allConvs = getAllConversations();
        setConversations(allConvs);

        // Update selected conversation if it exists
        if (selectedConversation) {
            const updated = allConvs.find(c => c.id === selectedConversation.id);
            if (updated) {
                setSelectedConversation(updated);
            }
        }
    };

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedConversation?.messages]);

    const handleSend = () => {
        if (!message.trim() || !selectedConversation) return;

        const newMessage = addMessage(
            selectedConversation.id,
            'admin',
            'Coalition Support',
            message.trim()
        );

        setMessage('');
        loadConversations();
    };

    const handleResolve = () => {
        if (!selectedConversation) return;

        const updated = { ...selectedConversation, status: 'resolved' as const };
        saveConversation(updated);
        setSelectedConversation(null);
        loadConversations();
    };

    const activeConversations = conversations.filter(c => c.status === 'active');
    const resolvedConversations = conversations.filter(c => c.status === 'resolved');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
            {/* Conversations List */}
            <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-xl p-4 overflow-y-auto">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    Conversations
                </h3>

                {/* Active Conversations */}
                <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">
                        Active ({activeConversations.length})
                    </h4>
                    <div className="space-y-2">
                        {activeConversations.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No active conversations</p>
                        ) : (
                            activeConversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`w-full text-left p-3 rounded-lg transition ${selectedConversation?.id === conv.id
                                            ? 'bg-blue-500/20 border border-blue-500/50'
                                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm">{conv.userName}</span>
                                        {conv.unreadCount > 0 && (
                                            <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                {conv.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 truncate">
                                        {conv.messages[conv.messages.length - 1]?.message || 'No messages'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(conv.updatedAt).toLocaleString()}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Resolved Conversations */}
                {resolvedConversations.length > 0 && (
                    <div>
                        <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">
                            Resolved ({resolvedConversations.length})
                        </h4>
                        <div className="space-y-2">
                            {resolvedConversations.slice(0, 5).map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 transition opacity-60"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Check className="w-4 h-4 text-green-400" />
                                        <span className="font-bold text-sm">{conv.userName}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {new Date(conv.updatedAt).toLocaleString()}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Chat Window */}
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl flex flex-col overflow-hidden">
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                    <UserIcon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold">{selectedConversation.userName}</h3>
                                    <p className="text-xs text-gray-400">{selectedConversation.userEmail || 'No email'}</p>
                                </div>
                            </div>
                            {selectedConversation.status === 'active' && (
                                <button
                                    onClick={handleResolve}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    Mark Resolved
                                </button>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/30">
                            {selectedConversation.messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.sender === 'admin'
                                                ? 'bg-blue-500 text-white'
                                                : msg.type === 'system'
                                                    ? 'bg-gray-800 text-gray-300 border border-white/10'
                                                    : 'bg-white/10 text-white'
                                            }`}
                                    >
                                        {msg.sender === 'user' && (
                                            <p className="text-xs text-gray-400 mb-1">{msg.senderName}</p>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                        <p className={`text-xs mt-1 ${msg.sender === 'admin' ? 'text-blue-100' : 'text-gray-500'
                                            }`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        {selectedConversation.status === 'active' && (
                            <div className="p-4 border-t border-white/10">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                        placeholder="Type your response..."
                                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!message.trim()}
                                        className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p>Select a conversation to view messages</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminChatDashboard;
