'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

// Declare global variables for particles.js and stats.js
declare global {
  interface Window {
    particlesJS: any;
    Stats: any;
    pJSDom: any;
  }
}

interface AnimatedBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedBackground({ children, className = '' }: AnimatedBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize particles when scripts are loaded
  useEffect(() => {
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (
        typeof window !== 'undefined' &&
        typeof window.particlesJS !== 'undefined' &&
        !initialized
      ) {
        initializeParticles();
        setInitialized(true);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [scriptsLoaded, initialized]);

  const initializeParticles = () => {
    try {
      console.log('Initializing particles.js...');

      window.particlesJS('particles-js', {
        particles: {
          number: { value: 80, density: { enable: true, value_area: 800 } },
          color: { value: '#297373' },
          shape: {
            type: 'circle',
            stroke: { width: 0, color: '#297373' },
            polygon: { nb_sides: 5 },
            image: { src: 'img/github.svg', width: 100, height: 100 },
          },
          opacity: {
            value: 0.5,
            random: false,
            anim: { enable: false, speed: 3, opacity_min: 0.1, sync: false },
          },
          size: {
            value: 3,
            random: true,
            anim: { enable: false, speed: 40, size_min: 0.1, sync: false },
          },
          line_linked: {
            enable: true,
            distance: 150,
            color: '#297373',
            opacity: 0.4,
            width: 1,
          },
          move: {
            enable: true,
            speed: 0.25,
            direction: 'none',
            random: false,
            straight: false,
            out_mode: 'out',
            bounce: false,
            attract: { enable: false, rotateX: 600, rotateY: 1200 },
          },
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: { enable: true, mode: 'repulse' },
            onclick: { enable: true, mode: 'push' },
            resize: true,
          },
          modes: {
            grab: { distance: 400, line_linked: { opacity: 1 } },
            bubble: { distance: 400, size: 40, duration: 2, opacity: 8, speed: 3 },
            repulse: { distance: 200, duration: 0.4 },
            push: { particles_nb: 4 },
            remove: { particles_nb: 2 },
          },
        },
        retina_detect: true,
      });

      console.log('Particles.js initialized');

      // Initialize stats if available
      if (typeof window.Stats !== 'undefined') {
        const stats = new window.Stats();
        stats.setMode(0);
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.left = '0px';
        stats.domElement.style.top = '0px';
        document.body.appendChild(stats.domElement);

        const count_particles = document.querySelector('.js-count-particles');
        const update = function () {
          stats.begin();
          stats.end();
          if (
            window.pJSDom &&
            window.pJSDom[0] &&
            window.pJSDom[0].pJS.particles &&
            window.pJSDom[0].pJS.particles.array
          ) {
            if (count_particles) {
              count_particles.innerText = window.pJSDom[0].pJS.particles.array.length;
            }
          }
          requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
      }
    } catch (error) {
      console.error('Error initializing particles:', error);
    }
  };

  return (
    <>
      {/* Load external scripts */}
      <Script
        src="https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js"
        onLoad={() => {
          console.log('Particles.js script loaded');
          setScriptsLoaded(true);
        }}
        onError={() => console.error('Failed to load particles.js')}
        strategy="afterInteractive"
      />
      <Script
        src="https://threejs.org/examples/js/libs/stats.min.js"
        onLoad={() => console.log('Stats.js script loaded')}
        onError={() => console.error('Failed to load stats.js')}
        strategy="afterInteractive"
      />

      {/* Add the CSS styles */}
      <style jsx>{`
        /* ---- reset ---- */
        canvas {
          display: block;
          vertical-align: bottom;
        }

        /* ---- particles.js container ---- */
        #particles-js {
          position: absolute;
          width: 100%;
          height: 100%;
          background-color: #0f2440;
          background-image: url('');
          background-repeat: no-repeat;
          background-size: cover;
          background-position: 50% 50%;
        }

        /* ---- stats.js ---- */
        .count-particles {
          background: #0f2440;
          position: absolute;
          top: 48px;
          left: 0;
          width: 80px;
          color: #13e8e9;
          font-size: 0.8em;
          text-align: left;
          text-indent: 4px;
          line-height: 14px;
          padding-bottom: 2px;
          font-family: Helvetica, Arial, sans-serif;
          font-weight: bold;
        }

        .js-count-particles {
          font-size: 1.1em;
        }

        #stats,
        .count-particles {
          -webkit-user-select: none;
          margin-top: 5px;
          margin-left: 5px;
        }

        #stats {
          border-radius: 3px 3px 0 0;
          overflow: hidden;
        }

        .count-particles {
          border-radius: 0 0 3px 3px;
        }

        .content-wrapper {
          position: relative;
          z-index: 2;
        }
      `}</style>

      <div className={`min-h-screen relative overflow-hidden ${className}`}>
        {/* particles.js container */}
        <div id="particles-js"></div>

        {/* stats - count particles */}
        <div className="count-particles">
          <span className="js-count-particles"></span>
        </div>

        {/* Content wrapper */}
        <div className="content-wrapper">{children}</div>
      </div>
    </>
  );
}

// Alternative version for just CSS-based background (simpler approach)
export function SimpleAnimatedBackground({ children, className = '' }: AnimatedBackgroundProps) {
  return (
    <>
      <style jsx>{`
        @keyframes gradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .simple-animated-bg {
          background: linear-gradient(-45deg, #667eea, #764ba2, #6b8dd6, #8e37d7);
          background-size: 400% 400%;
          animation: gradient 15s ease infinite;
          position: relative;
        }

        .simple-animated-bg::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background:
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.3) 0%, transparent 50%);
          z-index: 1;
        }

        .content-wrapper {
          position: relative;
          z-index: 2;
        }
      `}</style>

      <div className={`simple-animated-bg min-h-screen relative ${className}`}>
        <div className="content-wrapper">{children}</div>
      </div>
    </>
  );
}
