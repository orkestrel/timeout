import type { TimeoutInterface, TimeoutOptions } from './types.js'
import { Timeout } from './Timeout.js'

/**
 * Creates a deadline handle from validated `TimeoutOptions` and returns it as a
 * `TimeoutInterface`.
 *
 * @remarks
 * `options.ms` must be an integer from `0` through `2_147_483_647`, inclusive.
 * A parent `options.signal` clears an armed timeout without aborting the
 * timeout's own signal. `start()` returns without arming when the parent
 * `signal` supplied at construction has already aborted, so a handle whose
 * parent aborted never expires again and its `signal` never fires. Omitted
 * `options.id` values generate a random UUID. Malformed or unreadable options
 * use contract code `bound`; invalid `id`, `ms`, and `signal` values use
 * `literal`, `range`, and `placement`.
 *
 * @param options - Validated deadline, optional trace label, and optional native parent signal
 * @returns A reusable timeout handle
 * @throws {@link import('@orkestrel/contract').ContractError} Thrown when the
 *   JavaScript input does not satisfy `TimeoutOptions`
 *
 * @example Race work against a deadline
 * ```ts
 * import { createTimeout } from '@orkestrel/timeout'
 *
 * async function fetchWithDeadline(url: string, ms: number): Promise<Response> {
 * 	const timeout = createTimeout({ ms })
 * 	timeout.start()
 *
 * 	try {
 * 		return await fetch(url, { signal: timeout.signal })
 * 	} finally {
 * 		timeout.clear() // cancels the still-armed deadline when the fetch won the race
 * 	}
 * }
 * ```
 */
export function createTimeout(options: TimeoutOptions): TimeoutInterface {
	return new Timeout(options)
}
