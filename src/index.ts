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

type DecoyActivationRequests = {
  [key in DECOY_KEYS]?: Promise<void>;
};

interface DecoyEventDetail {
  key: DECOY_KEYS;
  active?: boolean;
}

interface DecoyEvent extends CustomEvent {
  detail: DecoyEventDetail;
}

declare global {
  interface GlobalEventHandlersEventMap {
    [PresentationLayerCustomEvents.AH]: CustomEvent;
    [PresentationLayerCustomEvents.DA]: CustomEvent<DecoyEventDetail>;
    [PresentationLayerCustomEvents.DI]: CustomEvent<DecoyEventDetail>;
  }
}

// Application detection
// * Every application has uniquely selectable elements in the document's <head>
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
const HOSTNAME = window.location.hostname;
const isPartialInHostname = (partialHostname: string): boolean =>
  HOSTNAME.indexOf(partialHostname) > -1;
const IS_TIER_PREVIEW = isPartialInHostname(
  IS_GENERATION_PRESENTATION_LAYER
    ? 'preview.presentation-layer'
    : 'nucwed.aus.aunty'
);
const IS_TIER_LIVE = !![
  'www.abc',
  'mobile.abc',
  'bigted.abc',
  'newsapp.abc',
].find(isPartialInHostname);

// Allow us to read the detected tier
export function getTier(): TIERS | null {
  return IS_TIER_PREVIEW ? TIERS.PREVIEW : IS_TIER_LIVE ? TIERS.LIVE : null;
}

// Store references to PL decoy activation requests and granted DOM permits
const decoyActivationRequests: DecoyActivationRequests = {};
let domPermitsGranted: DOMPermit[] = [];

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
        if (decoyActivationRequests[key] == null) {
          decoyActivationRequests[key] = new Promise<void>(resolve => {
            // Handler should only run once per correct key, then stop listening
            function onDecoyActiveHandler({ detail }: DecoyEvent) {
              if (detail.key !== key) {
                return;
              }

              window.removeEventListener(
                PresentationLayerCustomEvents.DA,
                onDecoyActiveHandler
              );
              resolve();
            }

            window.addEventListener(
              PresentationLayerCustomEvents.DA,
              onDecoyActiveHandler
            );

            // Request decoy activation by dispatching an event that PL will be listening for
            window.dispatchEvent(
              new CustomEvent<DecoyEventDetail>('decoy', {
                detail: { key, active: true },
              })
            );
          });
        }

        // Grant the permit if/when the decoy is active, and store a
        // reference so that a revocation handler can be called
        // when PL decides to deactivate the decoy
        decoyActivationRequests[key]!.then(() => {
          domPermitsGranted = domPermitsGranted.concat([
            { key, onRevokeHandler },
          ]);
          resolve();
        });
      })
  );
}

if (IS_GENERATION_PRESENTATION_LAYER) {
  // Listen for PL decoy deactivations and revoke previously granted DOM permits
  window.addEventListener(PresentationLayerCustomEvents.DI, ({ detail }) => {
    domPermitsGranted = domPermitsGranted.filter(({ key, onRevokeHandler }) => {
      if (key !== detail.key) {
        return true;
      }

      if (typeof onRevokeHandler === 'function') {
        onRevokeHandler();
      }

      return false;
    });
  });
}
