# @orkestrel/timeout

A typed, **controllable** `setTimeout` wrapper — a deadline handle that
exposes an `AbortSignal` which fires on expiry, for racing against work.
Deliberately small: `start()` arms the deadline, `clear()` cancels it without
firing, and re-`start()`ing a handle after expiry reuses it for a fresh
deadline without re-construction. An optional parent `signal` links in without
inheriting `AbortSignal.any` semantics — a parent abort during the timing
window _clears_ the timeout (it never expires) rather than firing it. Part of
the `@orkestrel` line.

## Install

```sh
npm install @orkestrel/timeout
```

## Requirements

- Node.js >= 24
- ESM-only (no CommonJS build)

## Usage

```ts
import { createTimeout } from '@orkestrel/timeout'

const timeout = createTimeout({ ms: 5_000 })
timeout.start()
const result = await Promise.race([
	work(),
	new Promise((_, reject) =>
		timeout.signal.addEventListener('abort', () => reject(new Error('timed out')), {
			once: true,
		}),
	),
])
timeout.clear() // work finished first — cancel the deadline
```

`createTimeout(options)` (or `new Timeout(options)`) returns a
`TimeoutInterface`. `options.ms` is the deadline in milliseconds (a
non-negative finite number — the host `setTimeout` clamps a negative, `NaN`,
or over-2^31-1 value rather than throwing); an optional `options.id` labels the
handle for tracing (defaults to a random UUID); an optional `options.signal`
links a parent `AbortSignal` whose abort clears the timeout while a timer is
armed. `start()` arms the deadline: on expiry `expired` flips `true` and
`signal` fires. `clear()` cancels a pending expiry without firing `signal` and
resets `expired` back to `false`. The handle is a pure functional primitive —
no `Emitter`, no events.

## Guide

For the full surface — the deadline lifecycle, parent-signal linking, and
reuse semantics — see [`guides/src/timeout.md`](guides/src/timeout.md).

## Package

Published as a single typed entry point per the `exports` field in
`package.json`.

## License

MIT © [Orkestrel](https://github.com/orkestrel) — see [LICENSE](./LICENSE).
