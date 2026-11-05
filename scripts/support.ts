// The "Supporting these!" section, drawn as the site's modal: a title window followed by
// one window per cause. Each cause is its own SVG so the README can wrap it in a link
// (images shown through <img> can't hold links themselves).
//
// Run through scripts/build.ts, which hands over the site repo in JAKEAYY_SITE.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE = resolve(process.env.JAKEAYY_SITE ?? '../jakeayy.ch');
const read = (p: string) => readFileSync(resolve(SITE, p));

const FG = '#f1f1f1';
const MID = '#8e8e8e';
const W = 1024;
/** the windowskin is drawn at 2× so its 8px tiles become 16px */
const T = 16;

const fontBody = read('src/lib/assets/fonts/bestten-crt.woff2').toString('base64');
const fontLabel = read('src/lib/assets/fonts/vcr-osd-mono.woff2').toString('base64');
const windowPaths = read('src/lib/assets/isat/window.svg')
	.toString()
	.match(/<path [^>]*\/>/g)!
	.join('');

// 20×20 glyphs in the same style as the site's orbit icons: '#' light, '+' mid
const glyphs: Record<string, string[]> = {
	heart: [
		'....................',
		'....................',
		'....................',
		'...####....####.....',
		'..######..######....',
		'.##++####.#######...',
		'.#+##############...',
		'.#+##############...',
		'.################...',
		'..##############....',
		'...############.....',
		'....##########......',
		'.....########.......',
		'......######........',
		'.......####.........',
		'........##..........',
		'....................',
		'....................',
		'....................',
		'....................'
	],
	// an open padlock
	unlock: [
		'....................',
		'.........######.....',
		'........##....##....',
		'.......##......##...',
		'.......#........#...',
		'.......#........#...',
		'.......#........#...',
		'.......#............',
		'..############......',
		'..############......',
		'..#####++#####......',
		'..####++++####......',
		'..####++++####......',
		'..#####++#####......',
		'..#####++#####......',
		'..#####++#####......',
		'..############......',
		'..############......',
		'....................',
		'....................'
	],
	// an envelope under a magnifying glass
	scan: [
		'....................',
		'....................',
		'.###############....',
		'.##+.........+##....',
		'.#.+#.......#+.#....',
		'.#...##...##...#....',
		'.#.....###.....#....',
		'.#........#####.....',
		'.#.......#.....#....',
		'.#......#.......#...',
		'.#......#.......#...',
		'.#######........#...',
		'.........#.....#....',
		'..........#####+....',
		'...............++...',
		'................++..',
		'.................++.',
		'..................+.',
		'....................',
		'....................'
	],
	// a gavel over its block
	gavel: [
		'....................',
		'.......##...........',
		'......####..........',
		'.....######.........',
		'....########........',
		'.....########.......',
		'......#######+......',
		'.......#####++......',
		'........###++.......',
		'.........#+++.......',
		'..........+++.......',
		'...........+++......',
		'............+++.....',
		'.............+++....',
		'..............+++...',
		'....................',
		'..##########........',
		'.############.......',
		'.++++++++++++.......',
		'....................'
	],
	// a gamepad with a heart where the d-pad would be
	gamepad: [
		'....................',
		'....................',
		'....................',
		'....................',
		'...############.....',
		'..##############....',
		'.##.#.#######..##...',
		'.#.....#####.#..#...',
		'.#.....####.....#...',
		'.##...#####.#..##...',
		'.###.##########.#...',
		'.################...',
		'.#######++#######...',
		'.######++++######...',
		'.#####......#####...',
		'..###........###....',
		'....................',
		'....................',
		'....................',
		'....................'
	]
};

/** a line of text, as segments; `true` marks the words that stand out */
type Line = [string, boolean?][];

interface Cause {
	id: string;
	title: string;
	where: string;
	url: string;
	glyph: string;
	action: string;
	lines: Line[];
}

