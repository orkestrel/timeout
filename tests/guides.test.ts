// The consumer-side guides-parity drop-in: runs `@orkestrel/guide`'s checks against
// this repo's own `guides/README.md` manifest, then executes this package's flagship
// fences. The constants below, the `@src/core` import the executed cases use, and the
// `flagship fences` block are this package's own, and are the parts a sibling package
// changes.

import { describe, expect, it } from 'vitest'
import {
	computeSymbolKey,
	createGuide,
	createSource,
	createSourceManager,
	extractFenceImports,
	findMissing,
	findMissingSymbols,
	findUnexampled,
	findUnlisted,
	isExternalLink,
	parseManifest,
	resolveLink,
} from '@orkestrel/guide'
import { readFileSync } from 'node:fs'
import { requireValue, waitForDelay } from '@orkestrel/test'
import { readInventory } from '@orkestrel/test/server'
import { createTimeout } from '@src/core'

/** Every fence language this package's guides are allowed to use. */
const FENCE_LANGUAGES = Object.freeze(['ts'])
/** The fence language whose blocks count as worked examples. */
const EXAMPLE_LANGUAGE = 'ts'
/** Each import specifier this package's own guides may resolve against. */
const MODULES = Object.freeze({ '@orkestrel/timeout': 'src/core', '@src/core': 'src/core' })
/**
 * Declarations deliberately kept out of the barrel, as `computeSymbolKey` strings.
 *
 * A class that one-class-per-file evicted from its single consumer cannot become a
 * local, so it stays exported without being public. Naming it here is what makes that
 * intentional rather than forgotten — and the second assertion below fails when a name
 * here stops being stranded, so the list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([])

/** Root-level files this package's guides link to. `readInventory` walks directories only. */
const ROOT_FILES = Object.freeze(['AGENTS.md'])

/** The guide whose flagship fences the executed cases at the end of this file transcribe. */
const CORE_GUIDE = 'guides/timeout.md'

const root = new URL('../', import.meta.url)
const files: Record<string, string> = {
	...readInventory(root, ['src', 'guides', 'tests'], { extensions: ['.ts', '.md'] }),
}
for (const name of ROOT_FILES) files[name] = readFileSync(new URL(name, root), 'utf8')
const manifest = parseManifest(
	requireValue(files['guides/README.md'], 'Missing file: guides/README.md'),
	'guides',
)
const sources = createSourceManager({ files, modules: MODULES })

it('manifest lists at least one guide', () => {
	expect(manifest.length).toBeGreaterThan(0)
})

for (const entry of manifest) {
	const guide = createGuide(requireValue(files[entry.spec], `Missing file: ${entry.spec}`))
	const source = createSource({ files, module: entry.source })

	describe(`${entry.concept}`, () => {
		it('uses only listed fence languages', () => {
			expect(findUnlisted(guide.fences(), FENCE_LANGUAGES)).toEqual([])
		})

		it('extracts a non-empty documented surface', () => {
			expect(guide.surface().length).toBeGreaterThan(0)
		})
		it('re-exports every direct declaration that is not named internal', () => {
			const stranded = findMissingSymbols(source.exports(), source.surface())
			expect(stranded.filter((key) => !INTERNAL.includes(key))).toEqual([])
		})
		it('names no symbol internal that the barrel already exports', () => {
			const stranded = findMissingSymbols(source.exports(), source.surface())
			expect(INTERNAL.filter((key) => !stranded.includes(key))).toEqual([])
		})
		it('re-exports only direct declarations', () => {
			expect(findMissingSymbols(source.surface(), source.exports())).toEqual([])
		})
		it('documents every barrel export', () => {
			expect(findMissingSymbols(source.surface(), guide.surface())).toEqual([])
		})
		it('documents only barrel exports', () => {
			expect(findMissingSymbols(guide.surface(), source.surface())).toEqual([])
		})

		it('exposes no hidden module-scope declarations', () => {
			expect(source.hidden().map(computeSymbolKey)).toEqual([])
		})

		for (const group of guide.methods()) {
			const members = source.methods(group.interface)
			const entity = group.interface.replace(/Interface$/, '')
			describe(`${group.interface}`, () => {
				it('documents at least one method', () => {
					expect(group.methods.length).toBeGreaterThan(0)
				})
				it('documents every interface method', () => {
					expect(findMissing(members, group.methods)).toEqual([])
				})
				it('documents no phantom method', () => {
					expect(findMissing(group.methods, members)).toEqual([])
				})
				it(`${entity} exposes no undocumented method`, () => {
					const extra =
						entity === group.interface ? [] : findMissing(source.methods(entity), group.methods)
					expect(extra).toEqual([])
				})
			})
		}

		it('documents an example for every Surface function', () => {
			const fences = guide
				.fences()
				.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
				.map((fence) => fence.code)
			const names = guide
				.surface()
				.filter((symbol) => symbol.keyword === 'function')
				.map((symbol) => symbol.name)
			expect(findUnexampled(names, fences, source.examples())).toEqual([])
		})

		for (const group of guide.methods()) {
			const entity = group.interface.replace(/Interface$/, '')
			describe(`${group.interface} examples`, () => {
				it('documents an example for every method', () => {
					const fences = guide
						.fences()
						.filter((fence) => fence.language === EXAMPLE_LANGUAGE)
						.map((fence) => fence.code)
					const examples =
						entity === group.interface
							? source.examples(group.interface)
							: source.examples(group.interface).concat(source.examples(entity))
					expect(findUnexampled(group.methods, fences, examples)).toEqual([])
				})
			})
		}

		it('imports only real exports in every ```ts fence', () => {
			const fences = guide.fences().filter((fence) => fence.language === EXAMPLE_LANGUAGE)
			for (const fence of fences) {
				for (const { specifier, names } of extractFenceImports(fence.code)) {
					const imported = sources.source(specifier)
					if (imported === undefined) continue
					const surface = imported.surface().map((symbol) => symbol.name)
					expect(findMissing(names, surface)).toEqual([])
				}
			}
		})

		it('resolves every relative link', () => {
			const broken = guide
				.links()
				.filter((href) => !isExternalLink(href))
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(broken).toEqual([])
		})
		it('links only to test files that exist', () => {
			const missing = guide
				.tests()
				.map((href) => resolveLink(entry.spec, href))
				.filter((path) => !source.exists(path))
			expect(missing).toEqual([])
		})
	})
}

