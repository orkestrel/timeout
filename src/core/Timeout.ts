import type { TimeoutInterface, TimeoutOptions } from './types.js'

/**
 * A deadline handle — a controllable `setTimeout` wrapper that exposes an
 * `AbortSignal` which fires when the timeout expires, for racing against work.
 *
 * @remarks
 * - **Deadline signal.** `start()` arms a `setTimeout` for `ms`; on expiry it
 *   flips `expired` and aborts the controller, firing `signal`. Race `signal`
 *   against work to bound how long it may run.
 * - **Controllable.** `clear()` cancels a pending expiry WITHOUT firing `signal`,
 *   and resets `expired` back to `false` (the §10 reset) — a cleared timeout
 *   reports `expired === false` and a non-aborted `signal`.
 * - **Reusable.** Re-`start()` after an expiry swaps in a fresh controller and
 *   resets `expired`, so `signal` / `expired` reflect the new run — the handle is
 *   reusable across deadlines without re-construction.
 * - **Parent linking.** A parent `signal` does NOT expire this timeout — it
 *   CLEARS it: the parent listener is attached only while a timer is armed (added
 *   on `start()`, removed on expiry or `clear()`), so a parent abort during the
 *   timing window cancels the pending expiry and a later `start()` is a no-op once
 *   the parent has aborted. An idle handle holds no parent listener.
 * - **Event-free.** A pure functional primitive — no Emitter, no events.
 *
 * @example
 * ```ts
 * const timeout = new Timeout({ ms: 5_000 })
 * timeout.start()
 * timeout.signal.addEventListener('abort', () => giveUp(), { once: true })
 * timeout.clear() // cancels the deadline before it fires
 * ```
 */
export class Timeout implements TimeoutInterface {
	readonly id: string
	readonly ms: number
	readonly #parent: AbortSignal | undefined
	#controller = new AbortController()
	#handle: ReturnType<typeof setTimeout> | undefined
	#listener: (() => void) | undefined
	#expired = false

	constructor(options: TimeoutOptions) {
		this.id = options.id ?? crypto.randomUUID()
		this.ms = options.ms
		this.#parent = options.signal
	}

	get signal(): AbortSignal {
		return this.#controller.signal
	}

	get expired(): boolean {
		return this.#expired
	}

	start(): void {
		// Once the parent has aborted, the deadline must never fire.
		if (this.#parent?.aborted === true) return
		// Re-arm cleanly: drop any pending timer + parent listener from a prior run.
		if (this.#handle !== undefined) {
			clearTimeout(this.#handle)
			this.#handle = undefined
		}
		this.#detach()
		this.#expired = false
		// Swap in a fresh controller only when the current one has already fired, so a
		// re-armed run gets a clean `signal` while a listener attached before the FIRST
		// `start()` (on the construction-time signal) survives to fire on expiry.
		if (this.#controller.signal.aborted) this.#controller = new AbortController()
		// Link the parent only for the lifetime of this timer — a parent abort CLEARS
		// the timeout (so it never expires); the listener is removed when the timer settles.
		const listener = (): void => this.clear()
		this.#listener = listener
		this.#parent?.addEventListener('abort', listener, { once: true })
		this.#handle = setTimeout(() => {
			this.#handle = undefined
			this.#expired = true
			this.#controller.abort()
			// The timer fired — drop the parent listener so a later parent abort can no
			// longer reach `clear()` and un-expire this legitimate expiry.
			this.#detach()
		}, this.ms)
	}

	clear(): void {
		if (this.#handle !== undefined) {
			clearTimeout(this.#handle)
			this.#handle = undefined
		}
		this.#detach()
		this.#expired = false
		// If the controller had already fired, swap a fresh one so a cleared timeout
		// reports `expired === false` AND a non-aborted `signal`, consistently.
		if (this.#controller.signal.aborted) this.#controller = new AbortController()
	}

	// Remove the parent-abort listener if one is currently attached.
	#detach(): void {
		if (this.#listener !== undefined) {
			this.#parent?.removeEventListener('abort', this.#listener)
			this.#listener = undefined
		}
	}
}
