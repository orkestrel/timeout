/**
 * Options for constructing a timeout deadline.
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
	/** Trace label for the timeout; omission generates a random UUID. */
	readonly id?: string
	/** Integer deadline in milliseconds, inclusive from `0` through `2_147_483_647`. */
	readonly ms: number
	/** Native parent signal whose abort clears an armed timeout. */
	readonly signal?: AbortSignal
}

/**
 * A controllable deadline exposing a native `AbortSignal` that aborts on expiry.
 *
 * @example
 * ```ts
 * const timeout: TimeoutInterface = createTimeout({ ms: 5_000 })
 * timeout.start()
 * timeout.clear()
 * ```
 */
export interface TimeoutInterface {
	/** Trace label supplied at construction or generated as a random UUID. */
	readonly id: string
	/** Validated integer deadline in milliseconds. */
	readonly ms: number
	/** Native signal that aborts once when the current deadline expires. */
	readonly signal: AbortSignal
	/** Whether the owned signal has aborted, derived directly from that signal. */
	readonly expired: boolean
	/**
	 * Arm or re-arm the deadline.
	 *
	 * @returns Nothing
	 */
	start(): void
	/**
	 * Cancel an armed deadline without aborting its signal and reset expiry state.
	 *
	 * @returns Nothing
	 */
	clear(): void
}
