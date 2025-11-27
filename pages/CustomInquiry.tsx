import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shirt, Scissors, Box, Sparkles, Upload, CheckCircle, AlertCircle, Loader2, ArrowLeft, X } from 'lucide-react';
import { uploadAllInquiryImages, validateInquiryImage } from '../services/inquiryUpload';
import { submitCustomInquiry, CustomInquiryData } from '../services/customInquiry';

const CustomInquiry = () => {
    const navigate = useNavigate();

    // Form state
    const [formData, setFormData] = useState({
        productType: '' as 'apparel-pants' | 'apparel-shirt' | '3d-printed' | 'other' | '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        title: '',
        description: '',
        budgetRange: '' as 'under-100' | '100-250' | '250-500' | '500+' | 'flexible' | '',
        timeline: '' as 'no-rush' | '1-2-weeks' | '2-4-weeks' | 'asap' | ''
    });

    // File state
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);

        if (imageFiles.length + files.length > 5) {
            setError('Maximum 5 images allowed');
            return;
        }

        // Validate each file
        for (const file of files) {
            const validation = validateInquiryImage(file);
            if (!validation.valid) {
                setError(validation.error || 'Invalid file');
                return;
            }
        }

        // Create previews
        const newPreviews: string[] = [];
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                newPreviews.push(reader.result as string);
                if (newPreviews.length === files.length) {
                    setImagePreviews([...imagePreviews, ...newPreviews]);
                }
            };
            reader.readAsDataURL(file);
        });

        setImageFiles([...imageFiles, ...files]);
        setError(null);
    };

    const removeImage = (index: number) => {
        setImageFiles(imageFiles.filter((_, i) => i !== index));
        setImagePreviews(imagePreviews.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.productType || !formData.customerName || !formData.customerEmail ||
            !formData.title || !formData.description || !formData.budgetRange || !formData.timeline) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);

        try {
            // Generate temp ID for image uploads
            const tempId = `temp_${Date.now()}`;

            // Upload images
            const imageUrls = await uploadAllInquiryImages(imageFiles, tempId);

            // Submit inquiry
            const inquiryData: CustomInquiryData = {
                productType: formData.productType,
                customerName: formData.customerName,
                customerEmail: formData.customerEmail,
                customerPhone: formData.customerPhone || undefined,
                title: formData.title,
                description: formData.description,
                referenceImages: imageUrls,
                budgetRange: formData.budgetRange,
                timeline: formData.timeline
            };

            await submitCustomInquiry(inquiryData);

            setSuccess(true);
            setLoading(false);

            // Redirect after 3 seconds
            setTimeout(() => {
                navigate('/');
            }, 3000);

        } catch (err: any) {
            console.error('Submission error:', err);
            setError(err.message || 'Failed to submit inquiry. Please try again.');
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-12 h-12 text-green-400" />
                    </div>
                    <h1 className="font-display text-4xl font-bold uppercase mb-4">
                        Inquiry Submitted!
                    </h1>
                    <p className="text-gray-400 mb-8">
                        Thank you for your custom product request! We'll review your inquiry and get back to you within 24-48 hours.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-white text-black px-6 py-3 rounded-lg font-bold uppercase hover:bg-gray-200 transition"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </button>

                <div className="text-center mb-12">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl font-bold uppercase mb-4">
                        Custom Product Inquiry
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Have a unique design in mind? Let us bring your vision to life with custom apparel or 3D printed products.
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Product Type Selection */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                        <h2 className="font-bold text-xl uppercase mb-4">What would you like custom made?</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <ProductTypeCard
                                icon={<Scissors className="w-8 h-8" />}
                                title="Custom Pants"
                                description="Jeans, cargo pants, custom fits"
                                selected={formData.productType === 'apparel-pants'}
                                onClick={() => setFormData({ ...formData, productType: 'apparel-pants' })}
                            />
                            <ProductTypeCard
                                icon={<Shirt className="w-8 h-8" />}
                                title="Custom Shirt"
                                description="T-shirts, hoodies, jackets"
                                selected={formData.productType === 'apparel-shirt'}
                                onClick={() => setFormData({ ...formData, productType: 'apparel-shirt' })}
                            />
                            <ProductTypeCard
                                icon={<Box className="w-8 h-8" />}
                                title="3D Printed Product"
                                description="Custom 3D designs & prints"
                                selected={formData.productType === '3d-printed'}
                                onClick={() => setFormData({ ...formData, productType: '3d-printed' })}
                            />
                            <ProductTypeCard
                                icon={<Sparkles className="w-8 h-8" />}
                                title="Other"
                                description="Something else in mind?"
                                selected={formData.productType === 'other'}
                                onClick={() => setFormData({ ...formData, productType: 'other' })}
                            />
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                        <h2 className="font-bold text-xl uppercase mb-4">Your Information</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    value={formData.customerEmail}
                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                    placeholder="john@example.com"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                Phone (Optional)
                            </label>
                            <input
                                type="tel"
                                value={formData.customerPhone}
                                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                placeholder="(555) 123-4567"
                            />
                        </div>
                    </div>

                    {/* Project Details */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                        <h2 className="font-bold text-xl uppercase mb-4">Project Details</h2>
                        <div>
                            <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                Project Title *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                placeholder="e.g., Custom Distressed Jeans with Patches"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                Detailed Description *
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition min-h-[150px]"
                                placeholder="Describe your vision in detail... Include size, colors, materials, style preferences, special features, etc."
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Be as specific as possible - size, colors, materials, style, special features, etc.
                            </p>
                        </div>

                        {/* Reference Images */}
                        <div>
                            <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                Reference Images (Optional, up to 5)
                            </label>

                            {imagePreviews.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                                    {imagePreviews.map((preview, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={preview}
                                                alt={`Reference ${index + 1}`}
                                                className="w-full h-32 object-cover rounded-lg border border-gray-700"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {imageFiles.length < 5 && (
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-purple-500 transition">
                                    <Upload className="w-8 h-8 text-gray-500 mb-2" />
                                    <span className="text-sm text-gray-500">Click to upload images</span>
                                    <span className="text-xs text-gray-600 mt-1">JPG, PNG, or WebP (Max 10MB each)</span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        multiple
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Budget & Timeline */}
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                        <h2 className="font-bold text-xl uppercase mb-4">Budget & Timeline</h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                    Budget Range *
                                </label>
                                <select
                                    value={formData.budgetRange}
                                    onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value as any })}
                                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                    required
                                >
                                    <option value="">Select budget range</option>
                                    <option value="under-100">Under $100</option>
                                    <option value="100-250">$100 - $250</option>
                                    <option value="250-500">$250 - $500</option>
                                    <option value="500+">$500+</option>
                                    <option value="flexible">Flexible</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase text-gray-400 mb-2">
                                    Timeline *
                                </label>
                                <select
                                    value={formData.timeline}
                                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value as any })}
                                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition"
                                    required
                                >
                                    <option value="">Select timeline</option>
                                    <option value="no-rush">No Rush</option>
                                    <option value="1-2-weeks">1-2 Weeks</option>
                                    <option value="2-4-weeks">2-4 Weeks</option>
                                    <option value="asap">ASAP</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-bold uppercase py-4 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Submit Inquiry'
                        )}
                    </button>

                    <p className="text-xs text-center text-gray-500">
                        We'll review your request and get back to you within 24-48 hours with a quote and timeline.
                    </p>
                </form>
            </div>
        </div>
    );
};

// Product Type Card Component
const ProductTypeCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
}> = ({ icon, title, description, selected, onClick }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`p-6 rounded-xl border-2 transition text-left ${selected
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-black hover:border-gray-600'
                }`}
        >
            <div className={`mb-3 ${selected ? 'text-purple-400' : 'text-gray-400'}`}>
                {icon}
            </div>
            <h3 className="font-bold text-lg mb-1">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
        </button>
    );
};

export default CustomInquiry;
