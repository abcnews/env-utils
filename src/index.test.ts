/**
 * @jest-environment jsdom
 */

import { describe, expect, test, jest } from '@jest/globals';
import dotenv from 'dotenv';

dotenv.config({ path: '.envrc' });

import {
  APPLICATIONS,
  GENERATIONS,
  getApplication,
  getGeneration,
  getTier,
  requestDOMPermit,
  TIERS,
} from './index';

const setLocation = (url: URL) => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: url,
  });
};

describe('getTier', () => {
  const LIVE_DOMAINS = ['www.abc.net.au', 'newsapp.abc.net.au'];

  LIVE_DOMAINS.forEach(d => {
    test(`${d} should return live`, () => {
      setLocation(new URL(`https://${d}`));
      expect(getTier(false)).toBe(TIERS.LIVE);
    });
  });

  const PREVIEW_DOMAINS = [
    process.env.DOMAIN_PROD_PREVIEW || '',
    process.env.DOMAIN_PROD_DEVELOPER || '',
  ];

  PREVIEW_DOMAINS.forEach(d => {
    test(`${d} should return preview`, () => {
      setLocation(new URL(`https://${d}`));
      expect(getTier(false)).toBe(TIERS.PREVIEW);
    });
  });
});

describe('getApplication', () => {
  test('PL NEWS WEB', () => {
    document.head.innerHTML =
      '<meta data-react-helmet="true" name="generator" content="PL NEWS WEB">';
    expect(getApplication(false)).toBe(APPLICATIONS.PLN);
    document.head.innerHTML = '';
  });
});

describe('getGeneration', () => {
  test('should return PL for a PL application', () => {
    document.head.innerHTML =
      '<meta data-react-helmet="true" name="generator" content="PL NEWS WEB">';
    expect(getGeneration(false)).toBe(GENERATIONS.PL);
    document.head.innerHTML = '';
  });
});

declare global {
  interface Window {
    articleHydrated?: boolean;
  }
}

describe('requestDOMPermit', () => {
  window.articleHydrated = true;
  test('should return a promise', () => {
    expect(requestDOMPermit('key')).toBeInstanceOf(Promise);
  });

  test('should return true straight away on non-PL pages', () => {
    const key = 'key';
    return requestDOMPermit(key).then(res => {
      expect(res).toBe(true);
    });
  });

  test('should trigger a "decoy" event and resolve with decoyed elements', () => {
    const key = 'key';
    const el = document.createElement('div');
    el.dataset.key = key;
    el.dataset.clone = 'true';
    document.head.innerHTML =
      '<meta data-react-helmet="true" name="generator" content="PL NEWS WEB">';

    document.body.appendChild(el);

    const listener = jest.fn(() => {
      window.dispatchEvent(
        new CustomEvent('decoyActive', {
          detail: { key },
        })
      );
    });
    window.addEventListener('decoy', listener);
    return requestDOMPermit(key).then(res => {
      expect(listener).toHaveBeenCalled();
      expect(res).toEqual([el]);
      document.head.innerHTML = '';
      document.body.innerHTML = '';
    });
  });
});
