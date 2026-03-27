import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Edit2, Check, X } from 'lucide-react';

interface EditableTextProps {
  value: string;
  onSave: (val: string) => void;
  className?: string;
  tag?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  multiline?: boolean;
}

export const EditableText: React.FC<EditableTextProps> = ({ value, onSave, className = "", tag = 'span', multiline = false }) => {
  const { isAdminMode } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  if (!isAdminMode) {
    const Tag = tag as any;
    return <Tag className={className}>{value}</Tag>;
  }

  if (isEditing) {
    return (
      <div className="relative group inline-block w-full max-w-2xl">
        {multiline ? (
          <textarea 
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className={`w-full p-2 border-2 border-blue-500 bg-white text-black rounded shadow-lg z-50 ${className}`}
            rows={4}
          />
        ) : (
          <input 
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            className={`w-full p-2 border-2 border-blue-500 bg-white text-black rounded shadow-lg z-50 ${className}`}
          />
        )}
        <div className="absolute -top-8 right-0 flex space-x-2 bg-white p-1 rounded shadow">
          <button onClick={() => { onSave(tempValue); setIsEditing(false); }} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={16} /></button>
          <button onClick={() => setIsEditing(false)} className="text-red-600 hover:bg-red-50 p-1 rounded"><X size={16} /></button>
        </div>
      </div>
    );
  }

  const Tag = tag as any;
  return (
    <div className="relative group inline-block border border-transparent hover:border-blue-500 hover:border-dashed rounded cursor-pointer" onClick={() => setIsEditing(true)}>
       <Tag className={className}>{value}</Tag>
       <div className="absolute -top-3 -right-3 bg-blue-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
         <Edit2 size={10} />
       </div>
    </div>
  );
};

interface EditableImageProps {
    src: string;
    alt: string;
    onSave: (url: string) => void;
    className?: string;
}

export const EditableImage: React.FC<EditableImageProps> = ({ src, alt, onSave, className }) => {
    const { isAdminMode } = useApp();

    if(!isAdminMode) {
        return <img src={src} alt={alt} className={className} />;
    }

    return (
        <div className="relative group">
            <img src={src} alt={alt} className={`${className} group-hover:opacity-50 transition-opacity`} />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button 
                    onClick={() => {
                        const url = prompt("Enter new image URL:", src);
                        if (url) onSave(url);
                    }}
                    className="bg-black text-white px-4 py-2 rounded shadow"
                >
                    Change Image
                </button>
            </div>
        </div>
    )
}
