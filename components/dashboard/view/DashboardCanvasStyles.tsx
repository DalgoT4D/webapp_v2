'use client';

/** Global styles of the view canvas (+ mobile scrolling fixes on public pages). */
export function DashboardCanvasStyles({ isPublicMode }: { isPublicMode: boolean }) {
  return (
    <style jsx global>{`
      .dashboard-canvas {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
      }

      .print-mode .dashboard-canvas {
        overflow: visible !important;
      }

      .dashboard-canvas .dashboard-grid {
        position: relative;
        width: 100% !important;
        height: 100%;
      }

      .dashboard-canvas .dashboard-item {
        transition: transform 0.2s ease;
        cursor: default;
      }

      .dashboard-canvas .dashboard-item:hover {
        z-index: 10;
      }

      .dashboard-canvas .react-grid-item {
        transition: none !important;
      }

      .dashboard-canvas .react-grid-item.react-grid-placeholder {
        display: none !important;
      }

      /* Canvas border animations */
      .dashboard-canvas {
        animation: canvasAppear 0.3s ease-out;
      }

      @keyframes canvasAppear {
        from {
          opacity: 0;
          transform: scale(0.98);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* Mobile-specific fixes for scrolling - ONLY for public dashboards */
      ${isPublicMode
        ? `
          @media (max-width: 640px) {
            html, body {
              height: auto !important;
              min-height: 100vh;
              overflow-x: hidden;
              -webkit-overflow-scrolling: touch;
            }
            
            .dashboard-canvas {
              max-width: calc(100vw - 2rem) !important;
              margin-left: auto !important;
              margin-right: auto !important;
            }
          }

          /* iOS Safari specific fixes - ONLY for public dashboards */
          @supports (-webkit-touch-callout: none) {
            @media (max-width: 640px) {
              .dashboard-canvas {
                will-change: scroll-position;
              }
            }
          }
        `
        : ''}
    `}</style>
  );
}
