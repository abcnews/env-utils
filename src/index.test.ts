import {
  APPLICATIONS,
  ENVIRONMENTS,
  GENERATIONS,
  getApplication,
  getEnvironment,
  getGeneration,
  getTier,
  requestDOMPermit,
  TIERS,
} from './index';

const setHostName = (str: string) => {
  // @ts-ignore
  delete window.location;
  // @ts-ignore
  window.location = { hostname: str };
};

describe('getTier', () => {
  const LIVE_DOMAINS = [
    'www.abc.net.au',
    'mobile.abc.net.au',
    'newsapp.abc.net.au',
  ];

  LIVE_DOMAINS.forEach(d => {
    test(`${d} should return live`, () => {
      setHostName(d);
      expect(getTier(false)).toBe(TIERS.LIVE);
    });
  });

  const PREVIEW_DOMAINS = [
    process.env.DOMAIN_PROD_PREVIEW || '',
    process.env.DOMAIN_PROD_DEVELOPER || '',
    process.env.DOMAIN_NUCWED || '',
    process.env.DOMAIN_AMP_PREVIEW || '',
  ];
  PREVIEW_DOMAINS.forEach(d => {
    test(`${d} should return preview`, () => {
      setHostName(d);
      expect(getTier(false)).toBe(TIERS.PREVIEW);
    });
  });
});

describe('getEnvironment', () => {
  const UAT_DOMAINS = [process.env.DOMAIN_PROD_DEVELOPER || ''];

  UAT_DOMAINS.forEach(d => {
    test(`${d} should return uat`, () => {
      setHostName(d);
      expect(getEnvironment(false)).toBe(ENVIRONMENTS.UAT);
    });
  });

  const PROD_DOMAINS = [
    process.env.DOMAIN_PROD_PREVIEW || '',
    process.env.DOMAIN_NUCWED || '',
    process.env.DOMAIN_AMP_PREVIEW || '',
  ];

  PROD_DOMAINS.forEach(d => {
    test(`${d} should return production`, () => {
      setHostName(d);
      expect(getEnvironment(false)).toBe(ENVIRONMENTS.PROD);
    });
  });
});

describe('getApplication', () => {
  test('Phase 1 mobile', () => {
    document.head.innerHTML = '<meta name="HandheldFriendly" content="true"/>';
    expect(getApplication(false)).toBe(APPLICATIONS.P1M);
    document.head.innerHTML = '';
  });

  test('Phase 1 standard', () => {
    const comment = document.createComment('COMMENT');
    document.insertBefore(comment, document.childNodes[1]);
    expect(getApplication(false)).toBe(APPLICATIONS.P1S);
    document.removeChild(comment);
  });

  test('PL AMP', () => {
    document.head.innerHTML =
      '<meta data-react-helmet="true" name="generator" content="PL ABC AMP">';
    expect(getApplication(false)).toBe(APPLICATIONS.PLA);
    document.head.innerHTML = '';
  });
});

describe('getGeneration', () => {
  test('should return PL for a PL application', () => {
    document.head.innerHTML =
      '<meta data-react-helmet="true" name="generator" content="PL ABC AMP">';
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
      '<meta data-react-helmet="true" name="generator" content="PL Everyday">';

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
