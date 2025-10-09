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
        vx: (Math.random() - 0.5) * 1.5, // Increased base movement
        vy: (Math.random() - 0.5) * 1.5, // Increased base movement
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
    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mouseenter', () => {
      isMouseOver = true;
    });

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

        // Mouse repulsion - enhanced interaction
        if (isMouseOver) {
          const dx = mouseX - particle.x;
          const dy = mouseY - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            const force = (150 - distance) / 150;
            const repulsionStrength = 8;
            particle.x -= (dx / distance) * force * repulsionStrength;
            particle.y -= (dy / distance) * force * repulsionStrength;

            // Add some velocity for smoother movement
            particle.vx += -(dx / distance) * force * 2;
            particle.vy += -(dy / distance) * force * 2;
          }
        }

        // Apply minimal friction to allow continuous movement
        particle.vx *= 0.995;
        particle.vy *= 0.995;

        // Add some random movement to keep particles active
        particle.vx += (Math.random() - 0.5) * 0.01;
        particle.vy += (Math.random() - 0.5) * 0.01;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = '#297373';
        ctx.fill();

        // Draw connections
        particles.forEach((otherParticle, j) => {
          if (i !== j) {
            const dx = particle.x - otherParticle.x;
            const dy = particle.y - otherParticle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 150) {
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);
              ctx.strokeStyle = `rgba(41, 115, 115, ${0.4 * (1 - distance / 150)})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        });
      });

      // Optional: Draw mouse position indicator (remove for production)
      // if (isMouseOver) {
      //   ctx.beginPath();
      //   ctx.arc(mouseX, mouseY, 100, 0, Math.PI * 2);
      //   ctx.strokeStyle = 'rgba(41, 115, 115, 0.2)';
      //   ctx.lineWidth = 2;
      //   ctx.stroke();
      // }

      requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('mouseenter', () => {
        isMouseOver = true;
      });
    };
  }, []);

  return (
    <>
      <style jsx>{`
        .animated-bg-simple {
          background-color: #0f2440;
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
        <canvas ref={canvasRef} className="bg-canvas" />

        <div className="content-wrapper">{children}</div>
      </div>
    </>
  );
}
