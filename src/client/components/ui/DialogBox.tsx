import React from 'react';

interface DialogBoxProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogBox: React.FC<DialogBoxProps> = ({ children, className = '' }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[81] pointer-events-none p-4">
      <div className={`panel p-6 pointer-events-auto animate-fade-in ${className}`}>
        {children}
      </div>
    </div>
  );
};
