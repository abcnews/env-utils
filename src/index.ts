import { prefersReducedMotion } from './prefersReducedMotion';
import { prefersColorScheme } from './prefersColorScheme';

export {
  prefersReducedMotion,
  prefersColorScheme,
  prefersColorScheme as prefersColourScheme,
};

export enum APPLICATIONS {
  PLC = 'Presentation Layer Core',
  PLN = 'Presentation Layer News',
}

export enum GENERATIONS {
  PL = 'Presentation Layer',
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
  /** When the requested decoy range is safe to use. */
  DA = 'decoyActive',
  DI = 'decoyInactive',
  /**
   * Fire this event to request a decoy range inside an element.
   *
   * PL takes this element, clones the content, and detaches any React rendering
   * so it becomes completely static.
   *
   * Once the decoy is safe to use, PL fires a decoyActive event.
   */
  D = 'decoy',

  /**
   * Fire this event once you've finished rendering in the decoty to allow PL to portal components back
   * into the DOM.
   *
   * These are known as "islands" and include things like expandable cards, side by side components, etc.
   *
   * These components get mounted into [data-island] containers.
   */
  DD = 'decoyRendered',
}

type DOMPermit = {
  key: string;
  onRevokeHandler?: () => void;
};

type DecoyActivationRequests = {
  [key: string]: Promise<HTMLElement[]>;
};

interface DecoyEventDetail {
  key: string;
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
    [PresentationLayerCustomEvents.D]: CustomEvent<DecoyEventDetail>;
  }
  interface Window {
    __ODYSSEY__?: unknown;
    articleHydrated?: boolean;
  }
}

// Shared constants & functions
const isPartialInHostname = (partialHostname: string): boolean =>
  window.location.hostname.indexOf(partialHostname) > -1;

const areAnyPartialsInHostname = (partialHostnames: string[]): boolean =>
  !!partialHostnames.find(isPartialInHostname);

const isSelectable = (selector: string): boolean =>
  !!document.querySelector(selector);

const isGeneratedBy = (generatorName: string): boolean =>
  isSelectable(`[name="generator"][content="${generatorName}"]`);

const memoize = <T>(fn: (cache?: boolean) => T) => {
  let cached: T;
  return (cache = true) =>
    cache
      ? typeof cached === 'undefined'
        ? ((cached = fn(cache)), cached)
        : cached
      : fn(cache);
};

// Application detection
// * Because this code can potentially be executed by a <script> in the
//   document's <head>, we can't rely on <body> (or late <head>) content to
//   identify each application.
//   <meta name="generator"> tag with a distinct "content" property value.
// * Checks are made in order of likelihood, to save unnecessary DOM reads
export const getApplication = memoize(
  function _getApplication(): APPLICATIONS | null {
    return isGeneratedBy('PL NEWS WEB')
      ? APPLICATIONS.PLN
      : isGeneratedBy('PL CORE')
        ? APPLICATIONS.PLC
        : null;
  }
);

// Generation determination
// * Every generation encompasses one or more applications
// * As of December 2025 there is only one generation (Presentation Layer) in production
export const getGeneration = memoize(function _getGeneration(
  cache = true
): GENERATIONS | null {
  switch (getApplication(cache)) {
    case APPLICATIONS.PLC:
    case APPLICATIONS.PLN:
      return GENERATIONS.PL;
    default:
      return null;
  }
});

