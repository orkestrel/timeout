# @orkestrel/timeout

A typed, **controllable** `setTimeout` wrapper — a deadline handle that
exposes an `AbortSignal` which fires on expiry, for racing against work.
Deliberately small: `start()` arms the deadline, `clear()` cancels it without
firing, and calling `start()` again after expiry reuses the handle for a
fresh deadline without re-construction. An optional parent `signal` links in
without inheriting `AbortSignal.any` semantics — a parent abort during the
timing window _clears_ the timeout (it never expires) rather than firing it.
Part of the `@orkestrel` line.

## Install

```sh
npm install @orkestrel/timeout
```

## Requirements

- Node.js >= 22.12.0, matching the `engines` field in `package.json`
- ESM (`import`) and CommonJS (`require`) through the `exports` field

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
`TimeoutInterface`. `options.ms` must be an integer from `0` through
`MAX_TIMEOUT_MS` (`2_147_483_647`), inclusive; invalid values throw a coded
`ContractError` before any timer lifecycle begins. Zero is intentionally a
next-turn deadline. An optional string `options.id` labels the handle for
tracing and defaults to a random UUID. An optional `options.signal` must be a
genuine native `AbortSignal`; its abort clears an armed timeout without
expiring it, aborting the timeout's own signal, or forwarding its reason.
`start()` arms or replaces the deadline. On expiry `expired` flips `true` and
the native `signal` aborts once. `clear()` cancels without aborting, resets
`expired`, and remains safe to call while idle. `isTimeoutDuration` and
`isTimeoutSignal` provide total validators for dynamic inputs.

Malformed or unreadable options throw with contract code `bound`. Invalid
defined `id`, `ms`, and `signal` values use `literal`, `range`, and `placement`,
respectively, with safe path, limit, and received-value context. `expired`
derives directly from the owned signal's `aborted` state.
`validateTimeoutOptions` exposes the same strict construction boundary as a
once-read helper that returns a fresh copy without absent optional keys.

## Guide

For the full surface — the deadline lifecycle, parent-signal linking, and
reuse semantics — see [`guides/timeout.md`](guides/timeout.md).

## Package

Published as a single typed entry point per the `exports` field in
`package.json`.

## License

MIT © [Orkestrel](https://github.com/orkestrel) — see [LICENSE](./LICENSE).
