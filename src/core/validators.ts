import { isFiniteNumber, isInteger } from '@orkestrel/contract'
import { MAX_TIMEOUT_MS } from './constants.js'

/**
 * Determines whether a value is an accepted timeout duration.
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
	return isFiniteNumber(value) && isInteger(value) && value >= 0 && value <= MAX_TIMEOUT_MS
}

/**
 * Determines whether a value is a genuine native `AbortSignal`.
 *
 * @remarks
 * The intrinsic `aborted` getter performs the native brand check. The boundary
 * contains revoked proxies and hostile receivers, returning `false` instead of
 * allowing their errors to escape.
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