export const causes: Cause[] = [
	{
		id: 'keep-android-open',
		title: 'Keep Android Open',
		where: 'keepandroidopen.org',
		url: 'https://keepandroidopen.org/',
		glyph: 'unlock',
		action: 'sign',
		lines: [
			[['Google wants every app developer to '], ['verify their ID with them', true], [',']],
			[['even for apps published outside the Play Store. '], ['They keep lying about it.', true]]
		]
	},
	{
		id: 'fight-chat-control',
		title: 'Fight Chat Control',
		where: 'fightchatcontrol.eu',
		url: 'https://fightchatcontrol.eu/',
		glyph: 'scan',
		action: 'sign',
		lines: [
			[['The EU proposal would mandate '], ['scanning all private messages', true], [',']],
			[['encrypted ones and photos too. '], ['A threat to every EU citizen.', true]]
		]
	},
	{
		id: 'hold-mojang-accountable',
		title: 'Hold Mojang Accountable',
		where: 'youtube.com · video with update',
		url: 'https://www.youtube.com/watch?v=w_UF_4gZclI',
		glyph: 'gavel',
		action: 'watch',
		lines: [
			[['A '], ['forced migration that locked people out of what they bought', true], [',']],
			[['EULA changes nobody was told about, and other shady practices.']]
		]
	},
	{
		id: 'stop-killing-games',
		title: 'Stop Killing Games',
		where: 'stopkillinggames.com',
		url: 'https://www.stopkillinggames.com/',
		glyph: 'gamepad',
		action: 'sign',
		lines: [
			[['Publishers sell games with no expiry date, then '], ['make them unplayable', true]],
			[['once support ends. That kills preservation, and it may not even be legal.']]
		]
	}
];

// ---------------------------------------------------------------- pieces

let seed = 0x73746172;
const rand = () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = seed;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function glyph(name: string, x: number, y: number, size: number) {
	let light = '';
	let mid = '';
	glyphs[name]!.forEach((row, yy) => {
		for (let xx = 0; xx < row.length; xx++) {
			if (row[xx] === '#') light += `M${xx} ${yy}h1v1h-1z`;
			else if (row[xx] === '+') mid += `M${xx} ${yy}h1v1h-1z`;
		}
	});
	// a scaled group rather than a nested <svg>: Firefox clips filters on nested viewports
	return `<g transform="translate(${x} ${y}) scale(${size / 20})" shape-rendering="crispEdges" filter="url(#glyph-glow)"><path fill="${FG}" d="${light}"/><path fill="${MID}" d="${mid}"/></g>`;
}

/**
 * One slice of the site's windowskin, w×h. The README stacks the slices into a single
 * window, so only the first one draws the top edge and only the last one the bottom.
 */
function frame(w: number, h: number, { top = true, bottom = true } = {}) {
	const tile = (sx: number, sy: number, x: number, y: number) =>
		`<svg x="${x}" y="${y}" width="${T}" height="${T}" viewBox="${sx} ${sy} 8 8"><use href="#win" width="24" height="24"/></svg>`;
	const y0 = top ? T : 0;
	const y1 = bottom ? h - T : h;
	// edges are one pattern-filled strip each: tiling them one by one leaves seams in Firefox
	const edge = (id: string, x: number, y: number, ew: number, eh: number) =>
		`<rect x="${x}" y="${y}" width="${ew}" height="${eh}" fill="url(#${id})"/>`;
	const parts = [`<rect x="${T}" y="${y0}" width="${w - 2 * T}" height="${y1 - y0}" fill="#000"/>`];
	if (top) parts.push(tile(0, 0, 0, 0), tile(16, 0, w - T, 0), edge('edge-t', T, 0, w - 2 * T, T));
	if (bottom)
		parts.push(tile(0, 16, 0, h - T), tile(16, 16, w - T, h - T), edge('edge-b', T, h - T, w - 2 * T, T));
	parts.push(edge('edge-l', 0, y0, T, y1 - y0), edge('edge-r', w - T, y0, T, y1 - y0));
	return parts.join('');
}

/** the windowskin's edge tiles as patterns, lined up with the 16px grid every slice sits on */
const edgePatterns = (
	[
		['edge-t', 8, 0],
		['edge-b', 8, 16],
		['edge-l', 0, 8],
		['edge-r', 16, 8]
	] as const
)
	.map(
		([id, sx, sy]) =>
			`<pattern id="${id}" width="${T}" height="${T}" patternUnits="userSpaceOnUse" viewBox="${sx} ${sy} 8 8"><use href="#win" width="24" height="24"/></pattern>`
	)
	.join('');

/** a faint dotted rule between two causes */
const divider = (w: number) =>
	`<path d="M${T + 28} 1H${w - T - 28}" stroke="#3a3a3a" stroke-width="2" stroke-dasharray="2 6"/>`;

/** a few faint stars twinkling inside the window */
function twinkles(w: number, h: number, count: number) {
	const out = [];
	for (let i = 0; i < count; i++) {
		const x = Math.round(T * 2 + rand() * (w - T * 4));
		const y = Math.round(T * 2 + rand() * (h - T * 4));
		const size = rand() < 0.25 ? 2 : 1;
		const p = (2 + rand() * 4).toFixed(2);
		out.push(
			`<rect class="tw" x="${x}" y="${y}" width="${size}" height="${size}" opacity="${(0.2 + rand() * 0.35).toFixed(2)}" style="--p:${p}s;--d:-${(rand() * +p).toFixed(2)}s"/>`
		);
	}
	return `<g fill="${FG}">${out.join('')}</g>`;
}

