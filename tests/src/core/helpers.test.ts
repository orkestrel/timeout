import type { TimeoutOptions } from '@src/core'
import { MAX_TIMEOUT_MS, validateTimeoutOptions } from '@src/core'
import { isContractError, preview } from '@orkestrel/contract'
import { captureError } from '@orkestrel/test'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createReadRecorder } from '../../setup.js'

describe('validateTimeoutOptions', () => {
	it('returns a fresh copy and omits absent optional keys', () => {
		const input: TimeoutOptions = { ms: 10 }
		const output = validateTimeoutOptions(input)

		expect(output).not.toBe(input)
		expect(output).toEqual(input)
		expect(Object.keys(output)).toEqual(['ms'])
	})

	it('preserves present optional keys in a fresh copy', () => {
		const signal = new AbortController().signal
		const input: TimeoutOptions = { id: '', ms: 10, signal }
		const output = validateTimeoutOptions(input)

		expect(output).not.toBe(input)
		expect(output).toEqual(input)
		expect(Object.keys(output)).toEqual(['id', 'ms', 'signal'])
	})

	it('reads each declared property exactly once', () => {
		const recorder = createReadRecorder<TimeoutOptions>({
			id: 'deadline',
			ms: 10,
			signal: new AbortController().signal,
		})

		const output = validateTimeoutOptions(recorder.proxy)

		expect(output.id).toBe('deadline')
		expect(recorder.reads).toEqual(['id', 'ms', 'signal'])
	})

	it('contains a hostile getter and preserves its cause', () => {
		const descriptor = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')
		if (descriptor === undefined) throw new Error('Expected the native aborted descriptor')
		const input = {}
		Object.defineProperty(input, 'ms', descriptor)
		const error = captureError(() => Reflect.apply(validateTimeoutOptions, undefined, [input]))

		expect(isContractError(error)).toBe(true)
		if (!isContractError(error)) throw new Error('Expected a ContractError')
		expect(error.code).toBe('bound')
		expect(error.context).toEqual({
			path: ['options'],
			limit: 'readable plain record',
			received: 'object',
		})
		expect(error.cause instanceof TypeError).toBe(true)
	})

	it.each([
		['options', null, 'bound', ['options'], 'plain record', preview(null)],
		['id', { id: 7, ms: 10 }, 'literal', ['options', 'id'], 'string or undefined', '7'],
		[
			'ms',
			{ ms: Number.NaN },
			'range',
			['options', 'ms'],
			`integer in [0, ${MAX_TIMEOUT_MS}]`,
			'NaN',
		],
		[
			'signal',
			{ ms: 10, signal: { aborted: false } },
			'placement',
			['options', 'signal'],
			'native AbortSignal or undefined',
			'object',
		],
	])(
		'rejects invalid %s with exact contract context',
		(_field, input, code, path, limit, received) => {
			const error = captureError(() => Reflect.apply(validateTimeoutOptions, undefined, [input]))

			expect(isContractError(error)).toBe(true)
			if (!isContractError(error)) throw new Error('Expected a ContractError')
			expect(error.code).toBe(code)
			expect(error.context).toEqual({ path, limit, received })
		},
	)

	it.each([0, -0, 1, MAX_TIMEOUT_MS])('accepts duration boundary %s', (ms) => {
		const output = validateTimeoutOptions({ ms })

		expect(Object.is(output.ms, ms)).toBe(true)
	})

	it('preserves the public options type', () => {
		expectTypeOf(validateTimeoutOptions).returns.toEqualTypeOf<TimeoutOptions>()
	})
})
