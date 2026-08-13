import type { TimeoutInterface, TimeoutOptions } from '@src/core'
import { MAX_TIMEOUT_MS, Timeout } from '@src/core'
import { isContractError } from '@orkestrel/contract'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createRecorder, waitForDelay } from '@orkestrel/test'

const MS = 10
const WAIT_MS = 40

describe('Timeout construction boundary', () => {
	it('routes malformed options through the strict public boundary', () => {
		let error: unknown
		try {
			Reflect.construct(Timeout, [null])
		} catch (caught) {
			error = caught
		}

		expect(isContractError(error)).toBe(true)
		if (!isContractError(error)) throw new Error('Expected a ContractError')
		expect(error.code).toBe('bound')
		expect(error.context).toEqual({
			path: ['options'],
			limit: 'plain record',
			received: 'null',
		})
	})

	it('routes invalid fields through the strict public boundary', () => {
		let error: unknown
		try {
			Reflect.construct(Timeout, [{ ms: MAX_TIMEOUT_MS + 1 }])
		} catch (caught) {
			error = caught
		}

		expect(isContractError(error)).toBe(true)
		if (!isContractError(error)) throw new Error('Expected a ContractError')
		expect(error.code).toBe('range')
		expect(error.context).toEqual({
			path: ['options', 'ms'],
			limit: `integer in [0, ${MAX_TIMEOUT_MS}]`,
			received: String(MAX_TIMEOUT_MS + 1),
		})
	})

	it('preserves an empty id and generates only for omission', () => {
		const empty = new Timeout({ id: '', ms: MS })
		const generated = new Timeout({ ms: MS })
		const other = new Timeout({ ms: MS })

		expect(empty.id).toBe('')
		expect(generated.id.length > 0).toBe(true)
		expect(generated.id).not.toBe(other.id)
	})

	it('fails synchronously before the next timer turn', async () => {
		const turned = createRecorder<readonly []>()
		setTimeout(turned.handler, 0)
		let error: unknown

		try {
			Reflect.construct(Timeout, [{ ms: Number.NaN }])
		} catch (caught) {
			error = caught
		}

		expect(isContractError(error)).toBe(true)
		expect(turned.count).toBe(0)
		await waitForDelay(0)
		expect(turned.count).toBe(1)
	})
})