// The EXECUTED half of this file. Every check up to here reads a name — from the
// guide text or from the barrel — and a name that resolves proves nothing about the
// sentence beside it, so a fence whose comment claims a value the code contradicts
// passes all of them. The cases here run each flagship fence and assert the values
// its comments claim, each paired with a presence guard binding that fence's whole
// body, so a line one fence shares with another cannot stand in for it. Change a
// fence, change the transcription beside it.
describe('flagship fences', () => {
	const guideText = requireValue(files[CORE_GUIDE], `Missing file: ${CORE_GUIDE}`)
	const readmeText = readFileSync(new URL('README.md', root), 'utf8')

	it('aborts the Surface fence signal on expiry', async () => {
		const timeout = createTimeout({ ms: 10 })

		timeout.start()
		expect(timeout.expired).toBe(false)
		await waitForDelay(40)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('carries the Surface fence lines the transcription copies', () => {
		expect(guideText).toContain(
			'const timeout = createTimeout({ ms: 5_000 })\ntimeout.start()\n\n// `signal` aborts on expiry — pass it anywhere a native AbortSignal is accepted:\nconst response = await fetch(url, { signal: timeout.signal })\n\ntimeout.clear() // work finished first — cancel the deadline',
		)
	})

	it('cancels the still-armed deadline the race fence clears in its finally', async () => {
		const timeout = createTimeout({ ms: 10 })
		const signal = timeout.signal

		timeout.start()
		timeout.clear()
		await waitForDelay(40)

		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(signal)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('carries the race fence and README clear lines the transcription copies', () => {
		expect(guideText).toContain(
			'\ttry {\n\t\treturn await fetch(url, { signal: timeout.signal })\n\t} finally {\n\t\ttimeout.clear() // cancels the still-armed deadline when the fetch won the race\n\t}',
		)
		expect(readmeText).toContain('timeout.clear() // work finished first — cancel the deadline')
	})

	it('leaves a parent-linked deadline unexpired when the parent aborts', async () => {
		const parent = new AbortController()
		const timeout = createTimeout({ id: 'request-deadline', ms: 10, signal: parent.signal })
		const signal = timeout.signal

		timeout.start()
		parent.abort()
		await waitForDelay(40)

		expect(timeout.id).toBe('request-deadline')
		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(signal)
		expect(timeout.signal.aborted).toBe(false)
	})

	it('carries the parent-link fence lines the transcription copies', () => {
		expect(guideText).toContain(
			"\tconst timeout = createTimeout({ id: 'request-deadline', ms, signal: parent })\n\ttimeout.start()\n\n\ttimeout.signal.addEventListener(\n\t\t'abort',\n\t\t() => {\n\t\t\tif (timeout.expired) giveUp() // only a real timeout expiry reaches this listener\n\t\t},\n\t\t{ once: true },\n\t)",
		)
	})

	it('reuses a cleared handle for a fresh deadline window', async () => {
		const timeout = createTimeout({ ms: 100 })
		const signal = timeout.signal

		timeout.start()
		timeout.clear()

		expect(timeout.expired).toBe(false)
		expect(timeout.signal).toBe(signal)

		timeout.start()
		expect(timeout.expired).toBe(false)
		await waitForDelay(140)

		expect(timeout.expired).toBe(true)
		expect(timeout.signal.aborted).toBe(true)
	})

	it('carries the reuse fence lines the transcription copies', () => {
		expect(guideText).toContain(
			'const timeout = createTimeout({ ms: 100 })\n\ntimeout.start()\ntimeout.clear() // cancels before firing — expired stays false\n\ntimeout.start() // re-armed; a fresh deadline window begins',
		)
	})
})
