import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, ArrowLeft, Zap, Copy, Check, MessageSquare, Plus, Trash2, Menu, X as XIcon, Paperclip, Image as ImageIcon, X, Bot, LogOut } from 'lucide-react';
import { sendChatMessage, generateImage, type ChatMessage } from '../services/aiChat';
import {
    createChatSession,
    saveMessage,
    getChatSessions,
    getChatMessages,
    deleteChatSession,
    generateChatTitle,
    uploadImage,
    type ChatSession,
    type ChatMessage as DbChatMessage
} from '../services/chatHistory';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import ImageGenModal from '../components/ImageGenModal';

const AIPortal = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Chat History State
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    // Default sidebar to closed on mobile, open on desktop
    const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    // Image State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showImageGenModal, setShowImageGenModal] = useState(false);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const timer = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timer);
    }, [messages, previewUrl, isSidebarOpen]);

    // Load sessions and auth state
    useEffect(() => {
        checkAuth();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session);
            if (session) {
                loadSessions();
                
                // Check for session ID in URL
                const params = new URLSearchParams(window.location.search);
                const urlSessionId = params.get('session');
                if (urlSessionId) {
                    loadSession(urlSessionId);
                }
            }
            else setSessions([]);
        });
        return () => subscription.unsubscribe();
    }, []);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
        if (session) loadSessions();
    };

    const loadSessions = async () => {
        setIsHistoryLoading(true);
        const data = await getChatSessions();
        setSessions(data);
        setIsHistoryLoading(false);
    };

    const loadSession = async (sessionId: string) => {
        setCurrentSessionId(sessionId);
        const dbMsgs = await getChatMessages(sessionId);
        // Map DB messages to UI messages
        const uiMsgs: ChatMessage[] = dbMsgs.map(msg => ({
            role: msg.role,
            content: msg.content,
            image: msg.image_url,
            timestamp: new Date(msg.created_at).getTime()
        }));
        setMessages(uiMsgs);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleNewChat = () => {
        setMessages([]);
        setCurrentSessionId(null);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this chat?')) {
            const success = await deleteChatSession(sessionId);
            if (success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                if (currentSessionId === sessionId) {
                    handleNewChat();
                }
                addToast('Chat deleted', 'success');
            } else {
                addToast('Failed to delete chat', 'error');
            }
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                addToast('Image must be under 5MB', 'error');
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleGenerateImage = async () => {
        if (!input.trim()) {
            addToast('Please enter a prompt for the image', 'error');
            return;
        }

        setIsGenerating(true);
        const prompt = input;
        setInput('');

        // Add user message
        const userMsg: ChatMessage = {
            role: 'user',
            content: `Generate an image: ${prompt}`,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            const result = await generateImage(prompt);

            if (result.success && result.imageUrl) {
                const aiMsg: ChatMessage = {
                    role: 'assistant',
                    content: `Here is the image you requested based on: "${prompt}"`,
                    image: result.imageUrl,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, aiMsg]);

                if (currentSessionId) {
                    await saveMessage(currentSessionId, userMsg.role, userMsg.content, userMsg.image);
                    await saveMessage(currentSessionId, aiMsg.role, aiMsg.content, aiMsg.image);
                } else if (isAuthenticated) {
                    const newSession = await createChatSession(userMsg.content.substring(0, 50));
                    if (newSession.success && newSession.sessionId) {
                        setCurrentSessionId(newSession.sessionId);
                        // Reload sessions to get the full object
                        loadSessions();
                        await saveMessage(newSession.sessionId, userMsg.role, userMsg.content, userMsg.image);
                        await saveMessage(newSession.sessionId, aiMsg.role, aiMsg.content, aiMsg.image);
                    }
                }
            } else {
                addToast(result.error || 'Failed to generate image', 'error');
                const errorMsg: ChatMessage = {
                    role: 'assistant',
                    content: `Sorry, I couldn't generate that image. ${result.error || 'Please try again.'}`,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } catch (error) {
            console.error(error);
            addToast('Error generating image', 'error');
        } finally {
            setIsGenerating(false);
            setShowImageGenModal(false);
        }
    };

    const handleSendMessage = async () => {
        if ((!input.trim() && !selectedFile) || isLoading) return;

        // Intent Detection: Check if user is asking for image generation
        const lowerInput = input.toLowerCase();
        if (
            lowerInput.startsWith('/image') ||
            lowerInput.startsWith('generate image') ||
            lowerInput.startsWith('create image') ||
            (lowerInput.includes('generate') && lowerInput.includes('image'))
        ) {
            // If explicit command, open modal
            setShowImageGenModal(true);

            // Add a system message to guide them
            const guideMsg: ChatMessage = {
                role: 'assistant',
                content: "I've opened the Image Generation tool for you! You can create your artwork there.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, guideMsg]);
            setInput('');
            return;
        }

        const userMessage: ChatMessage = {
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        if (previewUrl) {
            userMessage.image = previewUrl;
        }

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        clearFile();
        setIsLoading(true);

        try {
            // 1. Create session if needed
            let sessionId = currentSessionId;
            if (!sessionId && isAuthenticated) {
                const title = await generateChatTitle(userMessage.content);
                const newSession = await createChatSession(title);
                if (newSession.success && newSession.sessionId) {
                    sessionId = newSession.sessionId;
                    setCurrentSessionId(sessionId);
                    loadSessions(); // Reload to get full session object
                }
            }

            // 2. Save user message
            if (sessionId) {
                // Upload image if exists
                if (selectedFile) {
                    const { url } = await uploadImage(selectedFile);
                    if (url) {
                        userMessage.image = url; // Update with remote URL
                    }
                }
                await saveMessage(sessionId, userMessage.role, userMessage.content, userMessage.image);
            }

            // 3. Get AI response
            const response = await sendChatMessage(userMessage.content, 'full', messages, userMessage.image);

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);

            // 4. Save AI message
            if (sessionId) {
                await saveMessage(sessionId, assistantMessage.role, assistantMessage.content, assistantMessage.image);
            }

        } catch (error) {
            console.error(error);
            addToast('Failed to send message', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-[100dvh] bg-black text-white overflow-hidden font-sans selection:bg-purple-500/30">
            {/* Sidebar - Desktop & Mobile Drawer */}
            <div className={`
                fixed inset-y-0 left-0 z-40 w-72 bg-gray-900/95 backdrop-blur-xl border-r border-white/10 transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                md:relative md:translate-x-0
            `}>
                <div className="flex flex-col h-full p-4">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Bot className="w-6 h-6 text-purple-400" />
                            <span className="font-bold text-lg tracking-tight">Coalition AI</span>
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="md:hidden p-2 hover:bg-white/10 rounded-lg transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <button
                        onClick={handleNewChat}
                        className="flex items-center gap-2 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 transition-all group mb-4"
                    >
                        <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition">
                            <Plus className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="font-medium text-sm">New Chat</span>
                    </button>

                    <div className="flex-1 overflow-y-auto space-y-2 -mx-2 px-2">
                        {sessions.map(session => (
                            <button
                                key={session.id}
                                onClick={() => loadSession(session.id)}
                                className={`w-full text-left p-3 rounded-xl transition-all border ${currentSessionId === session.id
                                    ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                                    : 'bg-transparent border-transparent hover:bg-white/5'
                                    }`}
                            >
                                <div className="font-medium text-sm truncate mb-1 text-gray-200">
                                    {session.title}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <MessageSquare className="w-3 h-3" />
                                    {new Date(session.updated_at).toLocaleDateString()}
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                        <button
                            onClick={() => window.close()}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition w-full p-2 rounded-lg hover:bg-white/5"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm">Exit Portal</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full relative w-full">
                {/* Header */}
                <header className="h-16 border-b border-white/10 bg-black/50 backdrop-blur-md flex items-center justify-between px-4 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 hover:bg-white/10 rounded-lg transition"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="font-bold text-sm md:text-base flex items-center gap-2">
                                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    Gemini 2.0 Flash
                                </span>
                                <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] text-purple-400 uppercase tracking-wider font-bold">
                                    Full Mode
                                </span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowImageGenModal(true)}
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition text-xs font-bold text-purple-300"
                        >
                            <ImageIcon className="w-4 h-4" />
                            Generate Image
                        </button>
                        <button
                            onClick={() => setShowImageGenModal(true)}
                            className="md:hidden p-2 hover:bg-white/10 rounded-lg text-purple-400"
                        >
                            <ImageIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4 md:space-y-6">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-4 py-3 md:px-6 md:py-4 shadow-xl ${msg.role === 'user'
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                                    : 'bg-gray-800 text-gray-100 border border-gray-700'
                                    }`}
                            >
                                {msg.image && (
                                    <div className="mb-3 rounded-lg overflow-hidden border border-white/10">
                                        <img src={msg.image} alt="Attached" className="max-w-full h-auto max-h-64 object-cover" />
                                    </div>
                                )}

                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                        <ReactMarkdown
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-2 leading-relaxed text-gray-200" {...props} />,
                                                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3 text-white" {...props} />,
                                                h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-2 text-white" {...props} />,
                                                h3: ({ node, ...props }) => <h3 className="text-base font-bold mb-2 text-white" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                                                li: ({ node, ...props }) => <li className="text-gray-200" {...props} />,
                                                code: ({ node, inline, ...props }: any) =>
                                                    inline ?
                                                        <code className="bg-gray-900 px-1.5 py-0.5 rounded text-purple-300 font-mono text-xs" {...props} /> :
                                                        <code className="block bg-gray-900 p-3 rounded-lg overflow-x-auto font-mono text-xs text-purple-300 my-2" {...props} />,
                                                strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="text-sm leading-relaxed">{msg.content}</p>
                                )}

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700/20">
                                    <p className="text-xs opacity-60">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    {msg.role === 'assistant' && (
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(msg.content);
                                                setCopiedIndex(idx);
                                                setTimeout(() => setCopiedIndex(null), 2000);
                                            }}
                                            className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
                                        >
                                            {copiedIndex === idx ? (
                                                <>
                                                    <Check className="w-3 h-3" />
                                                    Copied
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-800 rounded-2xl px-6 py-4 border border-gray-700 shadow-xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce"></div>
                                    <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <span className="text-sm text-gray-400 ml-2">AI is thinking...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-2 md:p-4 bg-black/50 backdrop-blur-md border-t border-gray-800">
                    <div className="max-w-4xl mx-auto bg-gray-900/80 border border-gray-800 rounded-xl p-2 md:p-4 shadow-2xl">
                        {previewUrl && (
                            <div className="mb-3 relative inline-block">
                                <img src={previewUrl} alt="Preview" className="h-20 rounded-lg border border-gray-700" />
                                <button
                                    onClick={clearFile}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2 md:gap-3 mb-1 md:mb-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 rounded-lg border border-gray-700 transition flex items-center justify-center"
                                title="Upload Image"
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Ask anything..."
                                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 md:px-4 md:py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition resize-none text-sm md:text-base"
                                disabled={isLoading}
                                rows={1}
                                style={{ minHeight: '44px', maxHeight: '120px' }}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={isLoading || (!input.trim() && !selectedFile)}
                                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 md:px-6 py-2 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end shadow-lg hover:shadow-purple-500/50"
                            >
                                <Send className="w-5 h-5" />
                                <span className="hidden md:inline">Send</span>
                            </button>
                        </div>
                        <div className="hidden md:flex items-center justify-between text-xs text-gray-500">
                            <p className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                Powered by Google Gemini 2.0
                            </p>
                            <p>
                                {input.length} characters
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Image Gen Modal */}
            <ImageGenModal
                isOpen={showImageGenModal}
                onClose={() => setShowImageGenModal(false)}
                onImageGenerated={(url, prompt) => {
                    // Optionally add the generated image to chat
                    const aiMsg: ChatMessage = {
                        role: 'assistant',
                        content: `I've generated an image for you based on: "${prompt}"`,
                        image: url,
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, aiMsg]);
                    setShowImageGenModal(false);
                }}
            />
        </div>
    );
};

export default AIPortal;
