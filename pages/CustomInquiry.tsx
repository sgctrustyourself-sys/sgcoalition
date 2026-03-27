import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shirt, Scissors, Box, Sparkles, Upload, CheckCircle, AlertCircle, Loader2, ArrowLeft, X, Layers } from 'lucide-react'; // Removed unused icons
import { uploadAllInquiryImages, validateInquiryImage } from '../services/inquiryUpload';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

const CustomInquiry = () => {
    const navigate = useNavigate();
    // const { submitCustomInquiry } = useApp(); // (Legacy submission - now using API directly)

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

    // Dynamic Helper Text based on selection
    const [helperText, setHelperText] = useState('');
    const [placeholderText, setPlaceholderText] = useState('');

    useEffect(() => {
        switch (formData.productType) {
            case 'apparel-pants':
                setHelperText('Tip: Mention fit (skinny, baggy), fabric weight (denim, cargo), and any distress/patchwork details.');
                setPlaceholderText('• Item type & quantity\n• Fit preference (e.g. baggy, slim)\n• Fabric/Material details\n• Colors & Wash\n• Distressing or Patchwork needs\n• Inspiration links...');
                break;
            case 'apparel-shirt':
                setHelperText('Tip: Specify the base garment (Hoodie, Tee) and print locations (Chest, Back, Sleeve).');
                setPlaceholderText('• Item type & quantity\n• Fit preference (e.g. boxy, oversized)\n• Fabric weight/Material\n• Print/Embroidery locations\n• Colors & Graphics\n• Inspiration links...');
                break;
            case '3d-printed':
                setHelperText('Tip: Include dimensions (LxWxH), material preference (PLA, Resin, TPU), and layer height if known.');
                setPlaceholderText('• Project goal/function\n• Approx dimensions (LxWxH)\n• Material preference (if any)\n• Color requirements\n• Post-processing needs (sanding, painting)\n• Link to 3D model (if available)...');
                break;
            case 'other':
                setHelperText('Tip: The more detail, the better. Measurements and usage context help us quote accurately.');
                setPlaceholderText('• Detailed project description\n• Intended use\n• Material preferences\n• key constraints (size, weight, etc)\n• Inspiration links...');
                break;
            default:
                setHelperText('Select a category above to see specific guidance.');
                setPlaceholderText('Describe your vision in detail... Include size, colors, materials, style preferences, special features, etc.');
        }
    }, [formData.productType]);


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
        files.forEach((file: File) => {
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
        const newFiles = imageFiles.filter((_, i) => i !== index);
        const newPreviews = imagePreviews.filter((_, i) => i !== index);
        setImageFiles(newFiles);
        setImagePreviews(newPreviews);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.productType || !formData.customerName || !formData.customerEmail ||
            !formData.title || !formData.description || !formData.budgetRange || !formData.timeline) {
            setError('Please fill in all required fields');
            window.scrollTo(0, 0);
            return;
        }

        setLoading(true);

        try {
            // Generate temp ID for image uploads
            const tempId = `temp_${Date.now()}`;

            // Upload images
            const imageUrls = await uploadAllInquiryImages(imageFiles, tempId);

            // Prepare Payload
            const payload = {
                ...formData,
                referenceImages: imageUrls
            };

            // Send to Notification API
            const response = await fetch('/api/notify-inquiry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to submit inquiry');
            }

            setSuccess(true);
            setLoading(false);
            window.scrollTo(0, 0);

        } catch (err: any) {
            console.error('Submission error:', err);
            setError(err.message || 'Failed to submit inquiry. Please try again.');
            setLoading(false);
            window.scrollTo(0, 0);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-lg w-full bg-gray-900 border border-gray-800 p-8 rounded-3xl text-center shadow-2xl"
                >
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                        <CheckCircle className="w-10 h-10 text-green-400" />
                    </div>
                    <h1 className="font-display text-3xl font-bold uppercase mb-4 tracking-tight">
                        Inquiry Received
                    </h1>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        Thanks, <span className="text-white font-bold">{formData.customerName}</span>. We've received your request for <span className="text-white font-bold">{formData.title}</span>.
                        <br /><br />
                        A member of our team will review the details and reach out to <span className="text-white font-bold">{formData.customerEmail}</span> within 24–48 hours with feasibility and next steps.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="bg-white text-black px-6 py-4 rounded-xl font-bold uppercase hover:bg-gray-200 transition tracking-widest text-xs"
                        >
                            Return Home
                        </button>
                        <button
                            onClick={() => {
                                setSuccess(false);
                                setFormData({ ...formData, title: '', description: '', productType: '' });
                                setImageFiles([]);
                                setImagePreviews([]);
                            }}
                            className="text-gray-500 text-xs uppercase font-bold tracking-widest hover:text-white transition py-2"
                        >
                            Start Another Inquiry
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 selection:bg-purple-500/30">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition text-xs font-bold uppercase tracking-widest"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </button>

                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block"
                    >
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-900/20 rotate-3">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="font-display text-5xl md:text-6xl font-black uppercase mb-4 tracking-tighter">
                            Custom Product<br />Inquiry
                        </h1>
                        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            Tell us what you want to create — we'll review and respond within 24–48 hours with feasibility, pricing, and next steps.
                        </p>
                    </motion.div>
                </div>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8 flex items-center gap-3 overflow-hidden"
                        >
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* 1. Category Selection */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-500">1</div>
                            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Select Category</h2>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <ProductTypeCard
                                icon={<Scissors className="w-6 h-6" />}
                                title="Pants"
                                selected={formData.productType === 'apparel-pants'}
                                onClick={() => setFormData({ ...formData, productType: 'apparel-pants' })}
                            />
                            <ProductTypeCard
                                icon={<Shirt className="w-6 h-6" />}
                                title="Shirt/Top"
                                selected={formData.productType === 'apparel-shirt'}
                                onClick={() => setFormData({ ...formData, productType: 'apparel-shirt' })}
                            />
                            <ProductTypeCard
                                icon={<Box className="w-6 h-6" />}
                                title="3D Print"
                                selected={formData.productType === '3d-printed'}
                                onClick={() => setFormData({ ...formData, productType: '3d-printed' })}
                            />
                            <ProductTypeCard
                                icon={<Layers className="w-6 h-6" />}
                                title="Other"
                                selected={formData.productType === 'other'}
                                onClick={() => setFormData({ ...formData, productType: 'other' })}
                            />
                        </div>
                    </div>

                    {/* 2. Customer Information */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-500">2</div>
                            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Contact Info</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Full Name *</label>
                                <input
                                    type="text"
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    className="w-full bg-black border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition font-medium"
                                    placeholder="Jane Doe"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Email *</label>
                                <input
                                    type="email"
                                    value={formData.customerEmail}
                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                    className="w-full bg-black border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition font-medium"
                                    placeholder="jane@example.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Phone (Optional)</label>
                                <input
                                    type="tel"
                                    value={formData.customerPhone}
                                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                    className="w-full bg-black border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition font-medium"
                                    placeholder="(555) 123-4567"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Project Details */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-500">3</div>
                            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Project Vision</h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Project Title *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-black border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition font-bold text-lg"
                                    placeholder="e.g. Custom Distressed Denim"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Detailed Description *</label>
                                    {helperText && (
                                        <span className="text-xs text-purple-400 font-medium hidden md:block animate-pulse">{helperText}</span>
                                    )}
                                </div>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-black border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition min-h-[200px] leading-relaxed"
                                    placeholder={placeholderText}
                                    required
                                />
                            </div>

                            {/* Image Upload */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                                        Reference Images ({imageFiles.length}/5)
                                    </label>
                                    <span className="text-xs text-gray-600">Sketches, inspiration, or similar products all help.</span>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {imagePreviews.map((preview, index) => (
                                        <div key={index} className="relative group aspect-square">
                                            <img
                                                src={preview}
                                                alt={`Reference ${index + 1}`}
                                                className="w-full h-full object-cover rounded-xl border border-gray-700"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition hover:bg-red-500"
                                                aria-label="Remove image"
                                                title="Remove image"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}

                                    {imageFiles.length < 5 && (
                                        <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition group">
                                            <Upload className="w-6 h-6 text-gray-500 group-hover:text-purple-400 mb-2 transition" />
                                            <span className="text-xs text-gray-500 font-medium">Add Image</span>
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
                        </div>
                    </div>

                    {/* 4. Budget & Timeline */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-gray-500">4</div>
                            <h2 className="font-display text-xl font-bold uppercase tracking-tight">Scope</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Target Budget *</label>
                                <div className="relative">
                                    <select
                                        value={formData.budgetRange}
                                        onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value as any })}
                                        className="w-full bg-black border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition appearance-none cursor-pointer"
                                        required
                                        aria-label="Target Budget"
                                    >
                                        <option value="">Select Range</option>
                                        <option value="under-100">Under $100</option>
                                        <option value="100-250">$100 - $250</option>
                                        <option value="250-500">$250 - $500</option>
                                        <option value="500+">$500+</option>
                                        <option value="flexible">Flexible / Don't Know</option>
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-2 ml-1">This helps us propose realistic options — not a commitment.</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Timeline *</label>
                                <div className="relative">
                                    <select
                                        value={formData.timeline}
                                        onChange={(e) => setFormData({ ...formData, timeline: e.target.value as any })}
                                        className="w-full bg-black border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 outline-none transition appearance-none cursor-pointer"
                                        required
                                        aria-label="Timeline"
                                    >
                                        <option value="">Select Timeline</option>
                                        <option value="no-rush">No Rush</option>
                                        <option value="1-2-weeks">1-2 Weeks</option>
                                        <option value="2-4-weeks">2-4 Weeks</option>
                                        <option value="asap">ASAP (Rush)</option>
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-2 ml-1">Rush timelines may affect pricing and material availability.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black font-black uppercase py-6 rounded-2xl hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                Submit Inquiry <CheckCircle className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    <p className="text-xs text-center text-gray-600 max-w-lg mx-auto leading-relaxed">
                        By submitting, you agree to allow SG Coalition to review your request.
                        We respect your IP and will never share your designs without permission.
                    </p>
                </form>
            </div>
        </div>
    );
};

// Enhanced Product Type Card
const ProductTypeCard: React.FC<{
    icon: React.ReactNode;
    title: string;
    selected: boolean;
    onClick: () => void;
}> = ({ icon, title, selected, onClick }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 aspect-[4/3] ${selected
                ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : 'border-gray-800 bg-black hover:border-gray-600 hover:bg-gray-900'
                }`}
        >
            <div className={`p-3 rounded-full ${selected ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                {icon}
            </div>
            <h3 className={`font-bold text-xs uppercase tracking-widest ${selected ? 'text-white' : 'text-gray-400'}`}>{title}</h3>
        </button>
    );
};

export default CustomInquiry;
