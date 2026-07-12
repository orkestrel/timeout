# Timeouts

> The deadline primitive: a controllable `setTimeout` wrapper that exposes an `AbortSignal` which fires when the timeout **expires**. A `Timeout` carries a trace `id`, a deadline `ms`, and `start()` / `clear()` controls — arm the deadline, then race its `signal` against work to bound how long that work may run. The time-bound half of the substrate's time-and-cancellation pair (with [aborts](aborts.md)): every async layer — workers, the runner, the future agent loop — caps work with a deadline expressed as a `signal`, the exact same shape they already accept for cancellation. Deliberately thin: it is not a scheduler, not a debounce/throttle, not a retry policy — just one `setTimeout` made re-armable, clearable, and parent-linkable. Pure and functional — **event-free for now** (no Emitter wiring; the observability pass owns that). Source: [`src/core/timeouts`](../../src/core/timeouts). Surfaced through the `@src/core` barrel.

## Surface

Create a deadline handle, `start()` it, and hand its `signal` to deadline-aware work — `clear()` the deadline if the work finishes first:

```ts
import { createTimeout } from '@src/core'

const timeout = createTimeout({ ms: 5_000 })
timeout.start() // arm the deadline

// `signal` aborts on expiry — pass it anywhere a native AbortSignal is accepted:
const response = await fetch(url, { signal: timeout.signal })

timeout.clear() // work finished in time — cancel the pending deadline so it never fires
```

`start()` arms the deadline; on expiry `expired` flips `true` and `signal` fires (so the `fetch` above rejects with an `AbortError`). `clear()` cancels a pending deadline without firing and resets `expired` back to `false`. Re-`start()` after an expiry reuses the same handle on a fresh `signal` — no re-construction. Pass a parent `signal` to make a parent abort **clear** the timeout (so it can no longer expire). Pass `id` to label a handle for tracing, or let it default to a random UUID. `ms` must be a non-negative finite number — the host `setTimeout` clamps a negative or `NaN` value to roughly `0` (firing on the next macrotask) rather than throwing.

### Factories

| API             | Kind     | Summary                                                                                   |
| --------------- | -------- | ----------------------------------------------------------------------------------------- |
| `createTimeout` | function | Create a `TimeoutInterface` for `ms`, optionally with a trace `id` and a parent `signal`. |

### Entities

| API       | Kind  | Summary                                                                             |
| --------- | ----- | ----------------------------------------------------------------------------------- |
| `Timeout` | class | A controllable `setTimeout` wrapper whose `signal` fires when the deadline expires. |

### Types

| Type               | Kind      | Shape                                                                                                |
| ------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| `TimeoutOptions`   | interface | `{ id?: string; ms: number; signal?: AbortSignal }` — options for `createTimeout` / the constructor. |
| `TimeoutInterface` | interface | `id` / `ms` / `signal` / `expired` data members + the `start` / `clear` methods.                     |

