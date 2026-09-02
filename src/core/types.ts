/**
 * Represents the options for constructing a timeout deadline.
 *
 * @remarks
 * `ms` is an integer from `0` through `2_147_483_647`, inclusive. `id`
 * defaults to a random UUID when omitted, and `signal` is an optional native
 * parent signal whose abort clears an armed timeout without aborting the
 * timeout's own signal.
 *
 * @example
 * ```ts
 * const options: TimeoutOptions = { id: 'request', ms: 5_000 }
 * ```
 */
export interface TimeoutOptions {
	/** Holds the trace label for the timeout; omission generates a random UUID. */
	readonly id?: string
	/** Holds the integer deadline in milliseconds, inclusive from `0` through `2_147_483_647`. */
	readonly ms: number
	/** Holds the native parent signal whose abort clears an armed timeout. */
	readonly signal?: AbortSignal
}

/**
 * Represents a controllable deadline exposing a native `AbortSignal` that aborts on expiry.
 *
 * @example
 * ```ts
 * const timeout: TimeoutInterface = createTimeout({ ms: 5_000 })
 * timeout.start()
 * timeout.clear()
 * ```
 */
export interface TimeoutInterface {
	/** Holds the trace label supplied at construction or generated as a random UUID. */
	readonly id: string
	/** Holds the validated integer deadline in milliseconds. */
	readonly ms: number
	/** Holds the native signal that aborts once when the current deadline expires. */
	readonly signal: AbortSignal
	/** Reports whether the owned signal has aborted, derived directly from that signal. */
	readonly expired: boolean
	/**
	 * Arms or re-arms the deadline.
	 *
	 * @returns Nothing
	 */
	start(): void
	/**
	 * Cancels an armed deadline without aborting its signal and resets expiry state.
	 *
	 * @returns Nothing
	 */
	clear(): void
}
