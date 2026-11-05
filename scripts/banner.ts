// Bakes the jakeayy.ch homepage animation (stars swirling into the icon, then the orbit
// opening) into a self-contained animated SVG for the profile README.
//
// GitHub shows README images through <img>, so there's no JavaScript and no hover:
// everything runs on CSS and SMIL, and the orbit opens on its own after the icon forms.
//
// Most motion is a shared CSS keyframe driven by a few custom properties per element
// (a swirl is just "rotate while the radius shrinks"), which keeps the file small.
//
// Run through scripts/build.ts, which hands over the site repo in JAKEAYY_SITE.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SITE = resolve(process.env.JAKEAYY_SITE ?? '../jakeayy.ch');
const read = (p: string) => readFileSync(resolve(SITE, p));

const { glyphs } = await import(pathToFileURL(resolve(SITE, 'src/lib/pixel-icons.ts')).href);
const { site, sections, socials } = await import(
	pathToFileURL(resolve(SITE, 'src/lib/content.ts')).href
);

// ---------------------------------------------------------------- helpers

const FG = '#f1f1f1';
const MID = '#8e8e8e';
const TAU = Math.PI * 2;

// seeded, so regenerating gives the same picture
let seed = 0x6a616b65;
const rand = () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = seed;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const positiveAngle = (a: number) => ((a % TAU) + TAU) % TAU;
const deg = (radians: number) => (radians * 180) / Math.PI;
const n = (v: number, d = 1) => String(+v.toFixed(d));
const s = (v: number) => `${n(v, 3)}s`;

/** cells as a path, merging each row's neighbours into one run */
function runs(cells: { x: number; y: number }[]) {
	const rows = new Map<number, number[]>();
	for (const c of cells) {
		if (!rows.has(c.y)) rows.set(c.y, []);
		rows.get(c.y)!.push(c.x);
	}
	let d = '';
	for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
		xs.sort((a, b) => a - b);
		for (let i = 0; i < xs.length; ) {
			let j = i;
			while (j + 1 < xs.length && xs[j + 1] === xs[j]! + 1) j++;
			const w = j - i + 1;
			d += `M${xs[i]} ${y}h${w}v1h-${w}z`;
			i = j + 1;
		}
	}
	return d;
}

// ---------------------------------------------------------------- the icon

type Tone = 'outline' | 'fill' | 'shade';
const TONE: Record<string, Tone> = { '#000000': 'outline', '#f1f1f1': 'fill', '#8e8e8e': 'shade' };
const TONE_COLOR: Record<Tone, string> = { outline: '#000', fill: FG, shade: MID };
const TONES: Tone[] = ['outline', 'fill', 'shade'];

const iconSvg = read('src/lib/assets/icon.svg').toString();
const [, iw, ih] = iconSvg.match(/viewBox="0 0 (\d+) (\d+)"/)!;
const icon = { width: +iw!, height: +ih!, pixels: [] as { x: number; y: number; tone: Tone }[] };
for (const [, attrs] of iconSvg.matchAll(/<path ([^>]*)\/>/g)) {
	if (attrs!.includes('fill-opacity')) continue;
	const tone = TONE[attrs!.match(/fill="(#\w+)"/)?.[1] ?? ''];
	const d = attrs!.match(/ d="([^"]+)"/)?.[1];
	if (!tone || !d) continue;
	for (const [, x, y, w, h] of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)/g))
		for (let yy = +y!; yy < +y! + +h!; yy++)
			for (let xx = +x!; xx < +x! + +w!; xx++) icon.pixels.push({ x: xx, y: yy, tone });
}

// ---------------------------------------------------------------- layout

const W = 1280;
const H = 640;
const cell = 6;
const iconW = icon.width * cell;
const iconH = icon.height * cell;
const cx = W / 2;
const cy = 262;
const iconX = Math.round(cx - iconW / 2);
const iconY = Math.round(cy - iconH / 2);
const half = Math.max(iconW, iconH) / 2;
const outer = Math.min(half * 3.1, W / 2 - 34, H * 0.44);
const inner = Math.min(half * 2.05, outer * 0.68);
const radii = [inner, outer] as const;
const flatten = 0.4;
const tilt = -0.22;
const tiltDeg = deg(tilt);
/** the orbit plane: anything rotating inside this group traces the tilted ellipse */
const orbitPlane = `translate(${cx} ${cy}) rotate(${n(tiltDeg, 3)}) scale(1 ${flatten})`;
/** undoes the orbit plane's squash and tilt, so what orbits stays upright */
const upright = `scale(1 ${n(1 / flatten, 3)}) rotate(${n(-tiltDeg, 3)})`;

