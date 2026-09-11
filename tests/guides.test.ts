// The consumer-side guides-parity drop-in: runs `@orkestrel/guide`'s checks against
// this repo's own `guides/README.md` manifest. The constants that follow are this
// package's own, as is the executed section that closes the file.

import { GuideCommand } from '@orkestrel/guide/server'
import { readInventory } from '@orkestrel/test/server'
import { createVitest } from 'vitest/node'

/** Every fence language this package's guides are allowed to use. */
const FENCE_LANGUAGES = Object.freeze(['ts'])
/** The fence language whose blocks count as worked examples. */
const EXAMPLE_LANGUAGE = 'ts'
/** The one guide this package sources, whose tagline the README pitch equals. */
const GUIDE_SPEC = 'guides/timeout.md'
/** The package identity the guide manifest and package manifest must share. */
const PACKAGE_MODULE = '@orkestrel/timeout'
/** Each import specifier this package's own guides may resolve against. */
const MODULES = Object.freeze({ [PACKAGE_MODULE]: 'src/core', '@src/core': 'src/core' })
/**
 * Declarations deliberately kept out of the barrel, as `computeSymbolKey` strings.
 *
 * A class that one-class-per-file evicted from its single consumer cannot become a
 * local, so it stays exported without being public. Naming it here is what makes that
 * intentional rather than forgotten — and the assertion that follows it fails when a name
 * here stops being stranded, so the list cannot rot.
 */
const INTERNAL: readonly string[] = Object.freeze([])

await new GuideCommand({
	root: new URL('../', import.meta.url),
	patterns: ['src/**/*.ts', 'tests/**/*.ts', 'guides/*.md', '*.md', 'package.json'],
	modules: MODULES,
	languages: FENCE_LANGUAGES,
	language: EXAMPLE_LANGUAGE,
	reader: readInventory,
	runner: createVitest,
}).execute(async ({ files, report, rows }) => {
	const { isRecord, parseJSON } = await import('@orkestrel/contract')
	const { computeSymbolKey, findMissingSymbols } = await import('@orkestrel/guide')
	const { requireValue, waitForDelay } = await import('@orkestrel/test')
	const { createTimeout } = await import('@src/core')
	const { describe, expect, it } = await import('vitest')

	it('manifest lists at least one guide', () => {
		expect(report.input).toEqual([])
		expect(rows.length).toBeGreaterThan(0)
		expect(rows.map((row) => row.entry.spec)).toContain(GUIDE_SPEC)
	})

	// The example half of the equality case is silent over an empty population: with no
	// title on both sides `findDrift` compares no pair and the case passes on the summaries
	// alone. This pins the population this repository's own guide contributes, so removing
	// every `@example` title reddens the suite instead of quietly retiring half the gate.
	// The failure names both title sets, because a pin reporting only its own emptiness
	// leaves the reader to work out which side dropped the title.
	it('pairs at least one example title across the guide and the source', () => {
		expect(report.examples.titles.filter((finding) => finding.spec === GUIDE_SPEC)).toEqual([])
	})

	// The README's pitch and the guide's tagline are one text, each read as the blockquote
	// under its file's H1. `README.md` is outside the concept index, so the reader is
	// applied to it directly rather than through a manifest row. Each side is guarded
	// against `undefined` first, so a file that lost its blockquote reports that rather
	// than reporting two absences as agreement.
	it('opens the README with the guide tagline', () => {
		const manifest = parseJSON(requireValue(files['package.json'], 'Missing file: package.json'))
		expect(isRecord(manifest) ? manifest.name : undefined).toBe(PACKAGE_MODULE)
		expect(report.pitch).toEqual([])
	})

	for (const { entry, guide, source } of rows) {
		describe(`${entry.concept}`, () => {
			it('uses only listed fence languages', () => {
				expect(report.fences.filter((finding) => finding.spec === entry.spec)).toEqual([])
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

			it('carries every required populated section', () => {
				expect(report.sections.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('keeps behavioral interfaces and implementing classes in parity', () => {
				expect(report.methods.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('documents every behavioral declaration', () => {
				expect(report.declarations.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			// The equality gate: a `Summary` cell against its export's description paragraph, a
			// titled fence against the `@example` of that title. `findDrift` owns the comparison
			// and names both sides; converge the two sides through the native entry, never by
			// weakening this assertion. `findDrift` pairs an example only where a title is
			// present on both sides, so an untitled `@example` block is outside this case. Each
			// collected line is the spec, the key, and each side's text or `absent` — the same
			// worklist the native entry prints, so a failure here is read the way that command's
			// output is. Select source authority with `--to guide`, or guide authority with
			// `--to source`.
			it('keeps every compared summary and example equal to its source', () => {
				expect(report.drift.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('keeps the executable example population non-empty', () => {
				expect(report.examples.fences.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('documents an example for every Surface function', () => {
				expect(report.examples.functions.filter((finding) => finding.spec === entry.spec)).toEqual(
					[],
				)
			})

			it('documents an example for every method', () => {
				expect(report.examples.methods.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('imports only real exports in every ```ts fence', () => {
				expect(report.imports.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})

			it('resolves every relative link', () => {
				expect(report.links.filter((finding) => finding.spec === entry.spec)).toEqual([])
			})
			it('links only to test files that exist', () => {
				expect(report.tests.filter((finding) => finding.spec === entry.spec)).toEqual([])
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
		const guideText = requireValue(files[GUIDE_SPEC], `Missing file: ${GUIDE_SPEC}`)
		const readmeText = requireValue(files['README.md'], 'Missing file: README.md')

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
})
