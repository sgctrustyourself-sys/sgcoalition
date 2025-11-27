import React, { useState, useEffect } from 'react';
import { getAllInquiries, updateInquiry, deleteInquiry } from '../../services/customInquiry';
import { useToast } from '../../context/ToastContext';
import { Shirt, Scissors, Box, Sparkles, Eye, Trash2, Search, Filter, Download, ExternalLink } from 'lucide-react';

interface Inquiry {
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    product_type: string;
    title: string;
    description: string;
    reference_images: string[];
    budget_range: string;
    timeline: string;
    status: string;
    admin_notes: string | null;
    quote_amount: number | null;
    created_at: string;
}

const CustomInquiryManager: React.FC = () => {
    const { addToast } = useToast();
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
    const [filter, setFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchInquiries();
    }, []);

    const fetchInquiries = async () => {
        setLoading(true);
        try {
            const data = await getAllInquiries();
            setInquiries(data);
        } catch (error) {
            console.error('Error fetching inquiries:', error);
        }
        setLoading(false);
    };

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            await updateInquiry(id, { status });
            fetchInquiries();
            if (selectedInquiry?.id === id) {
                setSelectedInquiry({ ...selectedInquiry, status });
            }
        } catch (error) {
            addToast('Failed to update status', 'error');
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedInquiry) return;
        try {
            await updateInquiry(selectedInquiry.id, {
                adminNotes: selectedInquiry.admin_notes || undefined,
                quoteAmount: selectedInquiry.quote_amount || undefined
            });
            fetchInquiries();
            addToast('Notes saved successfully', 'success');
        } catch (error) {
            addToast('Failed to save notes', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this inquiry? This cannot be undone.')) return;
        try {
            await deleteInquiry(id);
            fetchInquiries();
            setSelectedInquiry(null);
        } catch (error) {
            addToast('Failed to delete inquiry', 'error');
        }
    };

    const exportToCSV = () => {
        const csv = [
            ['Name', 'Email', 'Phone', 'Type', 'Title', 'Budget', 'Timeline', 'Status', 'Date'].join(','),
            ...inquiries.map(i => [
                i.customer_name,
                i.customer_email,
                i.customer_phone || 'N/A',
                i.product_type,
                i.title,
                i.budget_range,
                i.timeline,
                i.status,
                new Date(i.created_at).toLocaleDateString()
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `custom-inquiries-${Date.now()}.csv`;
        a.click();
    };

    const filteredInquiries = inquiries.filter(inquiry => {
        const matchesFilter = filter === 'all' || inquiry.status === filter;
        const matchesSearch =
            inquiry.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inquiry.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inquiry.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getProductTypeIcon = (type: string) => {
        switch (type) {
            case 'apparel-pants': return <Scissors className="w-4 h-4" />;
            case 'apparel-shirt': return <Shirt className="w-4 h-4" />;
            case '3d-printed': return <Box className="w-4 h-4" />;
            default: return <Sparkles className="w-4 h-4" />;
        }
    };

    const getProductTypeLabel = (type: string) => {
        switch (type) {
            case 'apparel-pants': return 'Custom Pants';
            case 'apparel-shirt': return 'Custom Shirt';
            case '3d-printed': return '3D Printed';
            default: return 'Other';
        }
    };

    const statusCounts = {
        new: inquiries.filter(i => i.status === 'new').length,
        reviewing: inquiries.filter(i => i.status === 'reviewing').length,
        quoted: inquiries.filter(i => i.status === 'quoted').length,
        all: inquiries.length
    };

    if (loading) {
        return <div className="text-center py-12 text-gray-400">Loading inquiries...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Inquiries</div>
                    <div className="text-2xl font-bold text-white">{statusCounts.all}</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                    <div className="text-blue-400 text-xs font-bold uppercase mb-1">New</div>
                    <div className="text-2xl font-bold text-blue-400">{statusCounts.new}</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                    <div className="text-yellow-400 text-xs font-bold uppercase mb-1">Reviewing</div>
                    <div className="text-2xl font-bold text-yellow-400">{statusCounts.reviewing}</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                    <div className="text-green-400 text-xs font-bold uppercase mb-1">Quoted</div>
                    <div className="text-2xl font-bold text-green-400">{statusCounts.quoted}</div>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${filter === 'all' ? 'bg-white text-black' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        All ({statusCounts.all})
                    </button>
                    <button
                        onClick={() => setFilter('new')}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${filter === 'new' ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        New ({statusCounts.new})
                    </button>
                    <button
                        onClick={() => setFilter('reviewing')}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${filter === 'reviewing' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        Reviewing ({statusCounts.reviewing})
                    </button>
                    <button
                        onClick={() => setFilter('quoted')}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${filter === 'quoted' ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        Quoted ({statusCounts.quoted})
                    </button>
                </div>

                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-white/30 outline-none"
                        />
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="bg-white/10 border border-white/10 px-4 py-2 rounded font-bold text-xs uppercase hover:bg-white/20 transition flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Inquiries List */}
            {filteredInquiries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    No inquiries found
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-black/40 text-gray-400 uppercase text-xs">
                            <tr>
                                <th className="p-3 text-left">Customer</th>
                                <th className="p-3 text-left">Project</th>
                                <th className="p-3 text-left">Type</th>
                                <th className="p-3 text-left">Budget</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right">Date</th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredInquiries.map(inquiry => (
                                <tr key={inquiry.id} className="hover:bg-white/5 transition">
                                    <td className="p-3">
                                        <div className="font-medium text-white">{inquiry.customer_name}</div>
                                        <div className="text-sm text-gray-400">{inquiry.customer_email}</div>
                                    </td>
                                    <td className="p-3 font-medium text-white">{inquiry.title}</td>
                                    <td className="p-3">
                                        <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
                                            {getProductTypeIcon(inquiry.product_type)}
                                            {getProductTypeLabel(inquiry.product_type)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-gray-400 text-sm">{inquiry.budget_range}</td>
                                    <td className="p-3 text-center">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${inquiry.status === 'new' ? 'bg-blue-500/20 text-blue-400' :
                                            inquiry.status === 'reviewing' ? 'bg-yellow-500/20 text-yellow-400' :
                                                inquiry.status === 'quoted' ? 'bg-green-500/20 text-green-400' :
                                                    inquiry.status === 'accepted' ? 'bg-purple-500/20 text-purple-400' :
                                                        'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {inquiry.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right text-gray-500 text-sm">
                                        {new Date(inquiry.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => setSelectedInquiry(inquiry)}
                                            className="text-blue-400 hover:text-blue-300 transition"
                                            title="View Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            {selectedInquiry && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedInquiry(null)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">{selectedInquiry.title}</h2>
                                    <p className="text-gray-400">{selectedInquiry.customer_name}</p>
                                    <p className="text-gray-500 text-sm">{selectedInquiry.customer_email}</p>
                                    {selectedInquiry.customer_phone && (
                                        <p className="text-gray-500 text-sm">{selectedInquiry.customer_phone}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(selectedInquiry.id)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded transition"
                                    title="Delete Inquiry"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Details Grid */}
                            <div className="grid md:grid-cols-2 gap-4 mb-6">
                                <div className="bg-black/30 border border-white/10 p-4 rounded-lg">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Product Type</div>
                                    <div className="text-white flex items-center gap-2">
                                        {getProductTypeIcon(selectedInquiry.product_type)}
                                        {getProductTypeLabel(selectedInquiry.product_type)}
                                    </div>
                                </div>
                                <div className="bg-black/30 border border-white/10 p-4 rounded-lg">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Budget Range</div>
                                    <div className="text-white">{selectedInquiry.budget_range}</div>
                                </div>
                                <div className="bg-black/30 border border-white/10 p-4 rounded-lg">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Timeline</div>
                                    <div className="text-white">{selectedInquiry.timeline}</div>
                                </div>
                                <div className="bg-black/30 border border-white/10 p-4 rounded-lg">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Submitted</div>
                                    <div className="text-white">{new Date(selectedInquiry.created_at).toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="mb-6">
                                <h3 className="font-bold uppercase text-gray-300 mb-2">Description</h3>
                                <p className="text-gray-400 whitespace-pre-wrap">{selectedInquiry.description}</p>
                            </div>

                            {/* Reference Images */}
                            {selectedInquiry.reference_images.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="font-bold uppercase text-gray-300 mb-2">Reference Images</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {selectedInquiry.reference_images.map((url, index) => (
                                            <a
                                                key={index}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="relative group"
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Reference ${index + 1}`}
                                                    className="w-full h-48 object-cover rounded-lg border border-gray-700"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg">
                                                    <ExternalLink className="w-8 h-8 text-white" />
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admin Section */}
                            <div className="pt-6 border-t border-gray-800 space-y-4">
                                <h3 className="font-bold uppercase text-gray-300">Admin Actions</h3>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                                        <select
                                            value={selectedInquiry.status}
                                            onChange={(e) => handleStatusUpdate(selectedInquiry.id, e.target.value)}
                                            className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                        >
                                            <option value="new">New</option>
                                            <option value="reviewing">Reviewing</option>
                                            <option value="quoted">Quoted</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="declined">Declined</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Quote Amount ($)</label>
                                        <input
                                            type="number"
                                            value={selectedInquiry.quote_amount || ''}
                                            onChange={(e) => setSelectedInquiry({ ...selectedInquiry, quote_amount: parseFloat(e.target.value) || null })}
                                            className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Admin Notes</label>
                                    <textarea
                                        value={selectedInquiry.admin_notes || ''}
                                        onChange={(e) => setSelectedInquiry({ ...selectedInquiry, admin_notes: e.target.value })}
                                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none min-h-[100px]"
                                        placeholder="Internal notes about this inquiry..."
                                    />
                                </div>

                                <button
                                    onClick={handleSaveNotes}
                                    className="w-full bg-white text-black font-bold uppercase py-3 rounded-lg hover:bg-gray-200 transition"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomInquiryManager;
