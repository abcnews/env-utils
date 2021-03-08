import {
  APPLICATIONS,
  ENVIRONMENTS,
  getApplication,
  getEnvironment,
  getTier,
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
  });
});
