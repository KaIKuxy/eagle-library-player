import React, { useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContainer = () => {
    const { toasts, removeToast } = useToastStore();

    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none' // Allow clicks through container
        }}>
            {toasts.map((toast) => (
                <div key={toast.id} style={{
                    minWidth: '250px',
                    backgroundColor: 'rgba(20, 20, 20, 0.95)',
                    backdropFilter: 'blur(10px)',
                    color: '#fff',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    animation: 'slideIn 0.3s ease-out',
                    borderLeft: `4px solid ${toast.type === 'success' ? '#4caf50' :
                            toast.type === 'error' ? '#f44336' :
                                '#2196f3'
                        }`,
                    pointerEvents: 'auto'
                }}>
                    {toast.type === 'success' && <CheckCircle size={18} color="#4caf50" />}
                    {toast.type === 'error' && <AlertCircle size={18} color="#f44336" />}
                    {toast.type === 'info' && <Info size={18} color="#2196f3" />}

                    <span style={{ flex: 1, fontSize: '14px' }}>{toast.message}</span>

                    <button
                        onClick={() => removeToast(toast.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex'
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ToastContainer;