const orbitPoint = (r: number, theta: number) => {
	const X = r * Math.cos(theta);
	const Y = r * flatten * Math.sin(theta);
	return {
		x: cx + X * Math.cos(tilt) - Y * Math.sin(tilt),
		y: cy + X * Math.sin(tilt) + Y * Math.cos(tilt)
	};
};

const css: string[] = [];

// ---------------------------------------------------------------- formation

// every pixel of the icon starts as a star somewhere on screen and swirls into place:
// rotate(start angle → end angle) translateX(start radius → end radius) around the centre
const particles = icon.pixels.map((p) => ({
	...p,
	sx: Math.round(rand() * W),
	sy: Math.round(rand() * H),
	tx: iconX + p.x * cell + cell / 2,
	ty: iconY + p.y * cell + cell / 2,
	delay: +(0.2 + rand() * 1.1).toFixed(2),
	duration: +(1.5 + rand() * 0.9).toFixed(2),
	spin: 0.9 + rand() * 0.8
}));
const FORMED = Math.max(...particles.map((p) => p.delay + p.duration));
const OPEN = FORMED + 2.4;

const formation = particles.map((p) => {
	const a0 = Math.atan2(p.sy - cy, p.sx - cx);
	const r0 = Math.hypot(p.sy - cy, p.sx - cx);
	const a1 = Math.atan2(p.ty - cy, p.tx - cx);
	const r1 = Math.hypot(p.ty - cy, p.tx - cx);
	// always swirl the same way, by at least `spin`, and end exactly on the pixel
	const end = a0 + positiveAngle(a1 - a0 - p.spin) + p.spin;
	return `<g class="p" style="--a:${n(deg(a0), 0)};--r:${n(r0, 0)};--b:${n(deg(end), 2)};--s:${n(r1, 2)};--t:${p.delay};--u:${p.duration}"><use href="#star" class="s"/><use href="#px-${p.tone}" class="q"/></g>`;
});

// ---------------------------------------------------------------- background stars

// small stars sharing a twinkle and a brightness are one path of zero-length square-capped dots
const TWINKLES = [1.3, 1.9, 2.6, 3.3, 4.2, 5.3];
TWINKLES.forEach((p, i) =>
	css.push(`.t${i}{animation:tw ${p}s ease-in-out -${n(rand() * p, 2)}s infinite alternate}`)
);
const ALPHAS = [0.25, 0.42, 0.6];
const smallStars = new Map<string, string>();
const bigStars: string[] = [];
const starCount = Math.round((W * H) / 4200);
for (let i = 0; i < starCount; i++) {
	const big = rand() < 0.08;
	const size = big ? 2 : rand() < 0.35 ? 1.5 : 1;
	const alpha = big ? 0.7 + rand() * 0.3 : 0.15 + rand() * 0.5;
	const x = Math.round(rand() * W);
	const y = Math.round(rand() * H);
	if (big) {
		const period = TAU / (0.4 + rand() * 1.6);
		const timing = `--p:${s(period)};--d:-${s(rand() * period)}`;
		bigStars.push(
			`<g transform="translate(${x} ${y})" opacity="${n(alpha, 2)}"><g class="tw" style="${timing}"><use href="#star"/></g><g class="flare" style="${timing}"><use href="#cross" transform="scale(1.6)"/></g></g>`
		);
	} else {
		const tw = Math.floor(rand() * TWINKLES.length);
		const a = ALPHAS.reduce((best, v) => (Math.abs(v - alpha) < Math.abs(best - alpha) ? v : best));
		const key = `${tw}|${a}|${size}`;
		smallStars.set(key, (smallStars.get(key) ?? '') + `M${x} ${y}h0`);
	}
}
const stars = [...smallStars].map(([key, d]) => {
	const [tw, a, size] = key.split('|');
	return `<path class="t${tw}" d="${d}" stroke-width="${size}" stroke-opacity="${a}"/>`;
});

