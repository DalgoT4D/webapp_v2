import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Add TextEncoder/TextDecoder to global
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock hasPointerCapture for Radix UI Select (jsdom doesn't support this)
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = jest.fn().mockReturnValue(false);
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = jest.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = jest.fn();
}

// Mock scrollIntoView for Radix UI Select (jsdom doesn't fully support this)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}
