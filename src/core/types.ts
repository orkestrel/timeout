/** Options for `createTimeout`. */
export interface TimeoutOptions {
	readonly id?: string
	/**
	 * The deadline in milliseconds — must be a non-negative finite number.
	 *
	 * @remarks
	 * Passed straight to the host `setTimeout`, which clamps a negative or `NaN`
	 * value to roughly `0` (firing on the next macrotask) rather than throwing.
	 */
	readonly ms: number
	/** A parent signal — clears the timeout (so it never expires) if this aborts. */
	readonly signal?: AbortSignal
}

/**
 * A deadline handle — a controllable `setTimeout` wrapper that exposes an
 * `AbortSignal` which fires when the timeout expires, for racing against work.
 */
export interface TimeoutInterface {
	readonly id: string
	readonly ms: number
	readonly signal: AbortSignal
	readonly expired: boolean
	start(): void
	clear(): void
}
