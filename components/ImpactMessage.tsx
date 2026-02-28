import React, { useState, useEffect } from 'react';
import { Heart, MapPin, ExternalLink, Info } from 'lucide-react';
import { getImpactDetails, ImpactMessageData } from '../services/impactService';

interface ImpactMessageProps {
    zipCode?: string; // Optional: Pass user's zip if known (e.g., from shipping address)
    className?: string;
}

const ImpactMessage: React.FC<ImpactMessageProps> = ({ zipCode, className = '' }) => {
    const [impactData, setImpactData] = useState<ImpactMessageData | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const data = getImpactDetails(zipCode);
        setImpactData(data);
    }, [zipCode]);

    if (!impactData) return null;

    return (
        <div className={`mt-6 ${className}`}>
            {/* Primary Message Card */}
            <div
                className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4 cursor-pointer hover:bg-purple-500/10 transition-all group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-full text-purple-400 group-hover:scale-110 transition-transform">
                        <Heart size={16} fill="currentColor" className="opacity-50" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-200 leading-snug">
                            {impactData.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 flex items-center gap-1">
                                <MapPin size={10} /> Local Impact • {impactData.month}
                            </span>
                            {!isExpanded && (
                                <span className="text-[10px] text-gray-500 underline decoration-dotted">
                                    More Info
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="mt-2 ml-4 pl-4 border-l-2 border-purple-500/20 py-1 animate-in slide-in-from-top-2 fade-in duration-300">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                        {impactData.partner.name}
                    </h4>
                    <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                        {impactData.partner.mission}
                        <br />
                        <span className="italic opacity-70">Focus: {impactData.partner.type}</span>
                    </p>

                    <a
                        href={impactData.partner.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        Verify Partner <ExternalLink size={10} />
                    </a>
                </div>
            )}
        </div>
    );
};

export default ImpactMessage;
