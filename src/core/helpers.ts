import type { TimeoutOptions } from './types.js'
import {
	isRecord,
	isString,
	optionalOf,
	preview,
	readValue,
	refuseValue,
} from '@orkestrel/contract'
import { MAX_TIMEOUT_MS } from './constants.js'
import { isTimeoutDuration, isTimeoutSignal } from './validators.js'

/**
 * Validates once-read timeout construction options and returns a fresh normalized copy
 * omitting absent optional keys.
 *
 * @remarks
 * Each property is read before any validation runs, and no timer, controller, or
 * listener lifecycle begins at this boundary.
 *
 * @param options - Potentially untrusted timeout options
 * @returns A fresh validated `TimeoutOptions` object
 * @throws {@link import('@orkestrel/contract').ContractError} Thrown when the
 *   input does not satisfy `TimeoutOptions`
 *
 * @example
 * ```ts
 * const options = validateTimeoutOptions({ ms: 5_000 })
 * ```
 */
export function validateTimeoutOptions(options: TimeoutOptions): TimeoutOptions {
	refuseValue(options, isRecord, 'Timeout', { path: ['options'], limit: 'plain record' })

	const { id, ms, signal } = readValue(
		() => ({
			id: options.id,
			ms: options.ms,
			signal: options.signal,
		}),
		'Timeout',
		{
			subject: 'options',
			code: 'bound',
			context: {
				path: ['options'],
				limit: 'readable plain record',
				received: preview(options),
			},
		},
	)

	refuseValue(id, optionalOf(isString), 'Timeout', {
		path: ['options', 'id'],
		limit: 'string or undefined',
		code: 'literal',
	})
	refuseValue(ms, isTimeoutDuration, 'Timeout', {
		path: ['options', 'ms'],
		limit: `integer in [0, ${MAX_TIMEOUT_MS}]`,
		code: 'range',
	})
	refuseValue(signal, optionalOf(isTimeoutSignal), 'Timeout', {
		path: ['options', 'signal'],
		limit: 'native AbortSignal or undefined',
		code: 'placement',
	})

	if (id !== undefined && signal !== undefined) return { id, ms, signal }
	if (id !== undefined) return { id, ms }
	if (signal !== undefined) return { ms, signal }
	return { ms }
}
