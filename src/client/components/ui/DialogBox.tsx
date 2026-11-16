import React from 'react';

interface DialogBoxProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogBox: React.FC<DialogBoxProps> = ({ children, className = '' }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className={`bg-gray-800 rounded-lg shadow-2xl p-6 pointer-events-auto ${className}`}>
        {children}
      </div>
    </div>
  );
};