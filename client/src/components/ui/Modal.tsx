'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/shared/Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeMap = {
    sm: 'max-w-[480px]',
    md: 'max-w-[600px]',
    lg: 'max-w-[800px]',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Apple Frosted Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xl"
          onClick={onClose}
        />

        {/* Apple Modal Card */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{
            type: 'spring',
            damping: 28,
            stiffness: 350,
          }}
          className={`relative w-full ${sizeMap[size]} rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated,var(--bg-1))] text-[var(--text)] shadow-[0_20px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text)]">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition-all duration-150 hover:bg-[var(--bg-2)] hover:text-[var(--text)] active:scale-95"
            >
              <Icons.X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 text-sm text-[var(--text-2)]">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] bg-[var(--bg-1)]/50 px-6 py-4">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            disabled={loading}
            style={confirmVariant === 'danger' ? {
              background: 'var(--red)',
              color: '#ffffff',
            } : {
              background: 'var(--accent)',
              color: '#ffffff',
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 14, height: 14,
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }} />
                Processing...
              </>
            ) : confirmText}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
