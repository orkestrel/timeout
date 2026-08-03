import type { TimeoutOptions } from './types.js'
import { ContractError, isRecord, isString, preview } from '@orkestrel/contract'
import { MAX_TIMEOUT_MS } from './constants.js'
import { isTimeoutDuration, isTimeoutSignal } from './validators.js'

/**
 * Validate and normalize timeout construction options.
 *
 * @remarks
 * Each property is read exactly once before validation. The returned object is
 * a fresh copy and omits absent optional properties. No timer, controller, or
 * listener lifecycle begins at this boundary.
 *
 * @param options - Potentially untrusted timeout options
 * @returns A fresh validated `TimeoutOptions` object
 * @throws {@link import('@orkestrel/contract').ContractError} When the input
 *   does not satisfy `TimeoutOptions`
 *
 * @example
 * ```ts
 * const options = validateTimeoutOptions({ ms: 5_000 })
 * ```
 */
export function validateTimeoutOptions(options: TimeoutOptions): TimeoutOptions {
	if (!isRecord(options)) {
		throw new ContractError('Timeout: options must be a plain record', {
			code: 'bound',
			context: {
				path: ['options'],
				limit: 'plain record',
				received: preview(options),
			},
		})
	}

	let id: TimeoutOptions['id']
	let ms: TimeoutOptions['ms']
	let signal: TimeoutOptions['signal']
	try {
		id = options.id
		ms = options.ms
		signal = options.signal
	} catch (cause) {
		throw new ContractError('Timeout: options could not be read', {
			code: 'bound',
			context: {
				path: ['options'],
				limit: 'readable plain record',
				received: preview(options),
			},
			cause,
		})
	}

	if (id !== undefined && !isString(id)) {
		throw new ContractError('Timeout: id must be a string when defined', {
			code: 'literal',
			context: {
				path: ['options', 'id'],
				limit: 'string or undefined',
				received: preview(id),
			},
		})
	}
	if (!isTimeoutDuration(ms)) {
		throw new ContractError('Timeout: ms must be an integer in the supported range', {
			code: 'range',
			context: {
				path: ['options', 'ms'],
				limit: `integer in [0, ${MAX_TIMEOUT_MS}]`,
				received: preview(ms),
			},
		})
	}
	if (signal !== undefined && !isTimeoutSignal(signal)) {
		throw new ContractError('Timeout: signal must be a native AbortSignal when defined', {
			code: 'placement',
			context: {
				path: ['options', 'signal'],
				limit: 'native AbortSignal or undefined',
				received: preview(signal),
			},
		})
	}

	if (id !== undefined && signal !== undefined) return { id, ms, signal }
	if (id !== undefined) return { id, ms }
	if (signal !== undefined) return { ms, signal }
	return { ms }
}