The `id`, `ms`, `signal`, and `expired` members of `TimeoutInterface` are `readonly` data members (Surface rows, above) — its call-signature methods are documented under [Methods](#methods).

## Methods

The public methods of `TimeoutInterface` — every call-signature member listed (its `readonly` data members `id` / `ms` / `signal` / `expired` stay Surface rows). `Timeout` implements the interface exactly, so this doubles as the class's instance-method surface (AGENTS §22).

#### `TimeoutInterface`

`start` / `clear` are the §10 begin/restart and reset-without-firing pair: `start` arms (or re-arms) the deadline; `clear` cancels a pending deadline without firing it.

| Method  | Returns | Behavior                                                                                                    |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `start` | `void`  | Arm the deadline for `ms`; on expiry flip `expired` and fire `signal`. Re-arms a fresh run after an expiry. |
| `clear` | `void`  | Cancel a pending deadline WITHOUT firing `signal`, and reset `expired` back to `false`.                     |

## Contract

These invariants hold across `src/core/timeouts` ↔ `timeouts.md`:

1. **DOC ↔ SOURCE bijection.** Every `function` / `class` / `interface` / `type` row in the `## Surface` tables is a real export of the timeouts module, and every export appears as a Surface row — exhaustive, both directions (AGENTS §22).
2. **`setTimeout` wrapper.** `start()` arms a `setTimeout(ms)`; on expiry the handle flips `expired` to `true` and aborts a private controller, so `signal` fires. The deadline runs once per `start()`.
3. **`clear` resets without firing (§10).** `clear()` cancels a pending deadline — `clearTimeout` on the pending handle — without firing `signal`, and resets `expired` back to `false` (the §10 reset). If the deadline had already expired, `clear()` swaps in a fresh controller so the cleared handle reports `expired === false` AND a non-aborted `signal`, consistently. `clear()` with no active timer (before any `start()`, or twice) is a safe no-op.
4. **Reusable across runs.** Re-`start()` after an expiry swaps in a fresh controller and resets `expired`, so `signal` / `expired` reflect the NEW run (the post-expiry `signal` is a different `AbortSignal` from the prior run's). The handle is reusable without re-construction.
5. **Parent CLEARS, never expires.** With a parent `signal`, a parent abort clears the timeout: any pending deadline is cancelled and a later `start()` is a no-op once the parent has aborted — so the parent linking can only PREVENT expiry, never cause it. The parent listener lives only for the active timing window — attached on `start()`, removed on expiry or `clear()` — so an idle handle holds no parent listener (no accumulation when many handles share one long-lived parent), and a parent abort arriving AFTER a legitimate expiry has no listener to run and so cannot un-expire it.
6. **Traceable identity.** `id` is a stable string for the handle's lifetime — caller-supplied via `options.id`, or a `crypto.randomUUID()` default that is unique across instances. `ms` is the configured deadline, exposed read-only.
7. **Event-free (for now).** A pure functional primitive: no Emitter, no `EventMap`, no `on` hook. Observability is a separate deferred pass (the ROADMAP), so the surface above stays minimal.
8. **DOC ↔ SOURCE method bijection.** The `## Methods` table lists exactly `TimeoutInterface`'s public methods — exhaustive, both directions — and `Timeout` exposes the same public methods, no more (AGENTS §22).

## Patterns

### Race work against the deadline

The dominant use: bound how long work may run by racing it against the deadline `signal`.

```ts
import { createTimeout } from '@src/core'

async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
	const timeout = createTimeout({ ms })
	timeout.start()
	try {
		return await Promise.race([
			work,
			new Promise<T>((_, reject) =>
				timeout.signal.addEventListener('abort', () => reject(new Error('timed out')), {
					once: true,
				}),
			),
		])
	} finally {
		timeout.clear() // work won the race — cancel the pending deadline
	}
}
```

### Reuse across runs

A single handle can bound many sequential operations — `start()` before each, `clear()` when it finishes in time.

```ts
import { createTimeout } from '@src/core'

const timeout = createTimeout({ ms: 1_000 })
for (const job of jobs) {
	timeout.start()
	await runUntilExpiryOr(job, timeout.signal)
	timeout.clear() // ready the handle for the next job
}
```

### Link to a parent (cancellation clears the deadline)

Pair a timeout with an [abort](aborts.md) so a higher-level cancellation reaches it: when the parent fires, the deadline is **cleared**, never expired. This keeps the two signals from contradicting each other — a request that was cancelled reports cancellation, not a spurious timeout — and means an idle deadline can never linger and fire after its owning operation is already gone.

```ts
import { createAbort, createTimeout } from '@src/core'

const abort = createAbort({ id: 'request' })
const timeout = createTimeout({ id: 'request-deadline', ms: 30_000, signal: abort.signal })
timeout.start()

abort.abort() // clears the timeout — it can no longer expire; a later start() is a no-op
```

The link is asymmetric by design: the parent can only **prevent** expiry, never trigger it. The parent listener is attached only while a timer is armed, so many short-lived timeouts can share one long-lived parent without piling up listeners on it.

### Practices

- **`start()` then race the `signal`** — arm the deadline, then race `signal` against the work to bound it.
- **`clear()` on success** — when work finishes in time, `clear()` the pending deadline so it does not fire (a `finally` is the natural home).
- **Reuse, don't re-create** — re-`start()` a handle for the next operation rather than constructing a new `Timeout` each time.
- **Link to an abort to gate expiry** — pass a parent `signal` so cancellation prevents a stale deadline from firing.
- **No events yet** — this is a functional primitive; do not reach for an Emitter here (observability is a separate pass).

## Tests

- [`tests/guides/parity.test.ts`](../../tests/guides/src/parity.test.ts) — the `## Surface` ↔ `src/core/timeouts` bijection (value + type exports) and the `TimeoutInterface` ↔ `Timeout` method bijection.
- [`tests/src/core/timeouts/Timeout.test.ts`](../../tests/src/core/timeouts/Timeout.test.ts) — `start()` expires after `ms` (flips `expired`, fires `signal`), `clear()` before expiry never fires, `clear()` after an expiry resets `expired` to `false` (on a fresh non-aborted signal), the reuse-across-runs loop (`expired === false` at each iteration), double `start()` without `clear()` fires once cleanly, `clear()` is a safe no-op (before any `start()`, twice, with no active timer), a parent abort clears the timeout (and a no-op `start()` once the parent has aborted), a parent abort AFTER expiry does not un-expire it, a long-lived parent linking many child timeouts that all expire stays harmless when later aborted, `ms: 0` expires on the next macrotask, and `id` / `ms` are exposed. Determinism & leak-safety (fake timers, `vi.getTimerCount()`): an armed handle holds exactly one host timer; 1,000-cycle `start`/`clear` and `start`/`expire`/`start` churn never accumulates timers (the prior is cancelled, not stacked); repeated `start()` without `clear()` keeps exactly one timer; parented churn ending idle leaves the parent's abort fully inert (no listener pile-up); the timer-vs-parent race (a synchronous parent abort while armed clears the timer before it can fire); an idle parented handle holds no timer and a pre-`start()` parent abort is inert; `ms` boundaries (`1`, the ~24.8-day host max — armed to the full duration, no premature clamp); `clear()` at the exact expiry tick still suppresses firing; and `signal` identity / `expired` consistency through every transition (stable across `start`→`clear` that never fired, swapped only after a real expiry).
- [`tests/src/core/timeouts/factories.test.ts`](../../tests/src/core/timeouts/factories.test.ts) — `createTimeout` returns a working `TimeoutInterface` that arms and expires, and honors `id`.
- [`tests/src/core/integration.test.ts`](../../tests/src/core/integration.test.ts) — composition with [aborts](aborts.md): a `Timeout` parented to an `Abort`'s `signal` (the abort clears the deadline, which then never expires; without a cancel it still expires normally), a deep `Abort → Abort → Timeout` chain, and racing `Timeout.signal` against real async work via `Promise.race` (the deadline wins when work outlasts it; the work wins — and the deadline stays silent — when it finishes first or when a parent abort cancels the deadline).

## See also

- [`aborts.md`](aborts.md) — the cancellation primitive; the time-and-cancellation pair's other half (a `signal` that fires on `abort()`).
- [`AGENTS.md`](../../AGENTS.md) — the rules; §10 lifecycle (`start` / `clear`), §4.1 single-word members, §22 documentation-as-contracts.
- [`README.md`](README.md) — the guides index.