// meteors, each on its own long cycle
const meteors: string[] = [];
for (let i = 0; i < 3; i++) {
	const period = 11 + i * 6.5 + rand() * 4;
	const first = 5 + i * 4.5 + rand() * 3;
	const dir = rand() < 0.5 ? -1 : 1;
	const angle = (0.25 + rand() * 0.35) * dir;
	const speed = 650 + rand() * 350;
	const life = 0.7 + rand() * 0.4;
	const x = dir > 0 ? rand() * W * 0.6 : W * (0.4 + rand() * 0.6);
	const y = rand() * H * 0.35;
	const rotation = dir > 0 ? deg(angle) : 180 - deg(angle);
	const len = speed * 0.13;
	const f = (life / period) * 100;
	css.push(
		`@keyframes m${i}{0%{transform:translateX(0);opacity:0}${n(f * 0.5, 2)}%{opacity:1}${n(f, 2)}%,100%{transform:translateX(${n(speed * life)}px);opacity:0}}`
	);
	meteors.push(
		`<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rotation, 2)})"><g style="animation:m${i} ${s(period)} linear ${s(first)} infinite both"><rect x="-${n(len)}" y="-.75" width="${n(len)}" height="1.5" fill="url(#tail)"/><use href="#star" transform="scale(.75)"/></g></g>`
	);
}

// ---------------------------------------------------------------- galaxy

// everything is timed in CSS: SMIL runs on its own clock, which starts a few hundred
// milliseconds earlier, and mixing the two puts the flights and the orbits out of step
const galaxy: string[] = [];
galaxy.push(
	`<g transform="translate(${cx} ${cy}) rotate(${n(tiltDeg, 3)})" class="galaxy">`,
	`<g class="paths">`,
	...radii.map(
		(r) =>
			`<ellipse rx="${n(r)}" ry="${n(r * flatten)}" fill="none" stroke="${FG}" stroke-opacity=".13" stroke-dasharray="2 7" vector-effect="non-scaling-stroke"/>`
	),
	`</g>`,
	`<g class="spiral">`,
	`<g transform="scale(1 ${flatten})">`
);

// spiral dust, binned into bands that each turn at their own speed
const BANDS = 10;
const bands: { size: number; tw: number; d: string }[][] = Array.from({ length: BANDS }, () => []);
for (let i = 0; i < 320; i++) {
	const arm = i % 2;
	const r = 0.22 + rand() ** 0.8 * 1.05;
	const angle = arm * Math.PI + 2.6 * Math.log(r / 0.22) + gauss() * 0.45;
	const band = Math.min(BANDS - 1, Math.floor(((r - 0.22) / 1.05) * BANDS));
	bands[band]!.push({
		size: rand() < 0.2 ? 2 : 1.2,
		tw: Math.floor(rand() * 3),
		d: `M${n(Math.cos(angle) * r * outer)} ${n(Math.sin(angle) * r * outer)}h0`
	});
}
bands.forEach((dots, b) => {
	const r = 0.22 + ((b + 0.5) / BANDS) * 1.05;
	const period = TAU / (0.24 * Math.sqrt(0.6 / r));
	galaxy.push(`<g class="band" style="animation-duration:${s(period)}">`);
	for (const size of [1.2, 2])
		for (let tw = 0; tw < 3; tw++) {
			const d = dots
				.filter((p) => p.size === size && p.tw === tw)
				.map((p) => p.d)
				.join('');
			if (d) galaxy.push(`<path class="dust d${tw}" d="${d}" stroke-width="${size}"/>`);
		}
	galaxy.push(`</g>`);
});
galaxy.push(`</g></g></g>`);

// ---------------------------------------------------------------- satellites

const items = [...sections, ...socials];
const innerItems = items.filter((i) => i.kind === 'section');
const outerItems = items.filter((i) => i.kind === 'social');
const fillPixels = particles.filter((p) => p.tone === 'fill');

const back: string[] = [];
const front: string[] = [];
const flights: string[] = [];
const dimmed: string[] = [];
const FLIGHT = 1.15;

