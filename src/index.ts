export enum APPLICATIONS {
  P1M = 'p1m',
  P1S = 'p1s',
  P2 = 'p2',
  PLA = 'pla',
  PLC = 'plc',
  PLL = 'pll',
  PLN = 'pln',
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

type AGTN = APPLICATIONS | GENERATIONS | TIERS | null;

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

// Shared constants & functions
const HOSTNAME = window.location.hostname;
const isPartialInHostname = (partialHostname: string): boolean =>
  HOSTNAME.indexOf(partialHostname) > -1;
const areAnyPartialsInHostname = (partialHostnames: string[]): boolean =>
  !!partialHostnames.find(isPartialInHostname);
const isSelectable = (selector: string): boolean =>
  !!document.querySelector(selector);
const isGeneratedBy = (generatorName: string): boolean =>
  isSelectable(`[name="generator"][content="${generatorName}"]`);
const hasIconFrom = (slug: string): boolean =>
  isSelectable(`[rel*="icon"][href^="/${slug}/"]`);
const memoize = (fn: () => AGTN) => {
  let cached: AGTN;
  return () =>
    typeof cached === 'undefined' ? ((cached = fn()), cached) : cached;
};

// Application detection
// * Because this code can potentially be executed by a <script> in the
//   document's <head>, we can't rely on <body> (or late <head>) content to
//   identify each application.
// * Phase 1 Standard is the only application that uses Internet Explorer's
//   conditional comments to use an alternative opening <html> tag.
// * Phase 1 Mobile is the only application with a
//   <meta name="HandheldFriendly"> tag.
// * Phase 2 and most Presentation Layer applications have a
//   <meta name="generator"> tag with a distinct "content" property value.
// * Presentation Layer's News Web application doesn't have a
//   <meta name="generator"> tag with a distinct "content" property value
//   when rendering ABC News App articles, so we look for an icon <link>
//   with a distinct asset path.
// * Checks are made in order of likelihood, to save unnecessary DOM reads
export const getApplication = memoize(
  function _getApplication(): APPLICATIONS | null {
    return hasIconFrom('news-web')
      ? APPLICATIONS.PLN
      : isSelectable('[name="HandheldFriendly"]')
      ? APPLICATIONS.P1M
      : document.childNodes[1].nodeType === Node.COMMENT_NODE
      ? APPLICATIONS.P1S
      : isGeneratedBy('WCMS FTL')
      ? APPLICATIONS.P2
      : isGeneratedBy('PL LIFE')
      ? APPLICATIONS.PLL
      : isGeneratedBy('PL CORE')
      ? APPLICATIONS.PLC
      : isGeneratedBy('PL ABC AMP')
      ? APPLICATIONS.PLA
      : null;
  }
);

// Generation determination
// * Every generation encompasses one or more applications
export const getGeneration = memoize(
  function _getGeneration(): GENERATIONS | null {
    switch (getApplication()) {
      case APPLICATIONS.PLA:
      case APPLICATIONS.PLC:
      case APPLICATIONS.PLL:
      case APPLICATIONS.PLN:
        return GENERATIONS.PL;
      case APPLICATIONS.P2:
        return GENERATIONS.P2;
      case APPLICATIONS.P1M:
      case APPLICATIONS.P1S:
        return GENERATIONS.P1;
      default:
        return null;
    }
  }
);

// Tier detection
// * Tiers can be detected (depending on the generation) by matching unique hostnames
export const getTier = memoize(function _getTier(): TIERS | null {
  return areAnyPartialsInHostname([
    'nucwed.aus.aunty',
    'preview.presentation-layer',
  ])
    ? TIERS.PREVIEW
    : areAnyPartialsInHostname([
        'www.abc',
        'mobile.abc',
        'bigted.abc',
        'newsapp.abc',
      ])
    ? TIERS.LIVE
    : null;
});

// Store references to PL decoy activation requests and granted DOM permits
const decoyActivationRequests: DecoyActivationRequests = {};
let domPermitsGranted: DOMPermit[] = [];
let isGlobalRevocationHandlerBound = false;

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

// Listen for PL decoy deactivations and revoke previously granted DOM permits
function bindGlobalRevocationHandler() {
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

        if (!isGlobalRevocationHandlerBound) {
          isGlobalRevocationHandlerBound = true;
          bindGlobalRevocationHandler();
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
