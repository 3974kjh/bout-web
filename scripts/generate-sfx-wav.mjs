/**
 * Space-mech combat SFX — 16-bit mono PCM WAV (no deps).
 * Heavier, low-end weighted; re-run: node scripts/generate-sfx-wav.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'static', 'sfx');

const SR = 44100;

function softSat(x, drive = 1.65) {
	return Math.tanh(x * drive);
}

/** @param {Float32Array} samples */
function normalize(samples, peak = 0.9) {
	for (let i = 0; i < samples.length; i++) samples[i] = softSat(samples[i], 1.2);
	let m = 0;
	for (let i = 0; i < samples.length; i++) m = Math.max(m, Math.abs(samples[i]));
	if (m < 1e-8) return samples;
	const s = peak / m;
	for (let i = 0; i < samples.length; i++) samples[i] *= s;
	return samples;
}

/** @param {Float32Array} samples */
function writeWav(outPath, samples) {
	normalize(samples);
	const numChannels = 1;
	const bitsPerSample = 16;
	const blockAlign = (numChannels * bitsPerSample) / 8;
	const byteRate = SR * blockAlign;
	const dataSize = samples.length * 2;
	const buf = Buffer.alloc(44 + dataSize);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + dataSize, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(numChannels, 22);
	buf.writeUInt32LE(SR, 24);
	buf.writeUInt32LE(byteRate, 28);
	buf.writeUInt16LE(blockAlign, 32);
	buf.writeUInt16LE(bitsPerSample, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(dataSize, 40);
	let o = 44;
	for (let i = 0; i < samples.length; i++) {
		const x = Math.max(-1, Math.min(1, samples[i]));
		buf.writeInt16LE(x < 0 ? x * 0x8000 : x * 0x7fff, o);
		o += 2;
	}
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, buf);
}

function noiseSample() {
	return Math.random() * 2 - 1;
}

/** Brown-ish noise one sample (low-heavy) */
function brownStep(prev) {
	return prev * 0.985 + noiseSample() * 0.08;
}

/** @returns {Float32Array} */
function missileFire() {
	const n = Math.floor(SR * 0.15);
	const out = new Float32Array(n);
	let phaseLo = 0;
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		// Mag-rail / mass driver: deep descending sweep + body
		const fSweep = 420 * Math.exp(-t * 14) + 55;
		phaseLo += (2 * Math.PI * fSweep) / SR;
		const body = Math.sin(phaseLo) * 0.55;
		const h2 = Math.sin(phaseLo * 2.1) * 0.18 * Math.exp(-t * 11);
		// Short mechanical chunk at ignition
		const chunk =
			Math.sin(t * Math.PI * 2 * 95) * Math.exp(-t * 55) * 0.42 * Math.min(1, t * 300);
		// Muffled air / vacuum duct (filtered noise)
		const hiss = brown * 0.35 * Math.exp(-t * 7) * (1 - Math.exp(-t * 400));
		const railHum = Math.sin(t * Math.PI * 2 * 38) * 0.22 * Math.exp(-t * 4.5);
		const env = Math.min(1, t * 160) * Math.exp(-t * 5.2);
		out[i] = softSat((body + h2 + chunk + hiss + railHum) * env);
	}
	return out;
}

/** @returns {Float32Array} */
function enemyDamage() {
	const n = Math.floor(SR * 0.18);
	const out = new Float32Array(n);
	let r1 = 0;
	let r2 = 0;
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		r1 += (2 * Math.PI * 165) / SR;
		r2 += (2 * Math.PI * 247) / SR;
		const clang =
			Math.sin(r1) * Math.exp(-t * 16) * 0.5 +
			Math.sin(r2) * Math.exp(-t * 19) * 0.28 +
			Math.sin(r1 * 2.03) * Math.exp(-t * 24) * 0.14;
		const armor = brown * 0.38 * Math.exp(-t * 38) * Math.min(1, t * 220);
		const sub = Math.sin(t * Math.PI * 2 * 62) * Math.exp(-t * 12) * 0.45;
		const ring = Math.sin(t * Math.PI * 2 * 310) * Math.exp(-t * 28) * 0.12;
		out[i] = softSat((clang + armor + sub + ring) * Math.min(1, t * 500));
	}
	return out;
}

