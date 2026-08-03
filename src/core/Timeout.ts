import type { TimeoutInterface, TimeoutOptions } from './types.js'
import { validateTimeoutOptions } from './helpers.js'

/**
 * A controllable deadline whose native `AbortSignal` aborts when it expires.
 *
 * @remarks
 * `start()` arms or replaces the current deadline. Expiry sets `expired` and
 * aborts the current signal once. `clear()` cancels without aborting and resets
 * `expired`. Starting or clearing after expiry installs a fresh signal. A parent
 * abort deliberately clears the timeout without aborting its signal; once the
 * parent has aborted, later starts are inert.
 *
 * Construction validates the complete JavaScript boundary before creating an
 * `AbortController`. A malformed or unreadable options record throws a
 * `bound`-coded {@link import('@orkestrel/contract').ContractError}; an invalid
 * `id`, `ms`, or `signal` uses `literal`, `range`, or `placement`, respectively.
 *
 * @example
 * ```ts
 * import { Timeout } from '@orkestrel/timeout'
 *
 * const timeout = new Timeout({ ms: 5_000 })
 * timeout.start()
 * timeout.signal.addEventListener('abort', () => giveUp(), { once: true })
 * timeout.clear()
 * ```
 */
export class Timeout implements TimeoutInterface {
	readonly id: string
	readonly ms: number
	readonly #parent: AbortSignal | undefined
	readonly #listener: () => void
	#controller: AbortController
	#handle: ReturnType<typeof setTimeout> | undefined
	#linked = false

	constructor(options: TimeoutOptions) {
		const input = validateTimeoutOptions(options)
		this.id = input.id === undefined ? crypto.randomUUID() : input.id
		this.ms = input.ms
		this.#parent = input.signal
		this.#controller = new AbortController()
		this.#listener = this.clear.bind(this)
	}

	get signal(): AbortSignal {
		return this.#controller.signal
	}

	get expired(): boolean {
		return this.#controller.signal.aborted
	}

	start(): void {
		if (this.#parent?.aborted === true) return
		if (this.#handle !== undefined) {
			clearTimeout(this.#handle)
			this.#handle = undefined
		}
		this.#detach()
		if (this.#controller.signal.aborted) this.#controller = new AbortController()
		if (this.#parent !== undefined) {
			this.#parent.addEventListener('abort', this.#listener, { once: true })
			this.#linked = true
		}
		this.#handle = setTimeout(() => {
			this.#handle = undefined
			this.#detach()
			this.#controller.abort()
		}, this.ms)
	}

	clear(): void {
		if (this.#handle !== undefined) {
			clearTimeout(this.#handle)
			this.#handle = undefined
		}
		this.#detach()
		if (this.#controller.signal.aborted) this.#controller = new AbortController()
	}

	#detach(): void {
		if (this.#linked) {
			this.#parent?.removeEventListener('abort', this.#listener)
			this.#linked = false
		}
	}
}
