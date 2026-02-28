import React from 'react';
import { Zap, Clock } from 'lucide-react';

const AnnouncementBar = () => {
    return (
        <div className="bg-blue-600 text-white py-2.5 px-4 relative overflow-hidden flex items-center justify-center gap-4 text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Flash Sale: Use code</span>
                <span className="bg-black text-white px-2 py-0.5 rounded-sm font-mono tracking-tighter mx-1">EARLYACCESS</span>
                <span>for 20% OFF!</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 opacity-80 text-[10px]">
                <Clock className="w-3 h-3" />
                <span>Ends Soon</span>
            </div>
        </div>
    );
};

export default AnnouncementBar;