/** @returns {Float32Array} */
function playerDamage() {
	const n = Math.floor(SR * 0.24);
	const out = new Float32Array(n);
	let ph = 0;
	let ph2 = 0;
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		ph += (2 * Math.PI * 58) / SR;
		ph2 += (2 * Math.PI * 87) / SR;
		const hull =
			Math.sin(ph) * Math.exp(-t * 9) * 0.62 +
			Math.sin(ph2) * Math.exp(-t * 11) * 0.32 +
			Math.sin(ph * 3.1) * Math.exp(-t * 18) * 0.1;
		const stress = brown * 0.3 * Math.exp(-t * 22);
		const subHit = Math.sin(t * Math.PI * 2 * 42) * Math.exp(-t * 8) * 0.55;
		const shake = Math.sin(t * Math.PI * 2 * 11 + Math.sin(t * 37) * 0.4) * 0.12 * Math.exp(-t * 6);
		out[i] = softSat((hull + stress + subHit + shake) * Math.min(1, t * 95));
	}
	return out;
}

/** @returns {Float32Array} */
function playerDeath() {
	const n = Math.floor(SR * 0.72);
	const out = new Float32Array(n);
	let ph = 0;
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		const f = 195 * Math.exp(-t * 2.4) + 28;
		ph += (2 * Math.PI * f) / SR;
		const powerDown = Math.sin(ph) * Math.exp(-t * 1.85) * 0.48;
		const warn = Math.sin(t * Math.PI * 2 * (48 + Math.sin(t * 14) * 6)) * 0.16 * Math.exp(-t * 2.8);
		const rumble = Math.sin(t * Math.PI * 2 * 31) * 0.28 * Math.exp(-t * 2.2);
		const grind = brown * 0.22 * (1 - Math.exp(-t * 3)) * Math.exp(-t * 1.4);
		const finalThud = Math.sin(t * Math.PI * 2 * 52) * Math.exp(-(t - 0.38) * 22) * 0.35 * step(t, 0.32, 0.5);
		out[i] = softSat(powerDown + warn + rumble + grind + finalThud);
	}
	return out;
}

function step(t, a, b) {
	if (t < a) return 0;
	if (t > b) return 0;
	return 1;
}

/** @returns {Float32Array} */
function enemyDeath() {
	const n = Math.floor(SR * 0.42);
	const out = new Float32Array(n);
	let acc = 0;
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		acc += noiseSample() * 0.09;
		acc *= 0.96;
		const boom = Math.sin(t * Math.PI * 2 * 58) * Math.exp(-t * 7) * 0.62;
		const boom2 = Math.sin(t * Math.PI * 2 * 41) * Math.exp(-t * 5.5) * 0.38;
		const debris = brown * 0.45 * Math.exp(-t * 11) * Math.min(1, t * 90);
		const sizzle = acc * 0.2 * Math.exp(-t * 14);
		const ring = Math.sin(t * Math.PI * 2 * 180) * Math.exp(-t * 20) * 0.1;
		out[i] = softSat((boom + boom2 + debris + sizzle + ring) * Math.min(1, t * 70));
	}
	return out;
}

/** @returns {Float32Array} */
function buttonClick() {
	const n = Math.floor(SR * 0.09);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		const plate =
			Math.sin(t * Math.PI * 2 * 210) * Math.exp(-t * 85) * 0.5 +
			Math.sin(t * Math.PI * 2 * 125) * Math.exp(-t * 62) * 0.38;
		const thump = Math.sin(t * Math.PI * 2 * 72) * Math.exp(-t * 48) * 0.45 * Math.min(1, t * 400);
		const servo = Math.sin(t * Math.PI * 2 * 340) * Math.exp(-t * 95) * 0.08 * Math.min(1, t * 800);
		out[i] = softSat((plate + thump + servo) * Math.min(1, t * 600));
	}
	return out;
}

