import { describe, expect, it } from 'vitest'
import { isBrowserVuePath } from './setup'

describe('isBrowserVuePath', () => {
	it('accepts a repository-relative browser application path under each separator family', () => {
		const forward = 'app/browser/components/Button.vue'
		const backslash = String.raw`app\browser\components\Button.vue`
		const mixed = String.raw`app/browser\pages\Home.vue`

		// Second route: split into segments after normalizing either separator, and check the
		// leading two segments are exactly ['app', 'browser'] rather than re-deriving through the
		// module's own startsWith check.
		for (const path of [forward, backslash, mixed]) {
			const segments = path.split(/[/\\]/u)
			expect(segments.slice(0, 2)).toEqual(['app', 'browser'])
			expect(isBrowserVuePath(path)).toBe(true)
		}
	})

	it('refuses a sibling application path and a prefix lookalike', () => {
		const sibling = 'app/server/routes.ts'
		const prefixLookalike = 'app/browserish/Component.vue'
		const unrelated = 'src/browser/index.ts'

		for (const path of [sibling, prefixLookalike, unrelated]) {
			const segments = path.split(/[/\\]/u)
			expect(segments.slice(0, 2)).not.toEqual(['app', 'browser'])
			expect(isBrowserVuePath(path)).toBe(false)
		}
	})
})
