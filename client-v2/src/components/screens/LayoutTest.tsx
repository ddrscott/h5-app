import React from 'react';

export const LayoutTest: React.FC = () => {
  // iPhone 14 Pro dimensions (scaled to 80% for better fit)
  const scale = 0.8;
  const portraitWidth = 393 * scale;
  const portraitHeight = 852 * scale;
  
  // Landscape is just portrait rotated
  const landscapeWidth = 852 * scale;
  const landscapeHeight = 393 * scale;
  
  return (
    <div className="min-h-screen bg-gray-900 p-4 relative max-h-screen overflow-y-scroll">
      <div className="w-full">
        <h1 className="container text-2xl font-bold text-white mb-4 mx-auto">Layout Testing - iPhone Views</h1>
        
          <div className="flex gap-8 px-8">
          {/* Portrait View */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gold">iPhone Portrait ({Math.round(portraitWidth)}x{Math.round(portraitHeight)})</h2>
            <div 
              className="bg-black rounded-lg overflow-hidden shadow-2xl mx-auto"
              style={{ width: `${portraitWidth}px`, height: `${portraitHeight}px` }}
            >
              <iframe
                src="/animation"
                className="w-full h-full"
                title="iPhone Portrait View"
                style={{ border: 'none' }}
              />
            </div>
          </div>
          
          {/* Landscape View */}
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gold">iPhone Landscape ({Math.round(landscapeWidth)}x{Math.round(landscapeHeight)})</h2>
            <div 
              className="bg-black rounded-lg overflow-hidden shadow-2xl mx-auto"
              style={{ width: `${landscapeWidth}px`, height: `${landscapeHeight}px` }}
            >
              <iframe
                src="/animation"
                className="w-full h-full"
                title="iPhone Landscape View"
                style={{ border: 'none' }}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-gray-400 text-sm">
          <p>Testing with iPhone 14 Pro dimensions. The frames above show how the game looks in both orientations.</p>
          <p className="mt-1">Note: The landscape view is the recommended orientation for gameplay.</p>
        </div>
      </div>
    </div>
  );
};
