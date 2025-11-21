import React from 'react';
import { Order } from '../types';
import { X, Printer, Download } from 'lucide-react';

interface InvoiceProps {
    order: Order;
    onClose: () => void;
}

export const Invoice: React.FC<InvoiceProps> = ({ order, onClose }) => {
    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        // For a simple implementation, we'll use the browser's print to PDF feature
        // For a more advanced solution, you could integrate a library like jsPDF or html2pdf
        alert('Please use your browser\'s Print function and select "Save as PDF" as the destination.');
        window.print();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <>
            {/* Modal Overlay - Hidden when printing */}
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 print:hidden">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header with actions - Hidden when printing */}
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between print:hidden">
                        <h2 className="text-xl font-bold text-gray-900">Invoice</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition"
                            >
                                <Printer size={18} />
                                Print
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                <Download size={18} />
                                PDF
                            </button>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Invoice Content - This will be printed */}
                    <div className="p-8 print:p-0">
                        <InvoiceContent order={order} formatDate={formatDate} />
                    </div>
                </div>
            </div>

            {/* Print-only version - Hidden on screen, shown when printing */}
            <div className="hidden print:block">
                <InvoiceContent order={order} formatDate={formatDate} />
            </div>
        </>
    );
};

// Separate component for the actual invoice content
const InvoiceContent: React.FC<{ order: Order; formatDate: (date: string) => string }> = ({ order, formatDate }) => {
    return (
        <div className="bg-white text-black max-w-4xl mx-auto">
            {/* Company Header */}
            <div className="border-b-4 border-black pb-6 mb-6">
                <h1 className="text-4xl font-bold uppercase tracking-wider mb-2">Coalition</h1>
                <p className="text-gray-600">Premium Streetwear & Apparel</p>
            </div>

            {/* Invoice Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h2 className="text-2xl font-bold mb-4">INVOICE</h2>
                    <div className="space-y-1 text-sm">
                        <p><span className="font-semibold">Invoice #:</span> {order.orderNumber}</p>
                        <p><span className="font-semibold">Date:</span> {formatDate(order.createdAt)}</p>
                        <p><span className="font-semibold">Status:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs font-bold uppercase ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                    order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                }`}>
                                {order.paymentStatus}
                            </span>
                        </p>
                        <p><span className="font-semibold">Order Type:</span>
                            <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs font-bold uppercase">
                                {order.orderType}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <h3 className="font-bold mb-2">Bill To:</h3>
                    <div className="text-sm space-y-1">
                        <p className="font-semibold">{order.customerName}</p>
                        <p>{order.customerEmail}</p>
                        {order.customerPhone && <p>{order.customerPhone}</p>}
                        {order.shippingAddress && (
                            <div className="mt-3">
                                <p className="font-semibold">Shipping Address:</p>
                                <p>{order.shippingAddress.address1}</p>
                                <p>
                                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
                                </p>
                                <p>{order.shippingAddress.country}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b-2 border-black">
                            <th className="text-left py-3 font-bold uppercase text-sm">Item</th>
                            <th className="text-center py-3 font-bold uppercase text-sm">Size</th>
                            <th className="text-center py-3 font-bold uppercase text-sm">Qty</th>
                            <th className="text-right py-3 font-bold uppercase text-sm">Price</th>
                            <th className="text-right py-3 font-bold uppercase text-sm">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-200">
                                <td className="py-4">
                                    <div className="flex items-center gap-3">
                                        {item.productImage && (
                                            <img
                                                src={item.productImage}
                                                alt={item.productName}
                                                className="w-12 h-12 object-cover rounded"
                                            />
                                        )}
                                        <span className="font-medium">{item.productName}</span>
                                    </div>
                                </td>
                                <td className="text-center py-4">{item.selectedSize}</td>
                                <td className="text-center py-4">{item.quantity}</td>
                                <td className="text-right py-4">${item.price.toFixed(2)}</td>
                                <td className="text-right py-4 font-semibold">${item.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-8">
                <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">${order.subtotal.toFixed(2)}</span>
                    </div>
                    {order.tax > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax:</span>
                            <span className="font-semibold">${order.tax.toFixed(2)}</span>
                        </div>
                    )}
                    {order.discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                            <span>Discount:</span>
                            <span className="font-semibold">-${order.discount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t-2 border-black pt-2">
                        <span>TOTAL:</span>
                        <span>${order.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2">
                        <span className="text-gray-600">Payment Method:</span>
                        <span className="font-semibold uppercase">{order.paymentMethod}</span>
                    </div>
                    {order.paidAt && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Paid On:</span>
                            <span className="font-semibold">{formatDate(order.paidAt)}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Notes */}
            {order.notes && (
                <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="font-bold mb-2">Notes:</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
                </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-300 pt-6 text-center text-sm text-gray-600">
                <p className="mb-2">Thank you for your business!</p>
                <p>For questions about this invoice, please contact us at support@coalition.com</p>
                <p className="mt-4 text-xs">Coalition • Premium Streetwear & Apparel</p>
            </div>
        </div>
    );
};

export default Invoice;

// Add print styles to your global CSS or index.css:
/*
@media print {
    @page {
        margin: 1cm;
    }
    
    body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
    }
    
    .print\\:hidden {
        display: none !important;
    }
    
    .print\\:block {
        display: block !important;
    }
    
    .print\\:p-0 {
        padding: 0 !important;
    }
}
*/
