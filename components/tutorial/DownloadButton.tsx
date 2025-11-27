import React from 'react';
import { Chrome, Smartphone } from 'lucide-react';

interface DownloadButtonProps {
    platform: 'chrome' | 'ios' | 'android';
    url: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ platform, url }) => {
    const config = {
        chrome: {
            icon: <Chrome className="w-6 h-6" />,
            label: 'Chrome Extension',
            color: 'from-blue-500 to-blue-600'
        },
        ios: {
            icon: <Smartphone className="w-6 h-6" />,
            label: 'iOS App',
            color: 'from-gray-600 to-gray-700'
        },
        android: {
            icon: <Smartphone className="w-6 h-6" />,
            label: 'Android App',
            color: 'from-green-600 to-green-700'
        }
    };

    const { icon, label, color } = config[platform];

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-6 py-4 bg-gradient-to-r ${color} text-white rounded-lg hover:opacity-90 transition font-bold shadow-lg`}
        >
            {icon}
            <span>{label}</span>
        </a>
    );
};

export default DownloadButton;
