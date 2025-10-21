'use client';

import { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedBackgroundSimple({ children, className = '' }: AnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle system
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }> = [];

    // Create particles
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.75) * 1.75, // Increased base movement
        vy: (Math.random() - 0.75) * 1.75, // Increased base movement
        size: Math.random() * 3 + 1,
      });
    }

    let mouseX = 0;
    let mouseY = 0;
    let isMouseOver = false;

    // Mouse interaction - use window events to capture mouse over the entire container
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      isMouseOver = true;
    };

    const handleMouseLeave = () => {
      isMouseOver = false;
    };

    // Add mouse events to the window to ensure they're captured
    // Mouse move listener stays the same
    window.addEventListener('mousemove', handleMouseMove);
    // Define a stable enter handler so we can remove it later
    const handleMouseEnter = () => {
      isMouseOver = true;
    };
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    // Keep track of the RAF ID so we can cancel on unmount
    let animationFrameId: number;
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Update and draw particles
      particles.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;
        // Mouse repulsion
        if (isMouseOver) {
          const dx = mouseX - particle.x;
          const dy = mouseY - particle.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 100) {
            const force = (80 - distance) / 80;
            const repulsionStrength = 3;
            particle.x -= (dx / distance) * force * repulsionStrength;
            particle.y -= (dy / distance) * force * repulsionStrength;
            particle.vx += -(dx / distance) * force * 1.2;
            particle.vy += -(dy / distance) * force * 1.2;
          }
        }
        // Friction & random drift
        particle.vx = particle.vx * 0.9995 + (Math.random() - 0.5) * 0.03;
        particle.vy = particle.vy * 0.9995 + (Math.random() - 0.5) * 0.03;
        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = '#89C7C1';
        ctx.fill();
        // Draw connections
        particles.forEach((other, j) => {
          if (i !== j) {
            const dx2 = particle.x - other.x;
            const dy2 = particle.y - other.y;
            const dist2 = Math.hypot(dx2, dy2);
            if (dist2 < 150) {
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(other.x, other.y);
              ctx.strokeStyle = `rgba(41,115,115,${0.4 * (1 - dist2 / 150)})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        });
      });
      // Schedule next frame and save its ID
      animationFrameId = requestAnimationFrame(animate);
    };
    // Kick off the loop and store the first ID
    animationFrameId = requestAnimationFrame(animate);
    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <style jsx>{`
        .animated-bg-simple {
          background-color: #f0fffd;
          position: relative;
        }

        .bg-canvas {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 1;
        }

        .content-wrapper {
          position: relative;
          z-index: 2;
        }
      `}</style>

      <div className={`animated-bg-simple min-h-screen relative overflow-hidden ${className}`}>
        <canvas ref={canvasRef} className="bg-canvas pointer-events-none" />

        <div className="content-wrapper">{children}</div>
      </div>
    </>
  );
}
