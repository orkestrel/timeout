import { MAX_TIMEOUT_MS, isTimeoutDuration, isTimeoutSignal } from '@src/core'
import { describe, expect, expectTypeOf, it } from 'vitest'

describe('isTimeoutDuration', () => {
	it.each([0, -0, 1, MAX_TIMEOUT_MS])('accepts %s', (value) => {
		expect(isTimeoutDuration(value)).toBe(true)
	})

	it.each([
		undefined,
		null,
		'1',
		Number.NEGATIVE_INFINITY,
		Number.POSITIVE_INFINITY,
		Number.NaN,
		-1,
		0.5,
		MAX_TIMEOUT_MS + 1,
	])('rejects %s without throwing', (value) => {
		expect(() => isTimeoutDuration(value)).not.toThrow()
		expect(isTimeoutDuration(value)).toBe(false)
	})

	it('narrows to number', () => {
		expectTypeOf(isTimeoutDuration).guards.toEqualTypeOf<number>()
	})
})

describe('isTimeoutSignal', () => {
	it('accepts a genuine native AbortSignal before and after abort', () => {
		const controller = new AbortController()

		expect(isTimeoutSignal(controller.signal)).toBe(true)
		controller.abort()
		expect(isTimeoutSignal(controller.signal)).toBe(true)
	})

	it.each([
		['undefined', undefined],
		['null', null],
		['a boolean', false],
		['a string', 'abort'],
		['a plain object', {}],
		['a spoof', { aborted: false }],
		['the native prototype', AbortSignal.prototype],
	])('rejects %s without throwing', (_label, value) => {
		expect(() => isTimeoutSignal(value)).not.toThrow()
		expect(isTimeoutSignal(value)).toBe(false)
	})

	it('contains a revoked proxy', () => {
		const revoked = Proxy.revocable(new AbortController().signal, {})
		revoked.revoke()

		expect(() => isTimeoutSignal(revoked.proxy)).not.toThrow()
		expect(isTimeoutSignal(revoked.proxy)).toBe(false)
	})

	it('narrows to AbortSignal', () => {
		expectTypeOf(isTimeoutSignal).guards.toEqualTypeOf<AbortSignal>()
	})
})
