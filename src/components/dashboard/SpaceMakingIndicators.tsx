/**
 * Space Making Indicators Component
 * Shows visual feedback for components being pushed during space-making
 */

import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { AffectedComponent } from '@/lib/dashboard-animation-utils';

interface SpaceMakingIndicatorsProps {
  affectedComponents: AffectedComponent[];
  containerWidth: number;
  containerHeight: number;
  rowHeight: number;
  colWidth: number;
  visible: boolean;
}

const PushArrow: React.FC<{
  direction: { x: number; y: number };
  className?: string;
}> = ({ direction, className = '' }) => {
  if (direction.x > 0) return <ArrowRight className={className} />;
  if (direction.x < 0) return <ArrowLeft className={className} />;
  if (direction.y > 0) return <ArrowDown className={className} />;
  if (direction.y < 0) return <ArrowUp className={className} />;
  return null;
};

export const SpaceMakingIndicators: React.FC<SpaceMakingIndicatorsProps> = ({
  affectedComponents,
  containerWidth,
  containerHeight,
  rowHeight,
  colWidth,
  visible,
}) => {
  if (!visible || affectedComponents.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {affectedComponents.map((affected, index) => {
        const currentX = affected.originalPosition.x * colWidth;
        const currentY = affected.originalPosition.y * rowHeight;
        const targetX = affected.targetPosition.x * colWidth;
        const targetY = affected.targetPosition.y * rowHeight;

        // Calculate movement vector
        const deltaX = targetX - currentX;
        const deltaY = targetY - currentY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance === 0) return null;

        // Position the indicator at the center of the component
        const centerX = currentX + colWidth * 2; // Assume 4-wide components
        const centerY = currentY + rowHeight * 2; // Assume ~4-high components

        return (
          <div
            key={`space-making-${index}`}
            className="absolute"
            style={{
              left: centerX,
              top: centerY,
              transform: 'translate(-50%, -50%)',
              animation: `spaceMakingPulse 800ms ease-in-out infinite`,
              animationDelay: `${affected.animationDelay}ms`,
              zIndex: 1000,
            }}
          >
            {/* Movement indicator */}
            <div className="relative">
              {/* Background circle */}
              <div className="w-8 h-8 bg-blue-500/20 rounded-full border-2 border-blue-500/40 flex items-center justify-center">
                <PushArrow direction={affected.pushDirection} className="w-4 h-4 text-blue-600" />
              </div>

              {/* Movement trail */}
              {distance > 0 && (
                <div
                  className="absolute top-1/2 left-1/2 origin-left"
                  style={{
                    width: Math.min(distance, 60),
                    height: '2px',
                    background: 'linear-gradient(to right, rgba(59, 130, 246, 0.6), transparent)',
                    transform: `translate(-50%, -50%) rotate(${(Math.atan2(deltaY, deltaX) * 180) / Math.PI}deg)`,
                    transformOrigin: 'left center',
                  }}
                />
              )}
            </div>

            {/* Optional distance indicator */}
            {distance > 30 && (
              <div
                className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 bg-white/90 px-2 py-1 rounded shadow-sm border"
                style={{ fontSize: '10px' }}
              >
                {Math.round((distance / colWidth) * 10) / 10}u
              </div>
            )}
          </div>
        );
      })}

      <style jsx>{`
        @keyframes spaceMakingPulse {
          0% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
          100% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default SpaceMakingIndicators;
