import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, FONT, FONT_FAMILY, SPACE } from '../constants/theme';

type ToastType = 'success' | 'error';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType, duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.toastContainer}>
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            message={toast.message}
            type={toast.type}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastNotification({ message, type }: { message: string; type: ToastType }) {
  const borderColor = type === 'success' ? COLORS.accent : COLORS.danger;
  const textPrefix = type === 'success' ? '[ OK ]' : '[ ERR ]';

  return (
    <View style={[styles.toast, { borderLeftColor: borderColor }]}>
      <Text style={styles.toastText}>
        {textPrefix} {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    paddingHorizontal: SPACE.md,
    pointerEvents: 'none',
  },
  toast: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 3,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    marginBottom: SPACE.sm,
    borderRadius: 2,
  },
  toastText: {
    color: COLORS.textPrimary,
    fontSize: FONT.sm,
    fontFamily: FONT_FAMILY.mono,
  },
});
