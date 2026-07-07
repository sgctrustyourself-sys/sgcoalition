import React from 'react';
import { Sparkles, Clock3, Award } from 'lucide-react';
import { ScarcityCopy, ScarcitySeverity } from '../utils/pdpScarcity';

interface ScarcityNarrativeProps {
    copy: ScarcityCopy;
}

const TONE: Record<ScarcitySeverity, { wrapper: string; iconColor: string; text: string }> = {
    quiet: {
        wrapper: 'border border-white/10 bg-white/5 text-gray-300',
        iconColor: 'text-brand-accent',
        text: 'text-gray-200',
    },
    notice: {
        wrapper: 'border border-orange-500/40 bg-orange-500/10 text-orange-200',
        iconColor: 'text-orange-300',
        text: 'text-orange-100',
    },
    sold: {
        wrapper: 'border border-red-500/40 bg-red-500/10 text-red-200',
        iconColor: 'text-red-300',
        text: 'text-red-100',
    },
    numbered: {
        wrapper: 'border border-yellow-500/40 bg-yellow-500/10 text-yellow-100',
        iconColor: 'text-yellow-300',
        text: 'text-yellow-50',
    },
};

const IconFor: React.FC<{ severity: ScarcitySeverity }> = ({ severity }) => {
    if (severity === 'numbered') return <Award className="h-4 w-4" />;
    if (severity === 'sold') return <Clock3 className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
};

/**
 * Founder-voice scarcity banner shown directly above the buy button when
 * the catalog has a story to tell (numbered edition, low stock, sold out).
 * Renders nothing for the quiet case so we don't add a banner that says
 * "Available" -- that would be noise on every PDP.
 */
const ScarcityNarrative: React.FC<ScarcityNarrativeProps> = ({ copy }) => {
    if (!copy.narrative) return null;

    const tone = TONE[copy.severity];

    return (
        <div
            data-testid="scarcity-narrative"
            role="status"
            aria-label={`Scarcity: ${copy.label}`}
            className={`flex items-start gap-3 rounded-sm px-4 py-3 ${tone.wrapper}`}
        >
            <span className={`mt-0.5 ${tone.iconColor}`}>
                <IconFor severity={copy.severity} />
            </span>
            <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white">
                    {copy.label}
                </p>
                <p className={`text-sm leading-relaxed ${tone.text}`}>
                    {copy.narrative}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-300/80">
                    {copy.detail}
                </p>
                {copy.founderNote && (
                    <p
                        data-testid="scarcity-founder-note"
                        className="text-[10px] italic leading-relaxed text-gray-200/70 pt-1"
                    >
                        {copy.founderNote}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ScarcityNarrative;
