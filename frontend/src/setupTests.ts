// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom does not ship `TextEncoder`/`TextDecoder` or web streams; agents
// streaming tests need them. Provide Node's polyfills.
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream as NodeReadableStream } from 'stream/web';
if (typeof (global as any).TextEncoder === 'undefined') {
  (global as any).TextEncoder = TextEncoder;
}
if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = TextDecoder;
}
if (typeof (global as any).ReadableStream === 'undefined') {
  (global as any).ReadableStream = NodeReadableStream;
}

// Mock environment variables
process.env.REACT_APP_API_URL = 'http://localhost:8000/api';
process.env.REACT_APP_POLAR_PUBLISHABLE_KEY = 'polar_test_mock';
process.env.REACT_APP_GA_TRACKING_ID = 'UA-MOCK';

// Mock window.matchMedia (and global, since framer-motion sometimes calls it
// without the `window.` prefix).
const matchMediaMock = jest.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));
Object.defineProperty(window, 'matchMedia', { writable: true, value: matchMediaMock });
(global as any).matchMedia = matchMediaMock;

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
