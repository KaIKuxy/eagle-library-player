import { create } from 'zustand';

export const useToastStore = create((set) => ({
    toasts: [],
    addToast: (message, type = 'info', duration = 3000) => {
        const id = Date.now().toString();
        set((state) => ({
            toasts: [...state.toasts, { id, message, type, duration }]
        }));

        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    toasts: state.toasts.filter((t) => t.id !== id)
                }));
            }, duration);
        }
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    }
}));
