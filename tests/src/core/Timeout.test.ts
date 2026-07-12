import type { TimeoutInterface, TimeoutOptions } from '@src/core'
import { Timeout } from '@src/core'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createRecorder, waitForDelay } from '../../setup.js'

// Timeout — a controllable setTimeout wrapper exposing a deadline AbortSignal.
// Real timers with short deadlines (AGENTS §16: 10–50ms timers, no mocks); a tiny
// real delay lets the deadline elapse, which is deterministic at this scale.

const MS = 10

describe('Timeout', () => {
	it('exposes id and ms', () => {
		const timeout = new Timeout({ id: 'deadline-1', ms: MS })

		expect(timeout.id).toBe('deadline-1')
		expect(timeout.ms).toBe(MS)
	})

	it('a fresh timeout has not expired and its signal has not fired', () => {
		const timeout = new Timeout({ ms: MS })

		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('start() → after ms, expired is true and signal fires', async () => {
		const timeout = new Timeout({ ms: MS })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		timeout.start()
		expect(timeout.expired).toBe(false)

		await waitForDelay(MS * 3)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('clear() before expiry → never expires, signal does not fire', async () => {
		const timeout = new Timeout({ ms: MS })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		timeout.start()
		timeout.clear()

		await waitForDelay(MS * 3)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
		expect(fired.count).toBe(0)
	})

	it('re-start() after expiry works — a fresh run on a fresh signal', async () => {
		const timeout = new Timeout({ ms: MS })

		timeout.start()
		await waitForDelay(MS * 3)
		expect(timeout.expired).toBe(true)
		const firstSignal = timeout.signal

		timeout.start()
		// The new run is fresh: a new signal, not yet expired.
		expect(timeout.expired).toBe(false)
		expect(timeout.signal).not.toBe(firstSignal)
		expect(timeout.signal.aborted).toBe(false)

		await waitForDelay(MS * 3)
		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('clear() after an expiry resets expired and swaps a fresh non-aborted signal', async () => {
		const timeout = new Timeout({ ms: MS })

		timeout.start()
		await waitForDelay(MS * 3)
		expect(timeout.expired).toBe(true)
		const expiredSignal = timeout.signal
		expect(expiredSignal.aborted).toBe(true)

		timeout.clear()

		// The §10 reset: a cleared timeout reports expired === false on a fresh,
		// non-aborted signal — even when it had already fired.
		expect(timeout.expired).toBe(false)
		expect(timeout.signal).not.toBe(expiredSignal)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('reuse across runs — expired is false at the start of each iteration', async () => {
		const timeout = new Timeout({ ms: MS })

		for (let run = 0; run < 3; run += 1) {
			timeout.start()
			// At the start of each iteration the handle is freshly armed.
			expect(timeout.expired).toBe(false)
			await waitForDelay(MS * 3)
			expect(timeout.expired).toBe(true)
			timeout.clear()
			expect(timeout.expired).toBe(false)
		}
	})

	it('double start() without clear() — the old timer does not double-fire', async () => {
		const timeout = new Timeout({ ms: MS })
		const fired = createRecorder<readonly []>()

		timeout.start()
		// Re-arm immediately; the first timer must be cancelled, not left to fire too.
		timeout.start()
		timeout.signal.addEventListener('abort', fired.handler)

		await waitForDelay(MS * 4)

		expect(timeout.expired).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('clear() is a safe no-op before any start(), twice, and with no active timer', async () => {
		const timeout = new Timeout({ ms: MS })

		// Before any start().
		timeout.clear()
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
		const initialSignal = timeout.signal

		// Twice in a row, no timer pending — still inert, same untouched signal.
		timeout.clear()
		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(initialSignal)

		// A no-op clear must not arm anything, so nothing fires later.
		await waitForDelay(MS * 3)
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('a parent abort AFTER expiry does NOT un-expire a legitimate expiry', async () => {
		const parent = new AbortController()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })

		timeout.start()
		await waitForDelay(MS * 3)
		expect(timeout.expired).toBe(true)
		const expiredSignal = timeout.signal

		// The parent aborts only AFTER the deadline already fired — the parent
		// listener was removed on expiry, so this cannot reach clear().
		parent.abort()

		expect(timeout.expired).toBe(true)
		expect(timeout.signal).toBe(expiredSignal)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('a long-lived parent linking many child timeouts that all expire stays harmless', async () => {
		const parent = new AbortController()
		const children = [
			new Timeout({ ms: MS, signal: parent.signal }),
			new Timeout({ ms: MS, signal: parent.signal }),
			new Timeout({ ms: MS, signal: parent.signal }),
		]

		for (const child of children) child.start()
		await waitForDelay(MS * 3)
		for (const child of children) expect(child.expired).toBe(true)

		// Every child cleaned up its parent listener on expiry, so aborting the
		// long-lived parent afterward touches none of them — no un-expiring.
		parent.abort()
		for (const child of children) {
			expect(child.expired).toBe(true)
			expect(child.signal.aborted).toBe(true)
		}
	})

	it('ms: 0 expires on the next macrotask', async () => {
		const timeout = new Timeout({ ms: 0 })

		timeout.start()
		expect(timeout.expired).toBe(false)

		await waitForDelay(0)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('a parent signal aborting clears the timeout (it never expires)', async () => {
		const parent = new AbortController()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		timeout.start()
		parent.abort()

		await waitForDelay(MS * 3)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
		expect(fired.count).toBe(0)
	})

	it('start() is a no-op once the parent has already aborted', async () => {
		const parent = new AbortController()
		parent.abort()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })

		timeout.start()

		await waitForDelay(MS * 3)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('id is unique across instances when not supplied', () => {
		const timeout = new Timeout({ ms: MS })
		const other = new Timeout({ ms: MS })

		expect(timeout.id).not.toBe(other.id)
	})

	it('ms: -1 is clamped by the host to ~0 and expires on a near-immediate macrotask', async () => {
		const timeout = new Timeout({ ms: -1 })

		timeout.start()
		expect(timeout.expired).toBe(false)

		await waitForDelay(MS)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('ms: NaN is clamped by the host to ~0 and expires on a near-immediate macrotask', async () => {
		const timeout = new Timeout({ ms: Number.NaN })

		timeout.start()
		expect(timeout.expired).toBe(false)

		await waitForDelay(MS)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('id: undefined generates a non-empty string id', () => {
		const timeout = new Timeout({ ms: MS, id: undefined })

		expect(typeof timeout.id).toBe('string')
		expect(timeout.id.length > 0).toBe(true)
	})

	it('id: an empty string is preserved as-is (not replaced with a generated id)', () => {
		const timeout = new Timeout({ ms: MS, id: '' })

		expect(timeout.id).toBe('')
	})
})

// Deterministic timing + leak proofs. Fake timers make the timer count an exact,
// observable quantity (`vi.getTimerCount()`), so churn/leak-safety, the timer-vs-
// parent-abort race, and ms boundaries are proven precisely rather than by waiting
// (AGENTS §16; mirrors the Scheduler suite's fake-timer pattern). No mocks of the
// primitive — `Timeout` runs against real (faked) host timers and real signals.

describe('Timeout — determinism & leak-safety (fake timers)', () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it('a single armed timeout holds exactly one host timer until it settles', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 50 })

		expect(vi.getTimerCount()).toBe(0)
		timeout.start()
		expect(vi.getTimerCount()).toBe(1)

		vi.advanceTimersByTime(50)

		// The timer fired and was consumed — none left pending.
		expect(timeout.expired).toBe(true)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('start/clear churn never accumulates host timers (count returns to 0 each cycle)', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 50 })

		for (let cycle = 0; cycle < 1_000; cycle += 1) {
			timeout.start()
			// Exactly one armed timer — the prior cycle's must have been cleared, never stacked.
			expect(vi.getTimerCount()).toBe(1)
			timeout.clear()
			expect(vi.getTimerCount()).toBe(0)
		}

		// No residue after a thousand cycles, and the cleared handle is inert.
		expect(vi.getTimerCount()).toBe(0)
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('repeated start() without clear() keeps exactly one timer (the prior is cancelled, not stacked)', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 50 })

		for (let cycle = 0; cycle < 500; cycle += 1) {
			timeout.start()
			// Re-arming must cancel the previous timer before scheduling the next.
			expect(vi.getTimerCount()).toBe(1)
		}

		// Only the final timer survives — draining fires it once.
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)
		vi.advanceTimersByTime(50)

		expect(vi.getTimerCount()).toBe(0)
		expect(timeout.expired).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('start→expire→start churn never leaks timers and ends armed exactly once', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 50 })

		for (let cycle = 0; cycle < 200; cycle += 1) {
			timeout.start()
			expect(vi.getTimerCount()).toBe(1)
			vi.advanceTimersByTime(50)
			// Each expiry consumes its own timer — nothing carries into the next arm.
			expect(timeout.expired).toBe(true)
			expect(vi.getTimerCount()).toBe(0)
		}
	})

	it('parented start/clear churn leaves the parent with no surviving timer or stale effect', () => {
		vi.useFakeTimers()
		const parent = new AbortController()
		const timeout = new Timeout({ ms: 50, signal: parent.signal })

		// Each start attaches a fresh `{ once }` parent listener; each clear detaches it.
		// After heavy churn ending idle, the parent abort must behave exactly like the
		// single-cycle idle case — fully inert — proving listeners did not pile up.
		for (let cycle = 0; cycle < 1_000; cycle += 1) {
			timeout.start()
			timeout.clear()
		}
		expect(vi.getTimerCount()).toBe(0)

		parent.abort()

		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
		expect(vi.getTimerCount()).toBe(0)
	})

	it('parent-listener bookkeeping nets to zero across churn (directly counted, no leak)', () => {
		vi.useFakeTimers()
		const parent = new AbortController()
		// Observe the REAL parent signal's listener bookkeeping by counting calls to
		// its own add/remove (delegating to the genuine implementation) — instrumenting
		// the test-owned signal, not mocking the Timeout (AGENTS §16). If `clear()`
		// removed the wrong listener, removals would lag adds and the net would climb.
		let added = 0
		let removed = 0
		const realAdd = parent.signal.addEventListener.bind(parent.signal)
		const realRemove = parent.signal.removeEventListener.bind(parent.signal)
		parent.signal.addEventListener = (
			type: string,
			listener: EventListener,
			options?: boolean | AddEventListenerOptions,
		): void => {
			if (type === 'abort') added += 1
			realAdd(type, listener, options)
		}
		parent.signal.removeEventListener = (
			type: string,
			listener: EventListener,
			options?: boolean | EventListenerOptions,
		): void => {
			if (type === 'abort') removed += 1
			realRemove(type, listener, options)
		}
		const timeout = new Timeout({ ms: 50, signal: parent.signal })

		for (let cycle = 0; cycle < 1_000; cycle += 1) {
			timeout.start()
			timeout.clear()
		}

		// Every armed listener was detached: adds and removes balance exactly, so the
		// signal holds no accumulated listeners after a thousand cycles.
		expect(added).toBe(1_000)
		expect(added - removed).toBe(0)
	})

	it('timer-vs-parent race: a synchronous parent abort while armed clears the timer before it can fire', () => {
		vi.useFakeTimers()
		const parent = new AbortController()
		const timeout = new Timeout({ ms: 50, signal: parent.signal })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		timeout.start()
		expect(vi.getTimerCount()).toBe(1)

		// The parent wins the race deterministically: it aborts BEFORE the deadline is
		// advanced, so the listener clears the pending timer synchronously.
		parent.abort()
		expect(vi.getTimerCount()).toBe(0)

		// Advancing well past the deadline now fires nothing — the timer is gone.
		vi.advanceTimersByTime(1_000)
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
		expect(fired.count).toBe(0)
	})

	it('an idle parented handle holds no host timer, and a parent abort before any start() is fully inert', () => {
		vi.useFakeTimers()
		const parent = new AbortController()
		const timeout = new Timeout({ ms: 50, signal: parent.signal })

		// Never started — the parent listener attaches only on start(), so there is
		// nothing armed and nothing to detach.
		expect(vi.getTimerCount()).toBe(0)

		parent.abort()

		// Inert: no timer was armed, nothing fired, and a later start() is the
		// documented no-op once the parent has aborted.
		expect(vi.getTimerCount()).toBe(0)
		expect(timeout.expired).toBe(false)

		timeout.start()
		expect(vi.getTimerCount()).toBe(0)
		vi.advanceTimersByTime(1_000)
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('ms: 1 expires after exactly one millisecond, not before', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 1 })

		timeout.start()
		vi.advanceTimersByTime(0)
		// Not yet at the 1ms boundary.
		expect(timeout.expired).toBe(false)

		vi.advanceTimersByTime(1)
		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('a large ms deadline stays armed until its full duration elapses', () => {
		vi.useFakeTimers()
		const big = 2_147_483_647 // the host setTimeout max (~24.8 days)
		const timeout = new Timeout({ ms: big })

		timeout.start()
		vi.advanceTimersByTime(big - 1)
		// Still pending one tick short of the deadline — no premature clamp to ~0.
		expect(timeout.expired).toBe(false)
		expect(vi.getTimerCount()).toBe(1)

		vi.advanceTimersByTime(1)
		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('clear() at the exact expiry tick still suppresses firing when it runs first', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 50 })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		timeout.start()
		// Stop one tick short, then clear — the deadline never gets its turn.
		vi.advanceTimersByTime(49)
		timeout.clear()
		expect(vi.getTimerCount()).toBe(0)

		vi.advanceTimersByTime(100)
		expect(timeout.expired).toBe(false)
		expect(fired.count).toBe(0)
	})

	// ── signal identity through every transition ─────────────────────────────

	it('signal identity: stable across start→clear (never fired), swapped only after a real expiry', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 50 })
		const initial = timeout.signal

		// A clear that never let the controller fire keeps the SAME signal.
		timeout.start()
		timeout.clear()
		expect(timeout.signal).toBe(initial)

		// Re-arming without a prior expiry also reuses the same (never-aborted) signal.
		timeout.start()
		expect(timeout.signal).toBe(initial)

		// Only an actual expiry aborts the controller; the next start() then swaps a fresh one.
		vi.advanceTimersByTime(50)
		expect(timeout.expired).toBe(true)
		expect(timeout.signal).toBe(initial)
		expect(timeout.signal.aborted).toBe(true)

		timeout.start()
		expect(timeout.signal).not.toBe(initial)
		expect(timeout.signal.aborted).toBe(false)
	})
})

// Type-level shape (positive assertions only) — TimeoutInterface's member shape
// and TimeoutOptions' input shape stay locked as documented.

describe('Timeout — type shape', () => {
	it('TimeoutInterface exposes readonly id/ms/signal/expired and start/clear methods', () => {
		expectTypeOf<TimeoutInterface>().toHaveProperty('id').toEqualTypeOf<string>()
		expectTypeOf<TimeoutInterface>().toHaveProperty('ms').toEqualTypeOf<number>()
		expectTypeOf<TimeoutInterface>().toHaveProperty('signal').toEqualTypeOf<AbortSignal>()
		expectTypeOf<TimeoutInterface>().toHaveProperty('expired').toEqualTypeOf<boolean>()
		expectTypeOf<TimeoutInterface['start']>().toEqualTypeOf<() => void>()
		expectTypeOf<TimeoutInterface['clear']>().toEqualTypeOf<() => void>()
	})

	it('TimeoutOptions accepts an optional id, a required ms, and an optional signal', () => {
		expectTypeOf<TimeoutOptions>().toHaveProperty('id').toEqualTypeOf<string | undefined>()
		expectTypeOf<TimeoutOptions>().toHaveProperty('ms').toEqualTypeOf<number>()
		expectTypeOf<TimeoutOptions>().toHaveProperty('signal').toEqualTypeOf<AbortSignal | undefined>()
	})

	it('expired stays consistent with signal.aborted through a full transition journey', () => {
		vi.useFakeTimers()
		const timeout = new Timeout({ ms: 50 })

		// Fresh.
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)

		// Armed — not yet expired.
		timeout.start()
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)

		// Expired — both true together.
		vi.advanceTimersByTime(50)
		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)

		// Cleared after expiry — both false together, on a fresh signal.
		timeout.clear()
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)

		// Armed again, then cleared before firing — both false together.
		timeout.start()
		expect(timeout.expired).toBe(false)
		timeout.clear()
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})
})
