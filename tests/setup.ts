// The fleet-wide helpers — `waitForDelay`, `createRecorder`, `RecorderInterface` — live in
// `@orkestrel/test`. What remains here is specific to this package.

/**
 * Creates a proxy over `target` that records every property key read through it.
 *
 * @remarks
 * The record lives in the returned object rather than at module scope, so each
 * call owns its own recording and no test resets shared state.
 *
 * @param target - The object a driver reads through the returned proxy
 * @returns The read property keys in read order, beside the recording proxy
 *
 * @example
 * ```ts
 * const recorder = createReadRecorder({ ms: 10 })
 * recorder.proxy.ms
 * recorder.reads // ['ms']
 * ```
 */
export function createReadRecorder<T extends object>(
	target: T,
): { readonly reads: readonly PropertyKey[]; readonly proxy: T } {
	const reads: PropertyKey[] = []
	const proxy = new Proxy(target, {
		get(source, property, receiver) {
			reads.push(property)
			return Reflect.get(source, property, receiver)
		},
	})
	return { reads, proxy }
}