items.forEach((item, i) => {
	const ring = item.kind === 'section' ? 0 : 1;
	const angle =
		ring === 0
			? -Math.PI / 2 + (innerItems.indexOf(item) / innerItems.length) * TAU
			: Math.PI / 4 + (outerItems.indexOf(item) / outerItems.length) * TAU;
	const speed = ring === 0 ? 0.3 : 0.19;
	const period = TAU / speed;
	// the orbits turn from the moment the page loads, unseen until the satellites arrive
	const theta = (t: number) => angle + speed * t;
	const r = radii[ring];

	const source = fillPixels.splice(Math.floor(rand() * fillPixels.length), 1)[0]!;
	const src = { x: source.tx, y: source.ty };
	const t0 = OPEN + i * 0.09;

	// the pixel that breaks off stays a little dimmer
	dimmed.push(
		`<rect class="dim" x="${source.tx - cell / 2}" y="${source.ty - cell / 2}" width="${cell}" height="${cell}" style="animation-delay:${s(t0)}"/>`
	);

	// the flight from the icon out to its moving spot on the orbit, bulging sideways
	const steps = 16;
	const flight = [];
	for (let k = 0; k <= steps; k++) {
		const p = k / steps;
		const dst = orbitPoint(r, theta(t0 + p * FLIGHT));
		const e = easeInOut(p);
		const bulge = Math.sin(e * Math.PI) * 0.22;
		const dx = dst.x - src.x;
		const dy = dst.y - src.y;
		flight.push({ x: lerp(src.x, dst.x, e) - dy * bulge, y: lerp(src.y, dst.y, e) + dx * bulge });
	}
	// one keyframe per step; the star and its trail all replay it, the trail a little later
	css.push(
		`@keyframes f${i}{${flight.map((p, k) => `${n((k / steps) * 100, 2)}%{transform:translate(${n(p.x, 0)}px,${n(p.y, 0)}px)}`).join('')}}`
	);
	const fly = (extra: string, delay: number) =>
		`animation:f${i} ${s(FLIGHT)} linear ${s(delay)} forwards,${extra} ${s(FLIGHT)} linear ${s(delay)} forwards`;
	flights.push(
		`<g class="fly" style="${fly('flight-star', t0)}"><use href="#star" transform="scale(1.4)"/><use href="#cross" transform="scale(1.1)"/></g>`
	);
	for (let k = 1; k <= 4; k++)
		flights.push(
			`<rect class="fly" x="-.75" y="-.75" width="1.5" height="1.5" style="--o:${n((1 - k / 5) * 0.4, 2)};${fly('trail', t0 + k * 0.04)}"/>`
		);

	// a little burst of sparks where the star turns into its icon
	const at = flight[Math.round(0.82 * steps)]!;
	const sparks = [];
	for (let k = 0; k < 12; k++) {
		const v = 40 + rand() * 110;
		const life = 0.4 + rand() * 0.5;
		const d = (v / 2.5) * (1 - Math.exp(-2.5 * life));
		sparks.push(
			`<rect class="k" x="-.75" y="-.75" width="1.5" height="1.5" style="--a:${n(rand() * 360, 0)};--d:${n(d, 0)};--l:${n(life, 2)}"/>`
		);
	}
	flights.push(
		`<g transform="translate(${n(at.x, 0)} ${n(at.y, 0)})" style="--T:${n(t0 + 0.82 * FLIGHT, 3)}">${sparks.join('')}</g>`
	);

	// then round and round in the orbit plane, nearer = bigger, brighter and in front
	const vars = `--a:${n(deg(angle), 2)};--r:${n(r, 1)};--P:${n(period, 3)};--o:${n((-positiveAngle(angle) / TAU) * period, 3)}`;
	const copy = (isFront: boolean) =>
		`<g class="o" style="${vars}"><g transform="${upright}"><g class="${isFront ? 'df' : 'db'}"><g class="v" style="animation-delay:${s(t0 + 0.8 * FLIGHT)}"><use href="#g-${item.glyph}" x="-20" y="-20" width="40" height="40" filter="url(#${isFront ? 'lift' : 'soft'})"/></g></g></g></g>`;
	back.push(copy(false));
	front.push(copy(true));
});

// ---------------------------------------------------------------- glints over the formed icon