// Tier detection
// * Tiers can be detected (depending on the generation) by matching unique hostnames
export const getTier = memoize(function _getTier(): TIERS | null {
  return areAnyPartialsInHostname(['presentation-layer.abc'])
    ? TIERS.PREVIEW
    : areAnyPartialsInHostname(['www.abc', 'newsapp.abc'])
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

// Allow us to check for when Odyssey is loaded
export const whenOdysseyLoaded = new Promise(resolve => {
  window.__ODYSSEY__
    ? resolve(window.__ODYSSEY__)
    : window.addEventListener('odyssey:api', () => resolve(window.__ODYSSEY__));
});

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

const emitDecoyEvent = (
  type: PresentationLayerCustomEvents,
  key: string,
  active?: boolean
) => {
  window.dispatchEvent(
    new CustomEvent<DecoyEventDetail>(type, {
      detail: { key, active },
    })
  );
};

/**
 * Obtain a permit to modify the requested DOM node.
 *
 * The workflow is:
 * 1. wait for domready
 * 2. fire a `decoy` event with the name of the node we want to use
 * 3. PL picks up that event, clones the DOM inside the decoy to make it static, then fires a `decoyActive` event
 * 4. on decoyActive we are safe to modify the DOM inside our node.
 * 5. After we're done, fire the decoyRendered event to let PL portal any dynamnic components back into the decoy area.
 *
 * @param keyOrElement
 * @param onRevokeHandler
 * @returns
 */
export function requestDOMPermit(
  key: string,
  onRevokeHandler?: () => void
): Promise<true | HTMLElement[]> {
  return whenDOMReady.then(
    () =>
      new Promise(resolve => {
        // Revokable permits are only required in PL
        if (getGeneration(false) !== GENERATIONS.PL) {
          return resolve(true);
        }

        if (!isGlobalRevocationHandlerBound) {
          isGlobalRevocationHandlerBound = true;
          bindGlobalRevocationHandler();
        }

        // If this is the first permit requested for a location, we need
        // to request a decoy activation before granting the permit
        if (typeof decoyActivationRequests[key] === 'undefined') {
          decoyActivationRequests[key] = new Promise<HTMLElement[]>(
            (resolve, reject) => {
              const expectedActivations = document.querySelectorAll(
                `[data-key=${key}]`
              ).length;

              const activatedElements: HTMLElement[] = [];

              // Handler should only run once per correct key, then stop listening
              function onDecoyActiveHandler({ detail }: DecoyEvent) {
                if (detail.key !== key) {
                  return;
                }

                Array.from(
                  document.querySelectorAll<HTMLDivElement>(
                    `[data-key=${key}][data-clone=true]:not([data-claimed=true])`
                  )
                ).forEach(el => {
                  el.dataset['claimed'] = 'true';
                  activatedElements.push(el);
                });

                if (expectedActivations > activatedElements.length) {
                  return;
                }

                window.clearTimeout(timeoutId);
                window.removeEventListener(
                  PresentationLayerCustomEvents.DA,
                  onDecoyActiveHandler
                );
                const onRender = () =>
                  emitDecoyEvent(PresentationLayerCustomEvents.DD, key, true);
                Object.defineProperty(activatedElements, 'onRender', {
                  value: onRender,
                  enumerable: false,
                  writable: true,
                  configurable: true,
                });
                resolve(activatedElements);
                new Promise(() =>
                  console.log(
                    'after requestDOMPermit - async events should fire after odyssey renders'
                  )
                );
              }

              const timeoutId = window.setTimeout(() => {
                window.removeEventListener(
                  PresentationLayerCustomEvents.DA,
                  onDecoyActiveHandler
                );
                emitDecoyEvent(PresentationLayerCustomEvents.D, key, false);
                reject(new Error(`Decoy activation timeout for key '${key}'`));
              }, 5000);

              window.addEventListener(
                PresentationLayerCustomEvents.DA,
                onDecoyActiveHandler
              );

              // Request decoy activation by dispatching an event that PL will be listening for
              emitDecoyEvent(PresentationLayerCustomEvents.D, key, true);
            }
          );
        }

        // Grant the permit if/when the decoy is active, and store a
        // reference so that a revocation handler can be called
        // when PL decides to deactivate the decoy
        decoyActivationRequests[key].then(els => {
          domPermitsGranted = domPermitsGranted.concat([
            { key, onRevokeHandler },
          ]);
          resolve(els);
        });
      })
  );
}

export const mockDecoyActivationEvents = (generator = 'PL NEWS WEB') => {
  console.warn(
    "`mockDecoyActivationEvents()` should only ever be called in development. If you're seeing this in production, please check your code!"
  );

  function decoyEventMockHandler({ detail: { active, key } }: DecoyEvent) {
    if (active === true) {
      // Add the required data to the requested element
      const selector = `[data-key="${key}"]`;
      const decoyTargetEl = document.querySelector<HTMLElement>(selector);
      if (decoyTargetEl) {
        decoyTargetEl.dataset.clone = 'true';
      } else {
        console.warn(`Decoy target for key ${selector} missing`);
      }

      // emit a success event
      window.dispatchEvent(
        new CustomEvent<DecoyEventDetail>(PresentationLayerCustomEvents.DA, {
          detail: { key },
        })
      );
    }
  }
  const meta = document.createElement('meta');
  meta.name = 'generator';
  meta.content = generator;
  document.querySelector('head')?.append(meta);
  window.articleHydrated = true;
  window.addEventListener(
    PresentationLayerCustomEvents.D,
    decoyEventMockHandler
  );
};
