import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

class ResizeObserverMock {
  constructor(private readonly onResize: ResizeObserverCallback) {}
  observe(target: Element) {
    const contentRect={width:640,height:220} as DOMRectReadOnly;
    this.onResize([{target,contentRect} as ResizeObserverEntry],this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:ResizeObserverMock});
Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{configurable:true,value:()=>({measureText:()=>({width:0})})});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
