import React, { useState } from 'react';
import { X, Image as ImageIcon, Sparkles, Download, Copy, Check } from 'lucide-react';
import { generateImage } from '../services/aiChat';
import { useToast } from '../context/ToastContext';

interface ImageGenModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageGenerated: (imageUrl: string, prompt: string) => void;
}

const ImageGenModal: React.FC<ImageGenModalProps> = ({ isOpen, onClose, onImageGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const { addToast } = useToast();

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setGeneratedImage(null);

        try {
            const result = await generateImage(prompt);

            if (result.success && result.imageUrl) {
                setGeneratedImage(result.imageUrl);
                onImageGenerated(result.imageUrl, prompt);
                addToast('Image generated successfully!', 'success');
            } else {
                addToast(result.error || 'Failed to generate image', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('An unexpected error occurred', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-black/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <ImageIcon className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="font-bold text-white">Generate Image</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Image Display */}
                    <div className="aspect-square w-full bg-black/50 rounded-xl border border-gray-800 flex items-center justify-center overflow-hidden relative group">
                        {isGenerating ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
                                    </div>
                                </div>
                                <p className="text-sm text-purple-300 animate-pulse">Dreaming up your image...</p>
                            </div>
                        ) : generatedImage ? (
                            <>
                                <img
                                    src={generatedImage}
                                    alt="Generated"
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                    <a
                                        href={generatedImage}
                                        download={`coalition-ai-${Date.now()}.png`}
                                        className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition text-white"
                                        title="Download"
                                    >
                                        <Download className="w-6 h-6" />
                                    </a>
                                </div>
                            </>
                        ) : (
                            <div className="text-center text-gray-500 p-8">
                                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Describe what you want to see,<br />and AI will create it for you.</p>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Prompt</label>
                        <div className="relative">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="A futuristic streetwear hoodie with neon accents..."
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition resize-none h-24"
                                disabled={isGenerating}
                            />
                            <div className="absolute bottom-3 right-3 text-xs text-gray-600">
                                {prompt.length} chars
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || isGenerating}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                    >
                        {isGenerating ? (
                            <>
                                <Sparkles className="w-5 h-5 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Generate Art
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageGenModal;
