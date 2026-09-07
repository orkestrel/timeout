import { isInteger } from '@orkestrel/contract'
import { MAX_TIMEOUT_MS } from './constants.js'

/**
 * Determines whether a value is an integer in the inclusive range from `0` through
 * `MAX_TIMEOUT_MS`, staying total for every input.
 *
 * @param value - Unknown duration candidate
 * @returns True if the value is an integer in the inclusive timeout range; false otherwise
 *
 * @example
 * ```ts
 * isTimeoutDuration(0) // true
 * isTimeoutDuration(1.5) // false
 * ```
 */
export function isTimeoutDuration(value: unknown): value is number {
	return isInteger(value) && value >= 0 && value <= MAX_TIMEOUT_MS
}

/**
 * Determines whether a value is a genuine native `AbortSignal`, staying total for a
 * structural spoof and for a hostile or revoked proxy.
 *
 * @remarks
 * The intrinsic `aborted` getter performs the native brand check, and the boundary
 * returns `false` rather than letting a receiver's error escape.
 *
 * @param value - Unknown signal candidate
 * @returns True if the native `AbortSignal` getter accepts the value; false otherwise
 *
 * @example
 * ```ts
 * isTimeoutSignal(new AbortController().signal) // true
 * isTimeoutSignal({ aborted: false }) // false
 * ```
 */
export function isTimeoutSignal(value: unknown): value is AbortSignal {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')
		if (descriptor?.get === undefined) return false
		return typeof Reflect.apply(descriptor.get, value, []) === 'boolean'
	} catch {
		return false
	}
}
