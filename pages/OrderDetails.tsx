import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Calendar, Package, CreditCard, MapPin, Truck, Clock3, AlertTriangle, ShoppingBag, RotateCcw } from 'lucide-react';
import { getOrderItemAddOnLabel } from '../utils/walletAddOns';
import { fetchPiecesByOrder, updatePieceMetadata } from '../services/numberedPieces';
import type { NumberedPiece } from '../types';

const OrderDetails = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const { orders, products, user, isLoading } = useApp();
    const { addToast } = useToast();
    // Numbered-edition piece-binding state per product in this order.
    const [piecesByProduct, setPiecesByProduct] = useState<Record<string, NumberedPiece[]>>({});
    // Inline NFT/NFC metadata editor state (admin-only).
    const [editingPieceId, setEditingPieceId] = useState<string | null>(null);
    const [editNft, setEditNft] = useState('');
    const [editNfc, setEditNfc] = useState('');
    const [isSavingPiece, setIsSavingPiece] = useState(false);

    const order = useMemo(() => orders.find(item => item.id === orderId), [orders, orderId]);

    useEffect(() => {
        if (!order?.id) {
            setPiecesByProduct({});
            return;
        }
        let mounted = true;
        fetchPiecesByOrder(order.id).then((pcs) => {
            if (!mounted) return;
            const map: Record<string, NumberedPiece[]> = {};
            pcs.forEach((p) => {
                if (!map[p.productId]) map[p.productId] = [];
                map[p.productId].push(p);
            });
            setPiecesByProduct(map);
        });
        return () => {
            mounted = false;
        };
    }, [order?.id]);

    const startEditPiece = (piece: NumberedPiece) => {
        setEditingPieceId(piece.id);
        setEditNft(piece.nftTokenId ?? '');
        setEditNfc(piece.nfcTagUrl ?? '');
    };

    const cancelEditPiece = () => {
        setEditingPieceId(null);
        setEditNft('');
        setEditNfc('');
    };

    // Strip a row's stale Hero state when the row underneath it changes mid-edit
    // (e.g., realtime piece reassignment). Defensive: prevents leftover
    // inputs from bleeding into the next row the admin opens.
    useEffect(() => {
        if (editingPieceId === null) {
            setEditNft('');
            setEditNfc('');
        }
    }, [editingPieceId, piecesByProduct]);

    const savePieceMetadata = async (pieceId: string) => {
        setIsSavingPiece(true);
        const nft = editNft.trim();
        const nfc = editNfc.trim();
        const result = await updatePieceMetadata(pieceId, {
            nftTokenId: nft ? nft : null,
            nfcTagUrl: nfc ? nfc : null,
        });
        setIsSavingPiece(false);
        if (!result.ok) {
            addToast(result.error || 'Failed to save piece metadata', 'error');
            return;
        }
        addToast('Piece metadata saved', 'success');
        setEditingPieceId(null);
        setEditNft('');
        setEditNfc('');
        // Refresh local state so the readout reflects the saved values.
        if (order?.id) {
            const pcs = await fetchPiecesByOrder(order.id);
            const map: Record<string, NumberedPiece[]> = {};
            pcs.forEach((p) => {
                if (!map[p.productId]) map[p.productId] = [];
                map[p.productId].push(p);
            });
            setPiecesByProduct(map);
        }
    };

    const canViewPrivateDetails = !!order && (
        user?.isAdmin ||
        (user?.uid && order.userId === user.uid) ||
        (user?.email && order.customerEmail === user.email)
    );

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending':
                return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300';
            case 'processing':
                return 'border-blue-500/20 bg-blue-500/10 text-blue-300';
            case 'paid':
                return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
            case 'shipped':
                return 'border-purple-500/20 bg-purple-500/10 text-purple-300';
            case 'delivered':
                return 'border-green-500/20 bg-green-500/10 text-green-300';
            case 'cancelled':
                return 'border-red-500/20 bg-red-500/10 text-red-300';
            case 'failed':
                return 'border-orange-500/20 bg-orange-500/10 text-orange-300';
            case 'refunded':
                return 'border-pink-500/20 bg-pink-500/10 text-pink-300';
            default:
                return 'border-white/10 bg-white/5 text-gray-300';
        }
    };

    const getProduct = (productId: string) => products.find(product => product.id === productId);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black px-4 py-12 text-white">
                <div className="mx-auto flex max-w-4xl items-center justify-center py-32 text-gray-400">
                    Loading order details...
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-black px-4 py-12 text-white">
                <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-sm">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-400" />
                    <h1 className="font-display text-3xl font-black uppercase tracking-tighter">Order not found</h1>
                    <p className="mt-3 text-sm text-gray-400">
                        We could not find that order in the current session.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <button
                            onClick={() => navigate('/order-history')}
                            className="rounded-full bg-white px-6 py-3 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-gray-200"
                        >
                            Back to History
                        </button>
                        <Link
                            to="/shop"
                            className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
                        >
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black px-4 py-12 text-white">
            <div className="mx-auto max-w-6xl">
                <button
                    onClick={() => navigate('/order-history')}
                    className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to History
                </button>

                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">
                            <ShoppingBag className="h-3 w-3 text-brand-accent" />
                            Order Receipt
                        </div>
                        <h1 className="font-display text-4xl font-black uppercase tracking-tighter md:text-5xl">
                            Order #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                        </h1>
                        <p className="mt-3 text-sm text-gray-400">
                            Placed on {new Date(order.createdAt).toLocaleString()}.
                        </p>
                    </div>

                    <span className={`inline-flex items-center rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest ${getStatusStyle(order.paymentStatus)}`}>
                        {order.paymentStatus}
                    </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Total</p>
                                <p className="mt-3 font-display text-3xl font-black uppercase tracking-tight">${order.total.toFixed(2)}</p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Payment</p>
                                <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight">{order.paymentMethod}</p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Type</p>
                                <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight">{order.orderType}</p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Items</p>
                                <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight">{order.items.length}</p>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <Package className="h-5 w-5 text-purple-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Items</h2>
                            </div>

                            <div className="space-y-3">
                                {order.items.map((item) => {
                                    const product = getProduct(item.productId);
                                    const addOnLabel = getOrderItemAddOnLabel(item);
                                    const productPieces = piecesByProduct[item.productId] ?? [];
                                    const isNumbered = !!product?.editionSize && productPieces.length > 0;

                                    return (
                                        <React.Fragment key={`${item.productId}-${item.selectedSize}`}>
                                            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                                                    <img
                                                        src={item.productImage || product?.images?.[0] || ''}
                                                        alt={item.productName}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="truncate font-bold text-white">
                                                        {item.productName || product?.name || 'Product'}
                                                    </h3>
                                                    <p className="mt-1 text-xs text-gray-400">
                                                        Size: {item.selectedSize}
                                                        {addOnLabel ? ` • ${addOnLabel}` : ''}
                                                        {' • '}Qty: {item.quantity}
                                                    </p>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="font-bold text-white">${item.total.toFixed(2)}</p>
                                                    <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
                                                </div>
                                            </div>
                                            {isNumbered && (
                                                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 pl-[4.75rem] space-y-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-400">
                                                        Numbered Edition Pieces · {product?.editionSize} total
                                                    </p>
                                                    {productPieces.map((piece) => {
                                                        const isEditingThis = editingPieceId === piece.id;
                                                        return (
                                                            <div key={piece.id} className="rounded-xl border border-white/5 bg-black/40 p-3 flex flex-col gap-2">
                                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300">
                                                                            Piece {piece.pieceIndex} / {product?.editionSize}
                                                                        </span>
                                                                        {piece.nftTokenId ? (
                                                                            <span className="text-xs text-gray-300">
                                                                                NFT #{piece.nftTokenId}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs text-gray-500 italic">NFT not minted</span>
                                                                        )}
                                                                        {piece.nfcTagUrl ? (
                                                                            <a
                                                                                href={piece.nfcTagUrl}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-xs text-brand-accent underline"
                                                                            >
                                                                                NFC link
                                                                            </a>
                                                                        ) : (
                                                                            <span className="text-xs text-gray-500 italic">no NFC URL</span>
                                                                        )}
                                                                    </div>
                                                                    {/* Edit button is gated while another row's edit is in flight so a stray click
                                                                        doesn't silently clobber an unsaved change. The currently-editing row shows
                                                                        the editor inline (no edit button next to its row). */}
                                                                    {!isEditingThis && user?.isAdmin && editingPieceId === null && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => startEditPiece(piece)}
                                                                            className="text-[10px] font-bold uppercase tracking-widest text-brand-accent hover:text-white border border-brand-accent/30 hover:border-white px-2 py-1 rounded"
                                                                        >
                                                                            Edit NFT/NFC
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {isEditingThis && (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">
                                                                                NFT Token ID
                                                                            </label>
                                                                            <input
                                                                                value={editNft}
                                                                                onChange={(e) => setEditNft(e.target.value)}
                                                                                placeholder="e.g. 8"
                                                                                className="w-full bg-black border border-white/10 rounded p-2 text-sm text-white focus:border-brand-accent outline-none"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">
                                                                                NFC Tag URL
                                                                            </label>
                                                                            <input
                                                                                value={editNfc}
                                                                                onChange={(e) => setEditNfc(e.target.value)}
                                                                                placeholder="https://opensea.io/..."
                                                                                className="w-full bg-black border border-white/10 rounded p-2 text-sm text-white focus:border-brand-accent outline-none"
                                                                            />
                                                                        </div>
                                                                        <div className="flex gap-2 sm:col-span-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => savePieceMetadata(piece.id)}
                                                                                disabled={isSavingPiece}
                                                                                className="bg-white text-black px-4 py-2 rounded text-xs font-bold uppercase tracking-widest hover:bg-gray-200 disabled:opacity-50"
                                                                            >
                                                                                {isSavingPiece ? 'Saving…' : 'Save'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={cancelEditPiece}
                                                                                disabled={isSavingPiece}
                                                                                className="border border-white/10 px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-white hover:text-white disabled:opacity-50"
                                                                            >
                                                                                Cancel
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <Clock3 className="h-5 w-5 text-emerald-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Timeline</h2>
                            </div>

                            <div className="space-y-4 text-sm">
                                <div className="flex items-start gap-3">
                                    <Calendar className="mt-0.5 h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="font-bold text-white">Created</p>
                                        <p className="text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CreditCard className="mt-0.5 h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="font-bold text-white">Payment status</p>
                                        <p className="text-gray-400 capitalize">{order.paymentStatus}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Truck className="mt-0.5 h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="font-bold text-white">Shipment</p>
                                        <p className="text-gray-400">
                                            {order.paymentStatus === 'delivered'
                                                ? 'Delivered'
                                                : order.paymentStatus === 'shipped'
                                                    ? 'In transit'
                                                    : order.paymentStatus === 'processing'
                                                        ? 'Preparing for shipment'
                                                        : 'Awaiting fulfillment'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-sky-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Shipping</h2>
                            </div>

                            {canViewPrivateDetails && order.shippingAddress ? (
                                <div className="space-y-2 text-sm text-gray-300">
                                    <p className="font-bold text-white">{order.customerName}</p>
                                    <p>{order.customerEmail}</p>
                                    <p>{order.shippingAddress.address1}</p>
                                    <p>
                                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
                                    </p>
                                    <p>{order.shippingAddress.country}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">
                                    Shipping details are hidden for privacy unless you are the account owner or an admin.
                                </p>
                            )}
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <RotateCcw className="h-5 w-5 text-purple-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Next step</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-400">
                                Need a new drop? Head back to the shop or review your current items in history.
                            </p>
                            <div className="mt-5 flex gap-3">
                                <Link
                                    to="/shop"
                                    className="rounded-full bg-white px-5 py-3 text-xs font-bold uppercase tracking-widest text-black transition hover:bg-gray-200"
                                >
                                    Shop Now
                                </Link>
                                <button
                                    onClick={() => navigate('/order-history')}
                                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
                                >
                                    Back to History
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetails;
