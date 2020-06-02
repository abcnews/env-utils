# @abcnews/env-utils

Utilities for identifying aspects of your code's execution environment and respectfully interacting with the DOM.

You can identify the current environment's **application**, **generation** and **tier** (see [API](#api) for what each of those are).

Each generation has its own assumptions about how and when we should modfy the DOM. Always ask for permission first, and listen for a notifications of that permission being revoked.

## Usage

```sh
npm i @abcnews/env-utils
```

Assume we're using this module in a (Presentation Layer) News Web article on our Preview website

```js
import {
  getApplication,
  getGeneration,
  getTier,
  requestDOMPermit,
} from '@abcnews/env-utils';

getApplication();
// > 'nw'

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
//     NW:  'nw',  // News Web
//     NWC: 'nwc', // News Web Chromeless
//   }
console.log(GENERATIONS);
// > {
//     P1: 'p1', // Phase 1
//     P2: 'p2', // Phase 2
//     PL: 'pl', // Presentation Layer
//   }
console.log(TIERS);
// > {
//     L: 'live',
//     P: 'preview',
//   }
```

Note: _News Web Chromeless_ is technically the _News Web_ application, but renders articles without their Header/Nav/Footer in order to sit naturally in the ABC News app. We make a distinction in this library so that both environments can be handled separately.

### `getApplication(): string`

Return the environment's **application** (Phase 1 Mobile; Phase 1 Standard; Phase 2; News Web; News Web Chromeless).

```js
import { APPLICATIONS, getApplication } from '@abcnews/env-utils';

getApplication();
// > 'nw'

getApplication() === APPLICATIONS.NW;
// > true
```

### `getGeneration(): string`

Return the environment's **generation** (Phase 1; Phase 2; Presentation Layer).

```js
import { GENERATIONS, getGeneration } from '@abcnews/env-utils';

getGeneration();
// > 'pl'

getGeneration() === GENERATIONS.PL;
// > true
```

### `getTier(): string`

Return the environment's **tier** (Live; Preview).

```js
import { TIERS, getTier } from '@abcnews/env-utils';

getTier();
// > 'preview'

getTier() === TIERS.P;
// > true
```

### `requestDOMPermit(key: string, onRevokeHandler?: Function): Promise`

Request a permit to modify the DOM. This is required before modifying the DOM on the Presentation Layer application, and will always be granted on other applications.

The `key` argument is used by Presentation Layer to activate its respective `<Decoy>` component.

An optional `onRevokeHandler` argument can be passed, which will be called if Presentation Layer chooses to deactivate the `<Decoy>` and restore its orignal DOM.

```js
import { DECOY_KEYS, requestDOMPermit } from '@abcnews/env-utils';

requestDOMPermit(DECOY_KEYS.ARTICLE, () => {
  // It is no longer safe to modify the DOM tree below the <Decoy key="article"> PL compoonent
}).then(() => {
  // It is now safe to modify the DOM tree below the <Decoy key="article"> PL compoonent
});
```

## Authors

- Colin Gourlay ([Gourlay.Colin@abc.net.au](mailto:Gourlay.Colin@abc.net.au))