const glints: string[] = [];
const sparkly = particles.filter((p) => p.tone !== 'outline');
for (let i = 0; i < 12; i++) {
	const p = sparkly[Math.floor(rand() * sparkly.length)]!;
	const period = 3 + rand() * 2.4;
	const size = 0.6 + rand() * 0.8;
	glints.push(
		`<g transform="translate(${p.tx} ${p.ty})"><g class="glint" style="--p:${s(period)};--d:${s(FORMED + rand() * period)}"><use href="#star" opacity=".8"/><use href="#cross" transform="scale(${n((size * 1.6 * cell) / 8, 2)})" opacity=".9"/></g></g>`
	);
}

// ---------------------------------------------------------------- text

const fontBody = read('src/lib/assets/fonts/bestten-crt.woff2').toString('base64');
const fontLabel = read('src/lib/assets/fonts/vcr-osd-mono.woff2').toString('base64');

// BestTen CRT advances, measured in the browser: 'j' is narrower, everything else is half an em
const NAME_SIZE = 64;
const advance = (ch: string) => (ch === 'j' ? 0.388 : 0.5) * NAME_SIZE + 0.04 * NAME_SIZE;
const nameWidth = [...site.name].reduce((w, ch) => w + advance(ch), 0) - 0.04 * NAME_SIZE;
let x = cx - nameWidth / 2;
const letters = [...site.name].map((ch, i) => {
	const at = x + (advance(ch) - 0.04 * NAME_SIZE) / 2;
	x += advance(ch);
	return `<text x="${n(at)}" class="letter" style="animation-delay:${s(FORMED + i * 0.07)}">${ch}</text>`;
});

const underIcon = iconY + iconH + 28;
const orbitHalf = Math.hypot(outer * Math.sin(tilt), outer * flatten * Math.cos(tilt));
const belowOrbit = cy + orbitHalf + 30;
const slide = Math.max(0, belowOrbit - underIcon);

// ---------------------------------------------------------------- assemble

const glyphDefs = Object.entries(glyphs as Record<string, readonly string[]>)
	.filter(([name]) => items.some((i) => i.glyph === name))
	.map(([name, rows]) => {
		const cells = (mark: string) =>
			rows.flatMap((row, y) => [...row].flatMap((c, x) => (c === mark ? [{ x, y }] : [])));
		const mid = runs(cells('+'));
		return `<symbol id="g-${name}" viewBox="0 0 ${rows.length} ${rows.length}" shape-rendering="crispEdges"><path fill="${FG}" d="${runs(cells('#'))}"/>${mid ? `<path fill="${MID}" d="${mid}"/>` : ''}</symbol>`;
	});

const iconPath = (tone: Tone) =>
	`<path fill="${TONE_COLOR[tone]}" d="${runs(icon.pixels.filter((p) => p.tone === tone))}"/>`;
