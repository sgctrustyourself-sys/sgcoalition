import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ReviewPhotoUploadProps {
    photos: string[];
    onPhotosChange: (photos: string[]) => void;
    maxPhotos?: number;
}

const ReviewPhotoUpload: React.FC<ReviewPhotoUploadProps> = ({
    photos,
    onPhotosChange,
    maxPhotos = 3
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;

        const remainingSlots = maxPhotos - photos.length;
        if (remainingSlots <= 0) {
            alert(`Maximum ${maxPhotos} photos allowed`);
            return;
        }

        const newPhotos: string[] = [];
        let filesProcessed = 0;

        Array.from(files).slice(0, remainingSlots).forEach((file) => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select only image files');
                return;
            }

            // Validate file size (2MB max)
            if (file.size > 2 * 1024 * 1024) {
                alert(`${file.name} is too large. Maximum size is 2MB.`);
                return;
            }

            // Convert to base64
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                newPhotos.push(base64);
                filesProcessed++;

                if (filesProcessed === Math.min(files.length, remainingSlots)) {
                    onPhotosChange([...photos, ...newPhotos]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const removePhoto = (index: number) => {
        const newPhotos = photos.filter((_, i) => i !== index);
        onPhotosChange(newPhotos);
    };

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            {photos.length < maxPhotos && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${isDragging
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                    />
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-400 mb-1">
                        Drag & drop photos here, or click to select
                    </p>
                    <p className="text-xs text-gray-500">
                        Up to {maxPhotos} photos, 2MB each (JPG, PNG, GIF)
                    </p>
                    <p className="text-xs text-green-400 mt-2">
                        +50 SGCoins bonus for photo reviews!
                    </p>
                </div>
            )}

            {/* Photo Previews */}
            {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {photos.map((photo, index) => (
                        <div key={index} className="relative group aspect-square">
                            <img
                                src={photo}
                                alt={`Review photo ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg border border-white/10"
                            />
                            <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition"
                                aria-label={`Remove photo ${index + 1}`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {photos.length > 0 && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {photos.length} / {maxPhotos} photos uploaded
                </p>
            )}
        </div>
    );
};

export default ReviewPhotoUpload;
