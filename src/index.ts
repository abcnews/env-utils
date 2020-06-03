export enum APPLICATIONS {
  P1M = 'p1m',
  P1S = 'p1s',
  P2 = 'p2',
  NW = 'nw',
  NWC = 'nwc',
}

export enum GENERATIONS {
  P1 = 'p1',
  P2 = 'p2',
  PL = 'pl',
}

export enum TIERS {
  LIVE = 'live',
  PREVIEW = 'preview',
}

export enum DECOY_KEYS {
  ARTICLE = 'article',
  BODY = 'body',
  PAGE = 'page',
}

enum PresentationLayerCustomEvents {
  AH = 'articleHydrated',
  DA = 'decoyActive',
  DI = 'decoyInactive',
}

type DOMPermit = {
  key: DECOY_KEYS;
  onRevokeHandler?: Function;
};

type presentationLayerDecoyActivationRequests = {
  [key in DECOY_KEYS]?: Promise<void>;
};

interface ExternallyResolvablePromise extends Promise<void> {
  _resolve: Function;
}

interface DecoyEventDetail {
  key: DECOY_KEYS;
}

declare global {
  interface GlobalEventHandlersEventMap {
    [PresentationLayerCustomEvents.AH]: CustomEvent;
    [PresentationLayerCustomEvents.DA]: CustomEvent<DecoyEventDetail>;
    [PresentationLayerCustomEvents.DI]: CustomEvent<DecoyEventDetail>;
  }
}

// Application detection
// * Exact applications are determined by selecting uniqe parts of the DOM
// * Abstract applications can determined by consulting sets of exact applications
const isSelectable = (selector: string): boolean =>
  !!document.querySelector(selector);
const IS_APPLICATION_PHASE_1_MOBILE = isSelectable(
  'body.platform-mobile:not(.platform-standard)'
);
const IS_APPLICATION_PHASE_1_STANDARD = isSelectable(
  'body.platform-standard:not(.platform-mobile)'
);
const IS_APPLICATION_PHASE_2 = isSelectable('meta[content="WCMS FTL"]');
const IS_APPLICATION_PRESENTATION_LAYER_NEWS_WEB = isSelectable(
  'link[data-chunk="page.ArticleDetail"]'
);
const IS_APPLICATION_PRESENTATION_LAYER_NEWS_WEB_APP = isSelectable(
  'link[data-chunk="page.AppArticleDetail"]'
);

// Allow us to read the detected application
export function getApplication(): APPLICATIONS | null {
  return IS_APPLICATION_PRESENTATION_LAYER_NEWS_WEB
    ? APPLICATIONS.NW
    : IS_APPLICATION_PRESENTATION_LAYER_NEWS_WEB_APP
    ? APPLICATIONS.NWC
    : IS_APPLICATION_PHASE_2
    ? APPLICATIONS.P2
    : IS_APPLICATION_PHASE_1_MOBILE
    ? APPLICATIONS.P1M
    : IS_APPLICATION_PHASE_1_STANDARD
    ? APPLICATIONS.P1S
    : null;
}

// Generation determination
// * Every generation encompasses one or more applications
const IS_GENERATION_PHASE_1 =
  IS_APPLICATION_PHASE_1_MOBILE || IS_APPLICATION_PHASE_1_STANDARD;
const IS_GENERATION_PHASE_2 = IS_APPLICATION_PHASE_2;
const IS_GENERATION_PRESENTATION_LAYER =
  IS_APPLICATION_PRESENTATION_LAYER_NEWS_WEB_APP ||
  IS_APPLICATION_PRESENTATION_LAYER_NEWS_WEB;

// Allow us to read the determined generation
export function getGeneration(): GENERATIONS | null {
  return IS_GENERATION_PRESENTATION_LAYER
    ? GENERATIONS.PL
    : IS_GENERATION_PHASE_2
    ? GENERATIONS.P2
    : IS_GENERATION_PHASE_1
    ? GENERATIONS.P1
    : null;
}

// Tier detection
// * Tiers can be detected (depending on the generation) by matching unique hostnames
const IS_TIER_PREVIEW = (hostname =>
  hostname.indexOf(
    IS_GENERATION_PRESENTATION_LAYER
      ? 'preview.presentation-layer'
      : 'nucwed.aus.aunty'
  ) > -1)(window.location.hostname);
const IS_TIER_LIVE = !IS_TIER_PREVIEW;

// Allow us to read the deteted tier
export function getTier(): TIERS | null {
  return IS_TIER_PREVIEW ? TIERS.PREVIEW : IS_TIER_LIVE ? TIERS.LIVE : null;
}

// Store references to PL decoy activation requests and granted DOM permits
const presentationLayerDecoyActivationRequests: presentationLayerDecoyActivationRequests = {};
const domPermitsGranted: DOMPermit[] = [];

// Allow us to check when the document has fully loaded (and PL's DOM is hydrated, if present)
export const whenDOMReady: Promise<void> = new Promise(resolve =>
  (function advanceAfterReadyStateComplete() {
    /in/.test(document.readyState)
      ? setTimeout(advanceAfterReadyStateComplete, 9)
      : getGeneration() !== GENERATIONS.PL ||
        PresentationLayerCustomEvents.AH in window
      ? resolve()
      : window.addEventListener(PresentationLayerCustomEvents.AH, () =>
          resolve()
        );
  })()
);

// Allow us to obtain a permit to modify the DOM at various points
export function requestDOMPermit(
  key: DECOY_KEYS,
  onRevokeHandler?: Function
): Promise<true | void> {
  return whenDOMReady.then(
    () =>
      new Promise(resolve => {
        // Revokable permits are only required in PL
        if (getGeneration() !== GENERATIONS.PL) {
          return resolve(true);
        }

        // If this is the first permit requested for a location, we need
        // to request a decoy activation before granting the permit
        if (presentationLayerDecoyActivationRequests[key] === null) {
          const presentationLayerDecoyActivationRequest = new Promise<void>(
            resolve => {
              presentationLayerDecoyActivationRequest._resolve = resolve;
              window.dispatchEvent(
                new CustomEvent('decoy', { detail: { key, active: true } })
              );
            }
          ) as ExternallyResolvablePromise;
          presentationLayerDecoyActivationRequests[
            key
          ] = presentationLayerDecoyActivationRequest;
        }

        // Grant the permit when the decoy is active, and store a
        // reference so that the revocation handler can be called
        // when PL decides to deactivate the decoy
        (presentationLayerDecoyActivationRequests[
          key
        ] as ExternallyResolvablePromise).then(() => {
          domPermitsGranted.push({ key, onRevokeHandler });
          resolve();
        });
      })
  );
}

// Set up global events for PL decoy management
if (IS_GENERATION_PRESENTATION_LAYER) {
  // Listen for PL decoy activations and resolve activation requests
  // (allowing current and subsequent DOM permits to be granted)
  window.addEventListener(PresentationLayerCustomEvents.DA, ({ detail }) => {
    const presentationLayerDecoyActivationRequest = presentationLayerDecoyActivationRequests[
      detail.key
    ] as ExternallyResolvablePromise;

    if (presentationLayerDecoyActivationRequest != null) {
      presentationLayerDecoyActivationRequest._resolve();
    }
  });

  // Listen for PL decoy deactivations and revoke previously granted DOM permits
  window.addEventListener(PresentationLayerCustomEvents.DI, ({ detail }) =>
    domPermitsGranted.forEach(
      ({ key, onRevokeHandler }) =>
        key === detail.key &&
        typeof onRevokeHandler === 'function' &&
        onRevokeHandler()
    )
  );
}
