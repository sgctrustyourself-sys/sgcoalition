import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { BlogPost } from '../../types';
import { Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Image as ImageIcon, Loader } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { uploadProductImage } from '../../services/productUpload'; // Repurposing same bucket for now

const BlogManager = () => {
    const { addToast } = useToast();
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentPost, setCurrentPost] = useState<Partial<BlogPost>>({
        title: '',
        content: '',
        category: 'update',
        isPublished: false,
        tags: []
    });

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPosts(data || []);
        } catch (err) {
            console.error('Error fetching posts:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!currentPost.title || !currentPost.content) {
            addToast('Title and content are required.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const slug = currentPost.slug || currentPost.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, '');
            const postData = {
                ...currentPost,
                slug,
                author: 'Coalition Admin',
                published_at: currentPost.isPublished ? (currentPost.publishedAt || new Date().toISOString()) : null
            };

            const { error } = await supabase
                .from('posts')
                .upsert(postData);

            if (error) throw error;

            addToast('Blog post saved successfully!', 'success');

            // --- DISCORD AUTOMATION ---
            // Trigger Discord notification if published
            if (postData.isPublished) {
                try {
                    console.log('Sending Discord notification...');
                    await fetch('http://localhost:5001/webhook/blog', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: postData.title,
                            summary: postData.content.substring(0, 250) + '...', // Simple summary from content
                            url: `https://sgcoalition.xyz/blog/${slug}`,
                            imageUrl: postData.coverImage
                        })
                    });
                } catch (discordError) {
                    console.error('Discord notification failed:', discordError);
                    // We don't block the user if Discord fails, just log it
                }
            }
            // --------------------------

            setIsEditing(false);
            fetchPosts();
        } catch (err: any) {
            console.error('Save error:', err);
            addToast(`Error saving post: ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this post?')) return;

        try {
            const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            addToast('Post deleted.', 'success');
            fetchPosts();
        } catch (err: any) {
            addToast(`Delete failed: ${err.message}`, 'error');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            addToast('Uploading image...', 'info');
            const url = await uploadProductImage(file, 'blog-cover');
            setCurrentPost(prev => ({ ...prev, coverImage: url }));
            addToast('Image uploaded!', 'success');
        } catch (err: any) {
            addToast(`Upload failed: ${err.message}`, 'error');
        }
    };

    if (isLoading && !isEditing) {
        return (
            <div className="flex flex-col items-center justify-center p-20">
                <Loader className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading Blog Manager...</span>
            </div>
        );
    }

    return (
        <div className="bg-black/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Blog & Updates</h2>
                    <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">Manage community news and governance</p>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => {
                            setCurrentPost({ title: '', content: '', category: 'update', isPublished: false, tags: [] });
                            setIsEditing(true);
                        }}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Create New Post
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Post Title</label>
                                <input
                                    type="text"
                                    value={currentPost.title}
                                    onChange={(e) => setCurrentPost({ ...currentPost, title: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all"
                                    placeholder="Enter headline..."
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Content (Plain text or HTML)</label>
                                <textarea
                                    value={currentPost.content}
                                    onChange={(e) => setCurrentPost({ ...currentPost, content: e.target.value })}
                                    className="w-full h-80 bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all font-mono"
                                    placeholder="Write your update..."
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Cover Image</label>
                                <div className="relative group aspect-[16/9] bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4">
                                    {currentPost.coverImage ? (
                                        <img src={currentPost.coverImage} className="w-full h-full object-cover" alt="Cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                                            <ImageIcon className="w-8 h-8 mb-2" />
                                            <span className="text-[10px] font-bold uppercase">No Image</span>
                                        </div>
                                    )}
                                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                        <span className="text-[10px] font-bold uppercase text-white">Upload New</span>
                                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Category</label>
                                <select
                                    value={currentPost.category}
                                    onChange={(e) => setCurrentPost({ ...currentPost, category: e.target.value as any })}
                                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all appearance-none"
                                    title="Select Post Category"
                                >
                                    <option value="update">Platform Update</option>
                                    <option value="community">Community News</option>
                                    <option value="announcement">Official Announcement</option>
                                    <option value="drop">Product Drop Alpha</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="isPublished"
                                    checked={currentPost.isPublished}
                                    onChange={(e) => setCurrentPost({ ...currentPost, isPublished: e.target.checked })}
                                    className="w-4 h-4 bg-black border-white/20 rounded-sm accent-purple-500"
                                />
                                <label htmlFor="isPublished" className="text-[10px] font-bold uppercase tracking-widest text-white cursor-pointer select-none">
                                    Publish Immediately
                                </label>
                            </div>

                            <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="w-full bg-white text-black font-black uppercase py-4 text-[11px] tracking-[0.2em] hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                                >
                                    {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Post
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="w-full border border-white/10 text-gray-400 font-bold uppercase py-4 text-[11px] tracking-[0.2em] hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-gray-500 px-4">Status</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-gray-500 px-4">Post Title</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-gray-500 px-4">Category</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-gray-500 px-4">Governance</th>
                                <th className="pb-6 text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {posts.length > 0 ? posts.map((post: any) => (
                                <tr key={post.id} className="group hover:bg-white/[0.02] transition-all">
                                    <td className="py-6 px-4">
                                        {post.is_published ? (
                                            <span className="flex items-center gap-1.5 text-green-400 text-[9px] font-bold uppercase tracking-tighter">
                                                <Eye className="w-3 h-3" /> Published
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-gray-600 text-[9px] font-bold uppercase tracking-tighter">
                                                <EyeOff className="w-3 h-3" /> Draft
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-6 px-4">
                                        <span className="block text-sm font-bold uppercase tracking-tight truncate max-w-xs">{post.title}</span>
                                        <span className="block text-[10px] text-gray-600 font-mono mt-0.5">/{post.slug}</span>
                                    </td>
                                    <td className="py-6 px-4">
                                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-[9px] font-bold uppercase text-gray-400 rounded-sm">
                                            {post.category}
                                        </span>
                                    </td>
                                    <td className="py-6 px-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-mono text-green-400">↑ {Math.round(post.upvote_power).toLocaleString()}</span>
                                            <span className="text-[10px] font-mono text-red-400">↓ {Math.round(post.downvote_power).toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="py-6 px-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setCurrentPost({
                                                        ...post,
                                                        coverImage: post.cover_image,
                                                        isPublished: post.is_published,
                                                        publishedAt: post.published_at
                                                    });
                                                    setIsEditing(true);
                                                }}
                                                className="p-2 border border-white/10 rounded-sm hover:bg-white hover:text-black transition-all"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(post.id)}
                                                className="p-2 border border-white/10 rounded-sm hover:bg-red-500 hover:text-white transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                                        No community updates found. Start writing!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BlogManager;
