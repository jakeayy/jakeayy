// Builds the whole profile README: the animated banner, the "Supporting these!" windows,
// all of it run through svgo, and the README.md that puts them together.
//
// usage: pnpm build [path to the jakeayy.ch repo, defaults to ../jakeayy.ch]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { optimize, type Config } from 'svgo';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// the generators read the site's icon, glyphs, fonts and text from here
process.env.JAKEAYY_SITE = resolve(process.argv[2] ?? resolve(ROOT, '../jakeayy.ch'));

const { default: banner } = await import('./banner.ts');
const support = await import('./support.ts');

const svgo: Config = {
	multipass: true,
	plugins: [
		{
			name: 'preset-default',
			params: {
				overrides: {
					// elements start at opacity 0 and get animated in, they're not hidden
					removeHiddenElems: false,
					// keep the classes, the keyframes and the per-element timings in <style>
					inlineStyles: false,
					// the dust is drawn as zero-length "h0" segments with square caps
					convertPathData: false,
					// these move transforms between groups and children, where they'd clash
					// with the CSS transform animations
					collapseGroups: false,
					moveGroupAttrsToElems: false,
					moveElemsAttrsToGroup: false,
					mergePaths: false
				}
			}
		}
	]
};

const files: Record<string, string> = {
	'readme.svg': banner,
	...support.files
};

/**
 * Cuts every embedded font down to the characters the SVG actually draws. Labels are
 * uppercased in CSS, so both cases of every letter are kept.
 */
async function subsetFonts(svg: string) {
	const text = [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
		.map(([, inner]) => inner!.replace(/<[^>]+>/g, ''))
		.join('')
		.replace(/&lt;/g, '<')
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&');
	const chars = [...new Set([...text.toLowerCase(), ...text.toUpperCase(), ' '])].join('');

	const fonts = [...svg.matchAll(/url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g)];
	for (const [match, base64] of fonts) {
		const font = await subsetFont(Buffer.from(base64!, 'base64'), chars, { targetFormat: 'woff2' });
		svg = svg.replace(match, `url(data:font/woff2;base64,${font.toString('base64')})`);
	}
	return svg;
}

const kb = (s: string) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
for (const [path, raw] of Object.entries(files)) {
	const { data } = optimize(await subsetFonts(raw), { ...svgo, path });
	const out = resolve(ROOT, path);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, data);
	console.log(`${relative(ROOT, out).padEnd(36)} ${kb(raw).padStart(9)} → ${kb(data)}`);
}

const readme = `<a href="https://jakeayy.ch" target="_blank"><img src="readme.svg" width="100%" /></a>

<br>

${support.markdown}
`;
writeFileSync(resolve(ROOT, 'README.md'), readme);
console.log('README.md');
