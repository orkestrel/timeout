import type { TimeoutInterface } from '@src/core'
import { createTimeout } from '@src/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createRecorder, waitForDelay } from '../../setup.js'

// The timeout factory — that `createTimeout` returns a working TimeoutInterface.
// Full behavior (clear, re-start, parent clearing) lives in Timeout.test.ts; here
// we only assert the factory hands back a usable handle that arms and expires.

const MS = 10

describe('createTimeout', () => {
	it('returns a working TimeoutInterface (start → expire)', async () => {
		const timeout = createTimeout({ ms: MS })
		const fired = createRecorder<readonly []>()
		timeout.signal.addEventListener('abort', fired.handler)

		expect(timeout.ms).toBe(MS)
		expect(timeout.expired).toBe(false)

		timeout.start()
		await waitForDelay(MS * 3)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
		expect(fired.count).toBe(1)
	})

	it('honors the id option', () => {
		const timeout = createTimeout({ id: 'deadline-9', ms: MS })

		expect(timeout.id).toBe('deadline-9')
	})

	it('createTimeout returns a TimeoutInterface', () => {
		expectTypeOf(createTimeout({ ms: MS })).toEqualTypeOf<TimeoutInterface>()
	})
})
