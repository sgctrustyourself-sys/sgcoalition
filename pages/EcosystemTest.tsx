import React from 'react';

const EcosystemTest = () => {
    console.log('[EcosystemTest] Component rendering');

    return (
        <div className="bg-black min-h-screen text-white pt-24 px-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-white mb-4">Ecosystem Test Page</h1>
                <p className="text-gray-300">If you can see this, the component is rendering correctly.</p>
                <div className="mt-8 p-4 bg-white/10 rounded">
                    <p className="text-sm">This is a minimal test version of the Ecosystem page.</p>
                </div>
            </div>
        </div>
    );
};

export default EcosystemTest;
