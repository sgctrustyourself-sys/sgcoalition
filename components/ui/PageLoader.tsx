import React from 'react';
import { Loader2 } from 'lucide-react';

const PageLoader = () => {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-brand-accent animate-spin" />
        </div>
    );
};

export default PageLoader;