/** @returns {Float32Array} */
function modalOpen() {
	const n = Math.floor(SR * 0.32);
	const out = new Float32Array(n);
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		const f1 = 155;
		const f2 = 196;
		const e1 = Math.min(1, t * 55) * Math.exp(-t * 3.8);
		const e2 = Math.min(1, Math.max(0, (t - 0.04) * 48)) * Math.exp(-(t - 0.04) * 4.2);
		const tone =
			Math.sin(t * Math.PI * 2 * f1) * e1 * 0.34 +
			Math.sin(t * Math.PI * 2 * f2) * e2 * 0.3 +
			Math.sin(t * Math.PI * 2 * (f1 * 0.5)) * e1 * 0.22;
		const whoosh = brown * 0.28 * Math.min(1, t * 28) * Math.exp(-t * 3.2);
		const hyd = Math.sin(t * Math.PI * 2 * 88) * Math.exp(-t * 5) * 0.14 * Math.min(1, t * 20);
		out[i] = softSat(tone + whoosh + hyd);
	}
	return out;
}

/** Mech dash: 짧은 추진·바람 스윕 */
/** @returns {Float32Array} */
function playerDash() {
	const n = Math.floor(SR * 0.16);
	const out = new Float32Array(n);
	let ph = 0;
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		const f = 180 * Math.exp(-t * 9) + 520 * (1 - Math.exp(-t * 28));
		ph += (2 * Math.PI * f) / SR;
		const whoosh = Math.sin(ph) * 0.42 * Math.exp(-t * 6.5);
		const sub = Math.sin(t * Math.PI * 2 * 48) * Math.exp(-t * 5) * 0.38;
		const burst = brown * 0.32 * Math.exp(-t * 22) * Math.min(1, t * 200);
		const click = Math.sin(t * Math.PI * 2 * 240) * Math.exp(-t * 70) * 0.12 * Math.min(1, t * 500);
		const env = Math.min(1, t * 220) * Math.exp(-t * 4.2);
		out[i] = softSat((whoosh + sub + burst + click) * env);
	}
	return out;
}

/** 보스 임박 경고 배너용 알람 */
/** @returns {Float32Array} */
function uiBossWarning() {
	const n = Math.floor(SR * 0.55);
	const out = new Float32Array(n);
	let brown = 0;
	for (let i = 0; i < n; i++) {
		const t = i / SR;
		brown = brownStep(brown);
		const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 5.2);
		const fLow = 220;
		const fHigh = 380;
		const alt = Math.sin(t * Math.PI * 2 * 3.8) > 0 ? fLow : fHigh;
		const alarm =
			Math.sin(t * Math.PI * 2 * alt) * 0.34 * pulse +
			Math.sin(t * Math.PI * 2 * alt * 1.5) * 0.12 * pulse;
		const wobble = Math.sin(t * Math.PI * 2 * (alt + Math.sin(t * 28) * 8)) * 0.08;
		const air = brown * 0.14 * Math.exp(-t * 1.2);
		const env = Math.min(1, t * 35) * (0.55 + 0.45 * Math.exp(-t * 0.85));
		out[i] = softSat((alarm + wobble + air) * env);
	}
	return out;
}

const files = [
	[path.join(ROOT, 'player', 'missile_fire.wav'), missileFire],
	[path.join(ROOT, 'player', 'damage.wav'), playerDamage],
	[path.join(ROOT, 'player', 'death.wav'), playerDeath],
	[path.join(ROOT, 'player', 'dash.wav'), playerDash],
	[path.join(ROOT, 'enemy', 'damage.wav'), enemyDamage],
	[path.join(ROOT, 'enemy', 'death.wav'), enemyDeath],
	[path.join(ROOT, 'ui', 'button_click.wav'), buttonClick],
	[path.join(ROOT, 'ui', 'modal_open.wav'), modalOpen],
	[path.join(ROOT, 'ui', 'boss_warning.wav'), uiBossWarning]
];

for (const [p, fn] of files) {
	writeWav(p, fn());
	console.log('wrote', path.relative(path.join(__dirname, '..'), p));
}