function svg(h: number, label: string, chrome: string, body: string, delay: number) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}">
<title>${esc(label)}</title>
<style>
@font-face{font-family:B;src:url(data:font/woff2;base64,${fontBody}) format("woff2")}
@font-face{font-family:V;src:url(data:font/woff2;base64,${fontLabel}) format("woff2")}
text{font-family:B,monospace;fill:${FG}}
.label{font-family:V,monospace;text-transform:uppercase;letter-spacing:.06em}
.mid{fill:${MID}}
.open{animation:open .5s cubic-bezier(.33,1,.68,1) ${delay}s both}
@keyframes open{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.tw{animation:tw var(--p) ease-in-out var(--d) infinite alternate}
@keyframes tw{from{opacity:.05}}
.nudge{animation:nudge 1.2s steps(2) infinite}
@keyframes nudge{50%{transform:translateX(5px)}}
.breathe{animation:breathe 3s ease-in-out infinite}
@keyframes breathe{50%{opacity:.45}}
</style>
<defs>
<symbol id="win" viewBox="0 0 24 24" shape-rendering="crispEdges">${windowPaths}</symbol>
${edgePatterns}
<filter id="glyph-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation=".35"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feComponentTransfer result="g"><feFuncR type="linear" intercept=".95"/><feFuncG type="linear" intercept=".95"/><feFuncB type="linear" intercept=".95"/></feComponentTransfer><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
${chrome}
<g class="open">${body}</g>
</svg>
`;
}

// ---------------------------------------------------------------- the title window

const HEADER_H = T * 11;
const header = svg(
	HEADER_H,
	'Supporting these!',
	frame(W, HEADER_H, { bottom: false }) + twinkles(W, HEADER_H, 18),
	glyph('heart', 44, 34, 48) +
		`<text class="label" x="108" y="74" font-size="40">Supporting these!</text>` +
		`<text class="label mid breathe" x="${W - 44}" y="70" font-size="18" text-anchor="end">${causes.length} causes</text>` +
		`<text class="mid" x="46" y="122" font-size="22">If it applies to you, please sign these. It helps make the world a little better!</text>` +
		`<text class="mid" x="46" y="150" font-size="22">If you can't, share them around so someone who can will sign instead.</text>`,
	0.1
);

// ---------------------------------------------------------------- one window per cause

const card = (c: Cause, i: number) => {
	const last = i === causes.length - 1;
	const h = last ? T * 12 : T * 11;
	const lines = c.lines
		.map(
			(line, k) =>
				`<text x="148" y="${130 + k * 30}" font-size="22">${line
					.filter((seg) => seg.length)
					.map(([text, strong]) => `<tspan${strong ? '' : ` class="mid"`}>${esc(text!)}</tspan>`)
					.join('')}</text>`
		)
		.join('');
	const action = c.action.toUpperCase();
	return svg(
		h,
		`${c.title}: ${c.where}`,
		frame(W, h, { top: false, bottom: last }) + divider(W) + twinkles(W, h, 14),
		glyph(c.glyph, 44, 52, 80) +
			`<text x="148" y="68" font-size="36">${esc(c.title)}</text>` +
			`<text class="label mid" x="148" y="94" font-size="16">${esc(c.where)}</text>` +
			lines +
			// the call to action, like a menu cursor waiting for input
			`<g transform="translate(${W - 44} 64)"><text class="label" text-anchor="end" x="-28" y="0" font-size="20">${action}</text>` +
			`<g class="nudge"><path fill="${FG}" shape-rendering="crispEdges" d="M-18 -16h4v16h-4zM-14 -14h4v12h-4zM-10 -12h4v8h-4zM-6 -10h4v4h-4z"/></g></g>`,
		0.25 + i * 0.12
	);
};

/** every SVG of the section, by its path in the profile repo */
export const files: Record<string, string> = {
	'support/header.svg': header,
	...Object.fromEntries(causes.map((c, i) => [`support/${c.id}.svg`, card(c, i)]))
};

// the README block
const alt = (c: Cause) =>
	`${c.title} (${c.where}): ${c.lines.map((l) => l.map((s) => s[0] ?? '').join('')).join(' ')}`.replace(
		/"/g,
		'&quot;'
	);
export const markdown = [
		'<div>',
		`<img src="support/header.svg" width="100%" align="top" alt="Supporting these! If it applies to you, please sign these. If you can't, share them around so someone who can will sign instead." />`,
		...causes.map(
			(c) => `<a href="${c.url}"><img src="support/${c.id}.svg" width="100%" align="top" alt="${alt(c)}" /></a>`
		),
		'</div>'
	].join('\n');