const onIcon = `translate(${iconX} ${iconY}) scale(${cell})`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${site.name}</title>
<style>
@font-face{font-family:B;src:url(data:font/woff2;base64,${fontBody}) format("woff2")}
@font-face{font-family:V;src:url(data:font/woff2;base64,${fontLabel}) format("woff2")}
@keyframes show{from{opacity:0}to{opacity:1}}
@keyframes hide{to{visibility:hidden}}
.form{animation:show .6s both,hide 0s ${s(FORMED)} forwards}
.icon{opacity:0;animation:show 0s ${s(FORMED)} forwards}
.dim{opacity:0;animation:dim .14s forwards}
@keyframes dim{to{opacity:.3}}
.galaxy{opacity:0;animation:show 1s ${s(OPEN)} forwards}
.paths{transform:scale(0);animation:paths 1.6s cubic-bezier(.33,1,.68,1) ${s(OPEN)} forwards}
@keyframes paths{to{transform:scale(1)}}
.spiral{transform:scale(.15);animation:paths 1.6s cubic-bezier(.33,1,.68,1) ${s(OPEN)} forwards}
.band{animation:spin linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.fly{opacity:0}
@keyframes flight-star{0%,78%{opacity:1}98%,100%{opacity:0}}
@keyframes trail{0%,80%{opacity:var(--o)}100%{opacity:0}}
.p{animation:swirl calc(var(--u) * 1s) cubic-bezier(.65,0,.35,1) calc(var(--t) * 1s) both}
@keyframes swirl{from{transform:rotate(calc(var(--a) * 1deg)) translateX(calc(var(--r) * 1px)) rotate(calc(var(--b) * -1deg))}to{transform:rotate(calc(var(--b) * 1deg)) translateX(calc(var(--s) * 1px)) rotate(calc(var(--b) * -1deg))}}
.s{animation:land-star calc(var(--u) * .2s) linear calc(var(--t) * 1s + var(--u) * .8s) both}
@keyframes land-star{from{opacity:.8}50%{opacity:1}to{opacity:0}}
.q{animation:land-pixel calc(var(--u) * .2s) linear calc(var(--t) * 1s + var(--u) * .8s) both}
@keyframes land-pixel{from{transform:scale(0)}to{transform:scale(1)}}
.stars{fill:none;stroke:${FG};stroke-linecap:square}
.tw{animation:tw var(--p) ease-in-out var(--d) infinite alternate}
@keyframes tw{from{opacity:.1}to{opacity:1}}
.flare{animation:flare calc(var(--p) * 2) linear var(--d) infinite;transform:scale(0)}
@keyframes flare{0%,40%,60%,100%{transform:scale(0)}50%{transform:scale(1)}}
.dust{fill:none;stroke:${FG};stroke-linecap:square;vector-effect:non-scaling-stroke;animation:dust 2.6s ease-in-out infinite alternate}
.d1{animation-duration:1.7s;animation-delay:-.6s}.d2{animation-duration:3.4s;animation-delay:-1.9s}
@keyframes dust{from{opacity:.15}to{opacity:.6}}
.o{animation:orbit calc(var(--P) * 1s) linear infinite}
@keyframes orbit{from{transform:rotate(calc(var(--a) * 1deg)) translateX(calc(var(--r) * 1px)) rotate(calc(var(--a) * -1deg))}to{transform:rotate(calc(var(--a) * 1deg + 360deg)) translateX(calc(var(--r) * 1px)) rotate(calc(var(--a) * -1deg - 360deg))}}
.df{animation:depth calc(var(--P) * 1s) linear calc(var(--o) * 1s) infinite,front calc(var(--P) * 1s) step-end calc(var(--o) * 1s) infinite}
.db{animation:depth calc(var(--P) * 1s) linear calc(var(--o) * 1s) infinite,back calc(var(--P) * 1s) step-end calc(var(--o) * 1s) infinite}
@keyframes depth{0%,50%{transform:scale(.94);opacity:.75;animation-timing-function:cubic-bezier(.61,1,.88,1)}25%{transform:scale(1.1);opacity:1;animation-timing-function:cubic-bezier(.12,0,.39,0)}75%{transform:scale(.78);opacity:.5;animation-timing-function:cubic-bezier(.12,0,.39,0)}100%{transform:scale(.94);opacity:.75}}
@keyframes front{0%{visibility:visible}50%{visibility:hidden}}
@keyframes back{0%{visibility:hidden}50%{visibility:visible}}
.v{opacity:0;animation:show .23s linear forwards}
.k{opacity:0;animation:spark calc(var(--l) * 1s) cubic-bezier(.25,.8,.4,1) calc(var(--T) * 1s) forwards}
@keyframes spark{from{opacity:1;transform:rotate(calc(var(--a) * 1deg)) translateX(0)}to{opacity:0;transform:rotate(calc(var(--a) * 1deg)) translateX(calc(var(--d) * 1px))}}
.bob{animation:bob 3.49s ease-in-out ${s(FORMED - 1.745)} infinite alternate both}
@keyframes bob{from{transform:translateY(-3px)}to{transform:translateY(3px)}}
.halo{opacity:0;animation:halo-in .9s ${s(FORMED)} forwards,halo 4.8s ease-in-out ${s(FORMED + 0.9)} infinite alternate}
@keyframes halo-in{to{opacity:.55}}@keyframes halo{from{opacity:.55}to{opacity:.8}}
.glint{transform:scale(0);animation:glint var(--p) linear var(--d) infinite}
@keyframes glint{0%{transform:scale(0)}11%{transform:scale(1)}22%,100%{transform:scale(0)}}
.letter{opacity:0;animation:letter .4s steps(4) both}
@keyframes letter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
text{font-family:B,monospace;fill:${FG};text-anchor:middle}
.name{font-size:${NAME_SIZE}px;filter:url(#text-glow)}
.tagline{font-size:24px;fill:${MID};opacity:0;animation:fade .8s ${s(FORMED + 0.7)} forwards}
.hint{font-family:V,monospace;font-size:16px;letter-spacing:.1em;fill:${MID};opacity:0;animation:fade .8s ${s(FORMED + 1.3)} forwards,breathe 3s ease-in-out ${s(FORMED + 2.1)} infinite}
@keyframes fade{to{opacity:.85}}@keyframes breathe{0%,100%{opacity:.85}50%{opacity:.4}}
.title{animation:slide .9s cubic-bezier(.65,0,.35,1) ${s(OPEN)} both}
@keyframes slide{from{transform:none}to{transform:translateY(${n(slide)}px)}}
${css.join('\n')}
</style>
<defs>
<radialGradient id="glow"><stop offset="0" stop-color="${FG}"/><stop offset=".2" stop-color="${FG}" stop-opacity=".45"/><stop offset=".5" stop-color="${FG}" stop-opacity=".1"/><stop offset="1" stop-color="${FG}" stop-opacity="0"/></radialGradient>
<linearGradient id="tail"><stop offset="0" stop-color="${FG}" stop-opacity="0"/><stop offset="1" stop-color="${FG}" stop-opacity=".9"/></linearGradient>
<g id="star"><circle r="8" fill="url(#glow)" opacity=".7"/><rect x="-1" y="-1" width="2" height="2" fill="${FG}"/></g>
<g id="cross" fill="${FG}"><rect x="-8" y="-.5" width="16" height="1"/><rect x="-.5" y="-8" width="1" height="16"/><rect x="-2.4" y="-1" width="4.8" height="2" opacity=".6"/><rect x="-1" y="-2.4" width="2" height="4.8" opacity=".6"/></g>
${TONES.map((tone) => `<rect id="px-${tone}" x="-${cell / 2}" y="-${cell / 2}" width="${cell}" height="${cell}" fill="${TONE_COLOR[tone]}"/>`).join('')}
<filter id="halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${cell * 2.2}"/></filter>
<filter id="text-glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/><feComponentTransfer in="b" result="g"><feFuncA type="linear" slope=".45"/></feComponentTransfer><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feComponentTransfer result="g"><feFuncR type="linear" intercept=".95"/><feFuncG type="linear" intercept=".95"/><feFuncB type="linear" intercept=".95"/></feComponentTransfer><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="lift" x="-60%" y="-60%" width="220%" height="220%"><feMorphology in="SourceAlpha" operator="dilate" radius="2" result="d"/><feGaussianBlur in="d" stdDeviation="3" result="dark"/><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feComponentTransfer result="light"><feFuncR type="linear" intercept=".95"/><feFuncG type="linear" intercept=".95"/><feFuncB type="linear" intercept=".95"/></feComponentTransfer><feMerge><feMergeNode in="dark"/><feMergeNode in="dark"/><feMergeNode in="light"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
${glyphDefs.join('\n')}
</defs>
<rect width="${W}" height="${H}" fill="#000"/>
<g class="stars">${stars.join('')}</g>
<g fill="${FG}">${bigStars.join('')}</g>
<g>${meteors.join('')}</g>
${galaxy.join('')}
<g transform="${orbitPlane}">${back.join('')}</g>
<g class="bob">
<g class="halo" filter="url(#halo)"><g transform="${onIcon}">${iconPath('fill')}${iconPath('shade')}</g></g>
<g class="icon" shape-rendering="crispEdges"><g transform="${onIcon}">${TONES.map(iconPath).join('')}</g>${dimmed.join('')}</g>
${glints.join('')}
</g>
<g transform="translate(${cx} ${cy})"><g class="form" fill="${FG}">${formation.join('')}</g></g>
<g transform="${orbitPlane}">${front.join('')}</g>
<g fill="${FG}">${flights.join('')}</g>
<g class="title">
<g class="name" transform="translate(0 ${underIcon + NAME_SIZE * 0.78})">${letters.join('')}</g>
<text class="tagline" x="${cx}" y="${n(underIcon + NAME_SIZE + 30)}">${site.tagline}</text>
<text class="hint" x="${cx}" y="${n(underIcon + NAME_SIZE + 78)}">CLICK TO VISIT ${site.url.replace('https://', '').toUpperCase()}</text>
</g>
</svg>
`;

export default svg;
