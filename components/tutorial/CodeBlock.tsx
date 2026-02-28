import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
    code: string;
    language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'text' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative bg-black/50 border border-white/10 rounded-lg p-4 font-mono text-sm">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded transition"
                title="Copy to clipboard"
            >
                {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                )}
            </button>
            <pre className="text-gray-300 overflow-x-auto pr-12">
                <code className={`language-${language}`}>{code}</code>
            </pre>
        </div>
    );
};

export default CodeBlock;
