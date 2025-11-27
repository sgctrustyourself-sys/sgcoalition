import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { useToast, ToastType } from '../../context/ToastContext';

const ToastContainer = () => {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} {...toast} onRemove={() => removeToast(toast.id)} />
                ))}
            </AnimatePresence>
        </div>
    );
};

const ToastItem: React.FC<{ id: string; message: string; type: ToastType; onRemove: () => void }> = ({
    message,
    type,
    onRemove,
}) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    };

    const bgColors = {
        success: 'bg-white border-green-500',
        error: 'bg-white border-red-500',
        info: 'bg-white border-blue-500',
        warning: 'bg-white border-yellow-500',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            layout
            className={`pointer-events-auto min-w-[300px] max-w-md p-4 rounded-lg shadow-lg border-l-4 flex items-start gap-3 ${bgColors[type]}`}
        >
            <div className="flex-shrink-0 mt-0.5">{icons[type]}</div>
            <p className="text-gray-800 text-sm font-medium flex-grow pt-0.5">{message}</p>
            <button
                onClick={onRemove}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close notification"
            >
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
};

export default ToastContainer;
