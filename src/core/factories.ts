import type { TimeoutInterface, TimeoutOptions } from './types.js'
import { Timeout } from './Timeout.js'

/**
 * Create a deadline handle — a controllable `setTimeout` wrapper that exposes an
 * `AbortSignal` which fires when the timeout expires, for racing against work.
 *
 * @remarks
 * Call `start()` to arm the deadline for `ms` milliseconds; on expiry the handle's
 * `signal` fires and `expired` flips `true`. Call `clear()` to cancel a pending
 * deadline without firing. When `options.signal` is given, a parent abort CLEARS
 * the timeout (it never expires) rather than firing it. Pass `options.id` to label
 * the handle for tracing, or let it default to a random UUID. `ms` must be a
 * non-negative finite number; the host `setTimeout` clamps a negative or `NaN`
 * value to roughly `0` (firing on the next macrotask) rather than throwing.
 *
 * @param options - `ms` (the deadline in milliseconds, a non-negative finite
 *   number), an optional `id` (a trace label; defaults to a random UUID), and an
 *   optional parent `signal` whose abort clears the timeout
 * @returns A working {@link TimeoutInterface}
 *
 * @example
 * ```ts
 * import { createTimeout } from '@src/core'
 *
 * const timeout = createTimeout({ ms: 5_000 })
 * timeout.start()
 * const result = await Promise.race([
 * 	work(),
 * 	new Promise((_, reject) =>
 * 		timeout.signal.addEventListener('abort', () => reject(new Error('timed out')), {
 * 			once: true,
 * 		}),
 * 	),
 * ])
 * timeout.clear() // work finished first — cancel the deadline
 * ```
 */
export function createTimeout(options: TimeoutOptions): TimeoutInterface {
	return new Timeout(options)
}
