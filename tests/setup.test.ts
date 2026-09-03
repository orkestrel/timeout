import { describe, expect, it } from 'vitest'
import { createReadRecorder } from './setup.js'

describe('createReadRecorder', () => {
	it('reports the property keys a driver read, in read order', () => {
		const recorder = createReadRecorder({ id: 'deadline', ms: 10 })

		// Second route: the driver below reads this literal key sequence, so the
		// expectation is the sequence written here rather than the recorder's own output.
		const driven: readonly PropertyKey[] = ['ms', 'id', 'ms']
		const first = recorder.proxy.ms
		const label = recorder.proxy.id
		const second = recorder.proxy.ms

		expect(recorder.reads).toEqual(driven)
		expect(first).toBe(10)
		expect(label).toBe('deadline')
		expect(second).toBe(10)
	})

	it('reports an empty list for a proxy no driver touched', () => {
		const recorder = createReadRecorder({ id: 'deadline', ms: 10 })

		expect(recorder.reads).toEqual([])
	})
})
