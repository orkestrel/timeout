import type { TimeoutInterface, TimeoutOptions } from './types.js'
import { Timeout } from './Timeout.js'

/**
 * Creates a controllable deadline whose native signal aborts on expiry.
 *
 * @remarks
 * `options.ms` must be an integer from `0` through `2_147_483_647`, inclusive.
 * A parent `options.signal` clears an armed timeout without aborting the
 * timeout's own signal. Omitted `options.id` values generate a random UUID.
 * Malformed or unreadable options use contract code `bound`; invalid `id`,
 * `ms`, and `signal` values use `literal`, `range`, and `placement`.
 *
 * @param options - Validated deadline, optional trace label, and optional native parent signal
 * @returns A reusable timeout handle
 * @throws {@link import('@orkestrel/contract').ContractError} When the
 *   JavaScript input does not satisfy `TimeoutOptions`
 *
 * @example
 * ```ts
 * import { createTimeout } from '@orkestrel/timeout'
 *
 * const timeout = createTimeout({ ms: 5_000 })
 * timeout.start()
 * try {
 * 	await fetch('/work', { signal: timeout.signal })
 * } finally {
 * 	timeout.clear()
 * }
 * ```
 */
export function createTimeout(options: TimeoutOptions): TimeoutInterface {
	return new Timeout(options)
}
