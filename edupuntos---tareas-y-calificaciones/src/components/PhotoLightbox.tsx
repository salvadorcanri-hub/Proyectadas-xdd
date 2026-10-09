import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface PhotoLightboxProps {
  photoUrl: string;
  title: string;
  studentName?: string;
  submittedAt?: string;
  comment?: string;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photoUrl,
  title,
  studentName,
  submittedAt,
  comment,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.75));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 text-white">
          <div>
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            {studentName && (
              <p className="text-xs text-slate-400">
                Estudiante: {studentName} {submittedAt ? `· ${new Date(submittedAt).toLocaleDateString()}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              aria-label="Alejar foto"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              aria-label="Acercar foto"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleRotate}
              aria-label="Girar foto"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar visor"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Image */}
        <div className="relative flex-1 overflow-auto flex items-center justify-center p-4 min-h-[350px] bg-slate-950">
          <img
            src={photoUrl}
            alt={title}
            referrerPolicy="no-referrer"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.15s ease-out',
            }}
            className="max-h-[65vh] max-w-full object-contain rounded-sm select-none shadow-md"
          />
        </div>

        {/* Footer with student comment if present */}
        {comment && (
          <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300">
            <span className="font-semibold text-slate-200">Nota del estudiante: </span>
            {comment}
          </div>
        )}
      </div>
    </div>
  );
};
