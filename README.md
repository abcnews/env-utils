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
//     PLL: 'pll', // Presentation Layer Life
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

Return the environment's **application** (Phase 1 Mobile; Phase 1 Standard; Phase 2; Presentation Layer ABC AMP; Presentation Layer Core; Presentation Layer Life; Presentation Layer News Web) as a string value from the `APPLICATIONS` enum, or `null` if the application couldn't be determined.

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

### `requestDOMPermit(key: string, onRevokeHandler?: Function): Promise`

Request a permit to modify the DOM.

This is advised before modifying the DOM on Presentation Layer generation applications (as they are controlled by React, and will almost certainly undo your own changes).

DOM modification is usually safe on older generation applications, but permits should be requested anyway, for the sake of consistency.

The `key` argument is used by Presentation Layer to activate its respective `<Decoy>` component.

An optional `onRevokeHandler` argument can be passed, which will be called if Presentation Layer chooses to deactivate the `<Decoy>` and restore its orignal DOM.

```js
import { DECOY_KEYS, requestDOMPermit } from '@abcnews/env-utils';

requestDOMPermit(DECOY_KEYS.PAGE, () => {
  // It is no longer safe to modify the DOM tree below the <Decoy key="page"> PL compoonent
}).then(() => {
  // It is now safe to modify the DOM tree below the <Decoy key="page"> PL compoonent
});
```

## Authors

- Colin Gourlay ([Gourlay.Colin@abc.net.au](mailto:Gourlay.Colin@abc.net.au))
