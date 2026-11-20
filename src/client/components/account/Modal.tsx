import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

/** A centered panel over a dimmed table. Escape or the backdrop closes it. */
export const Modal: React.FC<{ title: string; label: string; onClose: () => void; children: React.ReactNode }> = ({ title, label, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div className="absolute inset-0 bg-ink/75 backdrop-blur-[3px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} />
      <motion.div
        className="relative panel w-full max-w-md p-5 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        initial={{ y: 24, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 text-mist hover:text-bone transition-colors" aria-label="Close">
          <X size={18} />
        </button>
        <p className="section-head mb-1.5">{label}</p>
        <h2 id="modal-title" className="font-display font-black text-[28px] leading-tight text-paper mb-4 pr-8">{title}</h2>
        {children}
      </motion.div>
    </div>
  );
};