describe('Timeout lifecycle', () => {
	it('exposes construction state on a fresh signal', () => {
		const timeout = new Timeout({ id: 'deadline-1', ms: MS })

		expect(timeout.id).toBe('deadline-1')
		expect(timeout.ms).toBe(MS)
		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('expires once and aborts its signal', async () => {
		const timeout = new Timeout({ ms: MS })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		timeout.start()
		expect(timeout.expired).toBe(false)
		await waitForDelay(WAIT_MS)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('treats zero as a next-turn deadline', async () => {
		const timeout = new Timeout({ ms: 0 })

		timeout.start()
		expect(timeout.expired).toBe(false)
		await waitForDelay(0)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('clear cancels without aborting and remains safe while idle', async () => {
		const timeout = new Timeout({ ms: MS })
		const initial = timeout.signal
		const fired = createRecorder<readonly []>()
		initial.addEventListener('abort', fired.handler)

		timeout.clear()
		timeout.start()
		timeout.clear()
		timeout.clear()
		await waitForDelay(WAIT_MS)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(initial)
		expect(timeout.signal.aborted).toBe(false)
		expect(fired.count).toBe(0)
	})

	it('heavy synchronous start and clear churn leaves no delayed expiry', async () => {
		const timeout = new Timeout({ ms: MS })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		for (let cycle = 0; cycle < 1_000; cycle += 1) {
			timeout.start()
			timeout.clear()
		}
		await waitForDelay(WAIT_MS)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
		expect(fired.count).toBe(0)
	})

	it('repeated start leaves one observable expiry event', async () => {
		const timeout = new Timeout({ ms: MS })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		for (let cycle = 0; cycle < 500; cycle += 1) timeout.start()
		await waitForDelay(WAIT_MS)

		expect(timeout.expired).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('a later start replaces the prior deadline window', async () => {
		const timeout = new Timeout({ ms: 50 })

		timeout.start()
		await waitForDelay(20)
		const restarted = performance.now()
		timeout.start()
		const completion = new Promise<void>((resolve) => {
			timeout.signal.addEventListener('abort', () => resolve(), { once: true })
		})

		await completion
		expect(timeout.expired).toBe(true)
		expect(performance.now() - restarted).toBeGreaterThanOrEqual(40)
	})

	it('start after expiry swaps a fresh signal and expires again', async () => {
		const timeout = new Timeout({ ms: MS })

		timeout.start()
		await waitForDelay(WAIT_MS)
		const expired = timeout.signal
		expect(timeout.expired).toBe(true)
		expect(expired.aborted).toBe(true)

		timeout.start()
		expect(timeout.expired).toBe(false)
		expect(timeout.signal).not.toBe(expired)
		expect(timeout.signal.aborted).toBe(false)

		await waitForDelay(WAIT_MS)
		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('clear after expiry swaps a fresh non-aborted signal', async () => {
		const timeout = new Timeout({ ms: MS })

		timeout.start()
		await waitForDelay(WAIT_MS)
		const expired = timeout.signal

		timeout.clear()

		expect(timeout.expired).toBe(false)
		expect(timeout.signal).not.toBe(expired)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('keeps signal identity until a real expiry', async () => {
		const timeout = new Timeout({ ms: MS })
		const initial = timeout.signal

		timeout.start()
		expect(timeout.signal).toBe(initial)
		timeout.clear()
		expect(timeout.signal).toBe(initial)

		timeout.start()
		await waitForDelay(WAIT_MS)
		expect(timeout.signal).toBe(initial)
		expect(initial.aborted).toBe(true)
	})
})

describe('Timeout parent lifecycle', () => {
	it('parent abort while armed clears without aborting the timeout signal', async () => {
		const parent = new AbortController()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })
		const signal = timeout.signal
		const fired = createRecorder<readonly []>()
		signal.addEventListener('abort', fired.handler)

		timeout.start()
		parent.abort('parent stopped')
		await waitForDelay(WAIT_MS)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(signal)
		expect(timeout.signal.aborted).toBe(false)
		expect(fired.count).toBe(0)
	})

	it('parent abort after expiry does not reset a legitimate expiry', async () => {
		const parent = new AbortController()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })

		timeout.start()
		await waitForDelay(WAIT_MS)
		const expired = timeout.signal
		parent.abort()

		expect(timeout.expired).toBe(true)
		expect(timeout.signal).toBe(expired)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('preserves a parent link when an expiry listener restarts synchronously', async () => {
		const parent = new AbortController()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })
		const expired = timeout.signal
		let restarted: AbortSignal | undefined
		expired.addEventListener(
			'abort',
			() => {
				timeout.start()
				restarted = timeout.signal
				queueMicrotask(() => parent.abort())
			},
			{ once: true },
		)

		timeout.start()
		await waitForDelay(WAIT_MS)

		if (restarted === undefined) throw new Error('Expected the expiry listener to restart')
		expect(parent.signal.aborted).toBe(true)
		expect(restarted).not.toBe(expired)
		expect(timeout.signal).toBe(restarted)
		expect(restarted.aborted).toBe(false)
		expect(timeout.expired).toBe(false)
	})

	it('idle parent abort is inert and makes later start a no-op', async () => {
		const parent = new AbortController()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })
		const signal = timeout.signal

		parent.abort()
		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(signal)

		timeout.start()
		await waitForDelay(WAIT_MS)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(signal)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('parented start and clear churn remains inert after the parent aborts', async () => {
		const parent = new AbortController()
		const timeout = new Timeout({ ms: MS, signal: parent.signal })

		for (let cycle = 0; cycle < 1_000; cycle += 1) {
			timeout.start()
			timeout.clear()
		}
		parent.abort()
		timeout.start()
		await waitForDelay(WAIT_MS)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal.aborted).toBe(false)
	})
})

describe('Timeout type shape', () => {
	it('matches the public interface and option contract', () => {
		expectTypeOf<TimeoutInterface>().toHaveProperty('id').toEqualTypeOf<string>()
		expectTypeOf<TimeoutInterface>().toHaveProperty('ms').toEqualTypeOf<number>()
		expectTypeOf<TimeoutInterface>().toHaveProperty('signal').toEqualTypeOf<AbortSignal>()
		expectTypeOf<TimeoutInterface>().toHaveProperty('expired').toEqualTypeOf<boolean>()
		expectTypeOf<TimeoutInterface['start']>().toEqualTypeOf<() => void>()
		expectTypeOf<TimeoutInterface['clear']>().toEqualTypeOf<() => void>()
		expectTypeOf<TimeoutOptions>().toHaveProperty('id').toEqualTypeOf<string | undefined>()
		expectTypeOf<TimeoutOptions>().toHaveProperty('ms').toEqualTypeOf<number>()
		expectTypeOf<TimeoutOptions>().toHaveProperty('signal').toEqualTypeOf<AbortSignal | undefined>()
	})
})
