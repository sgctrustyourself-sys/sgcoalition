import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Lock, Unlock, Sparkles, Bot } from 'lucide-react';
import { sendChatMessage, verifyFullAIPassword, getWelcomeMessage, type ChatMode, type ChatMessage } from '../services/aiChat';
import { useToast } from '../context/ToastContext';

const AIChatWidget = () => {
    const { addToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<ChatMode>('brand');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            // Add welcome message
            setMessages([{
                role: 'assistant',
                content: getWelcomeMessage(mode),
                timestamp: Date.now()
            }]);
        }
    }, [isOpen]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await sendChatMessage(input, mode, messages);

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            addToast('Failed to send message. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnlockFullMode = () => {
        if (verifyFullAIPassword(passwordInput)) {
            setShowPasswordModal(false);
            setPasswordInput('');
            addToast('🚀 Opening Coalition AI Portal...', 'success');

            // Open AI Portal in new window
            window.open('/#/ai-portal', '_blank');
        } else {
            addToast('Incorrect password', 'error');
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        // Reset to brand mode when closed
        setTimeout(() => {
            setMode('brand');
            setMessages([]);
        }, 300);
    };

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-full p-4 shadow-2xl transition-all duration-300 transform hover:scale-110 z-50 group"
                >
                    <MessageCircle className="w-6 h-6" />
                    <div className="absolute -top-1 -right-1 bg-green-500 w-3 h-3 rounded-full animate-pulse"></div>
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        💬 Need Help? AI-Powered Support
                    </div>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 w-full h-full sm:w-[400px] sm:h-[600px] bg-gray-900 sm:rounded-2xl shadow-2xl border border-gray-800 flex flex-col z-50 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Bot className="w-6 h-6 text-white" />
                                <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white"></div>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">Coalition Support</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-green-300 flex items-center gap-1">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        AI Online
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white hover:bg-white/20 rounded-full p-1 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.role === 'user'
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                        : 'bg-gray-800 text-gray-100 border border-gray-700'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    <p className="text-xs opacity-60 mt-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-800 rounded-2xl px-4 py-2 border border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Unlock Button */}
                    <div className="px-4 py-2 bg-gray-900 border-t border-gray-800">
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-purple-400 px-3 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"
                        >
                            <Lock className="w-4 h-4" />
                            Open Full AI Portal
                        </button>
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-gray-900 border-t border-gray-800">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Type your message..."
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || !input.trim()}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-xl border border-purple-500/30 max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Unlock className="w-6 h-6 text-purple-300" />
                            <h3 className="text-xl font-bold text-white">Open AI Portal</h3>
                        </div>
                        <p className="text-purple-200 text-sm mb-4">
                            Enter the special password to open Coalition AI Portal - your unrestricted AI assistant in a new window.
                        </p>
                        <input
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleUnlockFullMode()}
                            placeholder="Enter password..."
                            className="w-full bg-black/50 border border-purple-500/30 rounded px-4 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordInput('');
                                }}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUnlockFullMode}
                                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded font-bold transition"
                            >
                                Open Portal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIChatWidget;
