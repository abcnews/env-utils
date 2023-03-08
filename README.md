# @abcnews/env-utils

Utilities for identifying aspects of your code's execution environment and respectfully interacting with the DOM.

You can identify the current environment's **application**, **generation** and **tier** (see [API](#api) for what each of those are).

Each generation has its own assumptions about how and when we should modfy the DOM. Always ask for permission first, and listen for a notifications of that permission being revoked.

## Usage

```sh
npm i @abcnews/env-utils
```

Assume we're using this module in a article rendered by Presentation Layer News Web on our Preview website

```js
import {
  getApplication,
  getGeneration,
  getTier,
  requestDOMPermit,
} from '@abcnews/env-utils';

getApplication();
// > 'pln'

getGeneration();
// > 'pl'

getTier();
// > 'preview'

requestDOMPermit('article').then(() => {
  // It is now safe to modify the DOM tree below the <Decoy key="article"> PL compoonent
});

Note: use `#start<name> and #end<name>` inside a CoreMedia article to create a ranged decoy.
```

### Development utils

Sometimes developing locally for the PL environment is difficult due to the DOM permit system that `requestDOMPermit` provides an interface for as it relies on events fired by Presentation Layer and the existence of some specific DOM elements.

There is an additional function exported from the library — `mockDecoyActivationEvents` — which can be used to mock the decoy events and make testing using a local test page easier.

Example usage:

```js
import {
  requestDOMPermit,
  mockDecoyActivationEvents,
} from '@abcnews/env-utils';

if (process.env.NODE_ENV === 'development') {
  mockDecoyActivationEvents();
}

requestDOMPermit('key').then(/* you have a permit for 'key' */);
```

You will also need to add the DOM requestDOMPermit expects for decoys to your testing HTML. For example, a ranged decoy with the key 'key':

```html
<div data-component="Decoy" data-key="key" data-clone="true">
  <p>
    All the stuff between here is inside the decoy and fair game after a DOM
    permit is granted.
  </p>
</div>
```

## API

### `APPLICATIONS`, `GENERATIONS`, & `TIERS`

Enumerated (named) applications, generations and tiers; useful for argument abstraction & logging.

```js
import { APPLICATIONS, GENERATIONS, TIERS } from '@abcnews/env-utils';

console.log(APPLICATIONS);
// > {
//     P1M: 'p1m', // Phase 1 Mobile
//     P1S: 'p1s', // Phase 1 Standard
//     P2:  'p2',  // Phase 2
//     PLA: 'pla', // Presentation Layer ABC AMP
//     PLC: 'plc', // Presentation Layer Core
//     PLE: 'ple', // Presentation Layer Everyday
//     PLN: 'pln', // Presentation Layer News Web
//   }
console.log(GENERATIONS);
// > {
//     P1: 'p1', // Phase 1
//     P2: 'p2', // Phase 2
//     PL: 'pl', // Presentation Layer
//   }
console.log(TIERS);
// > {
//     LIVE: 'live',
//     PREVIEW: 'preview',
//   }
```

### `getApplication(): string | null`

Return the environment's **application** (Phase 1 Mobile; Phase 1 Standard; Phase 2; Presentation Layer ABC AMP; Presentation Layer Core; Presentation Layer Everyday; Presentation Layer News Web) as a string value from the `APPLICATIONS` enum, or `null` if the application couldn't be determined.

```js
import { APPLICATIONS, getApplication } from '@abcnews/env-utils';

getApplication();
// > 'pln'

getApplication() === APPLICATIONS.PLN;
// > true
```

Applications are currently determined by success/failure of selecting DOM nodes in the document, which hint at the technology used to render them on the server.

### `getGeneration(): string | null`

Return the environment's **generation** (Phase 1; Phase 2; Presentation Layer) as a string value from the `GENERATIONS` enum, or `null` if the generation couldn't be determined.

```js
import { GENERATIONS, getGeneration } from '@abcnews/env-utils';

getGeneration();
// > 'pl'

getGeneration() === GENERATIONS.PL;
// > true
```

Generations are currently determined by categorising detected applications.

### `getTier(): string | null`

Return the environment's **tier** (Live; Preview) as a string value from the `TIERS` enum, or `null` if the tier couldn't be determined.

```js
import { TIERS, getTier } from '@abcnews/env-utils';

getTier();
// > 'preview'

getTier() === TIERS.PREVIEW;
// > true
```

Tiers are currently determined by comparing `window.location.hostname` to domains that tiers are potentially served from.

### `requestDOMPermit(key: string, onRevokeHandler?: Function): Promise<true|HTMLElement[]>`

Request a permit to modify the DOM.

This is advised before modifying the DOM on Presentation Layer generation applications (as they are controlled by React, and will almost certainly undo your own changes).

DOM modification is usually safe on older generation applications, but permits should be requested anyway, for the sake of consistency.

The `key` argument is used by Presentation Layer to activate its respective `<Decoy>` components.

An optional `onRevokeHandler` argument can be passed, which will be called if Presentation Layer chooses to deactivate `<Decoy>`s and restore their orignal DOM.

Note: `key` values may be any `[a-z]` string, but the Presentation Layer News Web application provides several pre-determined values, which this library exposes as `DECOY_KEYS`.

```js
import { DECOY_KEYS, requestDOMPermit } from '@abcnews/env-utils';

requestDOMPermit(DECOY_KEYS.PAGE, () => {
  // It is no longer safe to modify the DOM tree below <Decoy listenKey="page"> PL compoonents
}).then(() => {
  // It is now safe to modify the DOM tree below <Decoy listenKey="page"> PL compoonents
});
```

The returned promise resolves differently depending on the `GENERATION` on which it's running. On Presentation Layer sites the promise will resolve with an array of `HTMLElement` references for all the nodes where the decoy was activated. On prior generations, it will resolve with `true`.

The promise will be rejected after 5 seconds if all expected decoys haven't been activated. Additionally, the library will attempt to undo any successful activations by sending another request to PL to deactivate decoys with the given key.

### `whenDOMReady(): Promise<void>`

A promise that resolves when the DOM is ready. On Presentation Layer documents the DOM isn't considered ready until after the React tree is rehydrated.

### `whenOdysseyLoaded(): Promise<window.__ODYSSEY__>`

A promise that resolves when Odyssey is finished loading. This will resolve with a reference to the Odyssey API.

## Development

This repo uses tsdx for development and np for releases.

Everything you need should be in the npm scripts:

```bash
npm start
npm test
npm run release
```

Running tests requires some environment variables be set. The canonical version of these env vars are stored as secrets in GitHub, but if you need them to run tests locally, chat to one of the authors listed below.

## Authors

- Colin Gourlay ([Gourlay.Colin@abc.net.au](mailto:Gourlay.Colin@abc.net.au))
- Simon Elvery ([elvery.simon@abc.net.au](mailto:elvery.simon@abc.net.au))
