/* Fri höjd – Fabler & Fakta Studio
   Tre roller: Karta och Lista är flikar, Hyttläget slår på av sig självt när man kör. */
{
'use strict';

/* ---------- Inställningar ---------- */
const INST_KEY = 'frihojd.inst';
const DATA_KEY = 'frihojd.egenData';
const BK_KEY = 'frihojd.egenBk';
const STANDARD = { marg: 0.2, autoKor: true, rost: true, tema: 'auto', startad: false, visaBk: true, fordon: [], aktivt: null };
let inst = { ...STANDARD };
try { inst = { ...STANDARD, ...JSON.parse(localStorage.getItem(INST_KEY) || '{}') }; } catch (e) {}
function sparaInst() { try { localStorage.setItem(INST_KEY, JSON.stringify(inst)); } catch (e) {} }

/* ---------- Fordon (flera sparade profiler) ---------- */
function nyttFordon(over = {}) {
  return {
    id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    namn: 'Mitt fordon', reg: '', typ: 'dragbil-pv',
    hojd: 4.0, bredd: 2.55, langd: 16.5, vikt: 40, tjanst: '', axelavst: 12.5,
    grupper: [
      { typ: 'enkel', driv: false, tryck: 7.5 },
      { typ: 'enkel', driv: true, tryck: 11 },
      { typ: 'trippel', avst: 2.62, tryck: 21.5 }
    ],
    ...over
  };
}
if (!Array.isArray(inst.fordon) || !inst.fordon.length) {
  inst.fordon = [nyttFordon(inst.hojd ? { hojd: inst.hojd } : {})];
}
delete inst.hojd;
if (!inst.fordon.some((f) => f.id === inst.aktivt)) inst.aktivt = inst.fordon[0].id;
const F = () => inst.fordon.find((f) => f.id === inst.aktivt) || inst.fordon[0];
let bedomning = null;
function uppdateraBedomning() { bedomning = typeof Vikt !== 'undefined' ? Vikt.bedom(F()) : null; }
uppdateraBedomning();

const GBG = { lat: 57.7089, lon: 11.9746 };
const FRAMAT_M = 3000;      // hur långt fram körläget tittar
const KON_GRADER = 35;      // hur brett framåt (± grader)
const KOR_FART = 4.2;       // m/s ≈ 15 km/h
const $ = (id) => document.getElementById(id);

/* ---------- Hjälpfunktioner ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtM = (h, d = 2) => Number(h).toFixed(d).replace('.', ',');
function fmtAvst(m) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}
const rad = (d) => d * Math.PI / 180;
const grad = (r) => r * 180 / Math.PI;
function avstand(a, b) {
  const R = 6371000, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function riktning(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (grad(Math.atan2(y, x)) + 360) % 360;
}
const vinkelSkillnad = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

function status(h) {
  const fh = F().hojd;
  if (h <= fh) return 'rod';
  if (h < fh + inst.marg) return 'gul';
  return 'gron';
}
const STATUS_TEXT = { rod: 'För lågt', gul: 'Nära gränsen', gron: 'OK' };

/* SWEREF 99 TM (EPSG:3006) → WGS84, Lantmäteriets formler för Gauss-Krüger */
function sweref99tmTillWgs84(northing, easting) {
  const a = 6378137, f = 1 / 298.257222101, lon0 = rad(15), k0 = 0.9996, FE = 500000;
  const e2 = f * (2 - f), n = f / (2 - f);
  const aR = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
  const d1 = n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96 - n ** 4 / 360;
  const d2 = n * n / 48 + n ** 3 / 15 - 437 * n ** 4 / 1440;
  const d3 = 17 * n ** 3 / 480 - 37 * n ** 4 / 840;
  const d4 = 4397 * n ** 4 / 161280;
  const As = e2 + e2 ** 2 + e2 ** 3 + e2 ** 4;
  const Bs = -(7 * e2 ** 2 + 17 * e2 ** 3 + 30 * e2 ** 4) / 6;
  const Cs = (224 * e2 ** 3 + 889 * e2 ** 4) / 120;
  const Ds = -(4279 * e2 ** 4) / 1260;
  const xi = northing / (k0 * aR), eta = (easting - FE) / (k0 * aR);
  const xp = xi - d1 * Math.sin(2 * xi) * Math.cosh(2 * eta) - d2 * Math.sin(4 * xi) * Math.cosh(4 * eta)
    - d3 * Math.sin(6 * xi) * Math.cosh(6 * eta) - d4 * Math.sin(8 * xi) * Math.cosh(8 * eta);
  const ep = eta - d1 * Math.cos(2 * xi) * Math.sinh(2 * eta) - d2 * Math.cos(4 * xi) * Math.sinh(4 * eta)
    - d3 * Math.cos(6 * xi) * Math.sinh(6 * eta) - d4 * Math.cos(8 * xi) * Math.sinh(8 * eta);
  const phi = Math.asin(Math.sin(xp) / Math.cosh(ep));
  const lon = lon0 + Math.atan(Math.sinh(ep) / Math.cos(xp));
  const s = Math.sin(phi) ** 2;
  const lat = phi + Math.sin(phi) * Math.cos(phi) * (As + Bs * s + Cs * s * s + Ds * s * s * s);
  return { lat: grad(lat), lon: grad(lon) };
}

/* Soluppgång/solnedgång (NOAA, förenklad) – för automatiskt mörkt läge */
function arMorkt(plats, nu = new Date()) {
  const start = Date.UTC(nu.getUTCFullYear(), 0, 1);
  const N = Math.floor((nu - start) / 86400000) + 1;
  const g = 2 * Math.PI / 365 * (N - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dek = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const lat = rad(plats.lat);
  const arg = Math.cos(rad(90.833)) / (Math.cos(lat) * Math.cos(dek)) - Math.tan(lat) * Math.tan(dek);
  if (arg > 1) return true;    // polarnatt
  if (arg < -1) return false;  // midnattssol
  const ha = grad(Math.acos(arg));
  const upp = 720 - 4 * (plats.lon + ha) - eq;   // minuter efter midnatt UTC
  const ned = 720 - 4 * (plats.lon - ha) - eq;
  const min = nu.getUTCHours() * 60 + nu.getUTCMinutes();
  return min < upp || min > ned;
}

/* ---------- Data ---------- */
let data = { hinder: [], exempel: false, kalla: '', uppdaterad: '' };
let bkData = { segment: [], exempel: false, kalla: '', uppdaterad: '' };
let bkRutnat = new Map();
const RUTA = 0.02; // grader, för snabb sökning av närmaste vägsträcka

function talEllerNull(v) {
  if (v == null || v === '') return null;
  const t = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(t) ? t : null;
}
function hittaFalt(props, monster, inte) {
  for (const k of Object.keys(props)) if (monster.test(k) && !(inte && inte.test(k))) return props[k];
  return undefined;
}
function bkVarde(v) {
  const m = String(v ?? '').match(/[1-4]/);
  return m ? +m[0] : null;
}
function wgs(c) {
  let lat = +c[1], lon = +c[0];
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) ({ lat, lon } = sweref99tmTillWgs84(+c[1], +c[0]));
  return [lat, lon];
}
/* Tolkar en datafil: appens egna format eller GeoJSON. Returnerar { sort: 'hinder' | 'bk', ... } */
function tolkaData(json) {
  const bas = { exempel: !!json.exempel, kalla: json.kalla || json['källa'] || '', uppdaterad: json.uppdaterad || '' };
  if (Array.isArray(json.hinder)) {
    const ut = { sort: 'hinder', hinder: [], ...bas };
    json.hinder.forEach((h, i) => {
      const fri = talEllerNull(h.h);
      if (fri == null || !Number.isFinite(+h.lat) || !Number.isFinite(+h.lon)) return;
      ut.hinder.push({ id: String(h.id ?? i), lat: +h.lat, lon: +h.lon, h: fri, namn: h.namn || 'Höjdhinder', vag: h.vag || '' });
    });
    return ut;
  }
  if (Array.isArray(json.segment)) {
    const ut = { sort: 'bk', segment: [], ...bas };
    json.segment.forEach((sg, i) => {
      const bk = bkVarde(sg[0]); const f = sg[1];
      if (!bk || !Array.isArray(f) || f.length < 4) return;
      const pts = [];
      for (let j = 0; j + 1 < f.length; j += 2) pts.push([+f[j], +f[j + 1]]);
      ut.segment.push({ id: 's' + i, bk, pts });
    });
    return ut;
  }
  if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
    const arLinjer = json.features.some((f) => f.geometry && /LineString/.test(f.geometry.type)
      && hittaFalt(f.properties || {}, /b[aä]righet|^bk$/i, /tj[aä]l/i) != null);
    if (arLinjer) {
      const ut = { sort: 'bk', segment: [], ...bas, kalla: bas.kalla || 'Egen GeoJSON-fil' };
      json.features.forEach((f, i) => {
        const bk = bkVarde(hittaFalt(f.properties || {}, /b[aä]righet|^bk$/i, /tj[aä]l/i));
        if (!bk || !f.geometry) return;
        const linjer = f.geometry.type === 'LineString' ? [f.geometry.coordinates]
          : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
        linjer.forEach((l, j) => { if (l.length > 1) ut.segment.push({ id: `g${i}_${j}`, bk, pts: l.map(wgs) }); });
      });
      return ut;
    }
    const ut = { sort: 'hinder', hinder: [], ...bas, kalla: bas.kalla || 'Egen GeoJSON-fil' };
    json.features.forEach((f, i) => {
      const g = f.geometry; const p = f.properties || {};
      if (!g) return;
      const c = g.type === 'Point' ? g.coordinates
        : g.type === 'LineString' ? g.coordinates[Math.floor(g.coordinates.length / 2)]
        : g.type === 'MultiPoint' ? g.coordinates[0]
        : g.type === 'MultiLineString' ? g.coordinates[0][0] : null;
      if (!c) return;
      const [lat, lon] = wgs(c);
      const fri = talEllerNull(hittaFalt(p, /fri.?h|h[oö]jd|height/i));
      if (fri == null || fri <= 0 || fri > 20) return;
      const namn = hittaFalt(p, /^(namn|name|beskrivning|typ)/i);
      const vag = hittaFalt(p, /v[aä]g.?n|vagnummer|road|^v[aä]g$/i);
      ut.hinder.push({ id: String(f.id ?? p.id ?? i), lat, lon, h: fri, namn: namn ? String(namn) : 'Höjdhinder', vag: vag != null ? String(vag) : '' });
    });
    return ut;
  }
  return { sort: 'okand' };
}
function byggRutnat() {
  bkRutnat = new Map();
  for (const sg of bkData.segment) {
    let a = 90, b = 180, c = -90, d = -180;
    for (const [la, lo] of sg.pts) { if (la < a) a = la; if (lo < b) b = lo; if (la > c) c = la; if (lo > d) d = lo; }
    sg.bb = [a, b, c, d];
    for (let i = Math.floor(a / RUTA); i <= Math.floor(c / RUTA); i++)
      for (let j = Math.floor(b / RUTA); j <= Math.floor(d / RUTA); j++) {
        const k = i + ',' + j;
        if (!bkRutnat.has(k)) bkRutnat.set(k, []);
        bkRutnat.get(k).push(sg);
      }
  }
}
/* Avstånd i meter från en punkt till en vägsträcka (platt approximation, räcker på korta avstånd) */
function avstTillSegment(p, sg) {
  const kx = 111320 * Math.cos(rad(p.lat)), ky = 110540;
  let bast = Infinity;
  for (let i = 0; i + 1 < sg.pts.length; i++) {
    const ax = (sg.pts[i][1] - p.lon) * kx, ay = (sg.pts[i][0] - p.lat) * ky;
    const bx = (sg.pts[i + 1][1] - p.lon) * kx, by = (sg.pts[i + 1][0] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const x = ax + t * dx, y = ay + t * dy;
    bast = Math.min(bast, Math.hypot(x, y));
  }
  return bast;
}
function narmasteSegment(p, maxM) {
  const lista = bkRutnat.get(Math.floor(p.lat / RUTA) + ',' + Math.floor(p.lon / RUTA)) || [];
  let bast = null, bastD = maxM;
  for (const sg of lista) { const d = avstTillSegment(p, sg); if (d < bastD) { bast = sg; bastD = d; } }
  return bast;
}
async function hamta(url) { const svar = await fetch(url, { cache: 'no-cache' }); if (!svar.ok) throw new Error(svar.status); return svar.json(); }
async function laddaData() {
  let egen = null;
  try { egen = localStorage.getItem(DATA_KEY); } catch (e) {}
  data = { hinder: [], exempel: false, kalla: 'Kunde inte läsa appens data', uppdaterad: '' };
  try { if (egen) { const d = tolkaData(JSON.parse(egen)); if (d.sort === 'hinder' && d.hinder.length) data = d; } } catch (e) {}
  if (!data.hinder.length) { try { const d = tolkaData(await hamta('data/hinder.json')); if (d.sort === 'hinder') data = d; } catch (e) {} }
}
async function laddaBk() {
  let egen = null;
  try { egen = localStorage.getItem(BK_KEY); } catch (e) {}
  bkData = { segment: [], exempel: false, kalla: '', uppdaterad: '' };
  try { if (egen) { const d = tolkaData(JSON.parse(egen)); if (d.sort === 'bk' && d.segment.length) bkData = d; } } catch (e) {}
  if (!bkData.segment.length) { try { const d = tolkaData(await hamta('data/bk.json')); if (d.sort === 'bk') bkData = d; } catch (e) {} }
  byggRutnat();
}

/* ---------- Läge ---------- */
let pos = null, senastRiktPos = null, riktningGrad = null;
let snabbaFixar = 0, stillaSedan = 0;
let hyttAktiv = false, hyttAuto = false, stangdManuellt = false;
const ignorerade = new Set();
const sagda = new Map();
let wakeLock = null;

/* ---------- Tema ---------- */
let morkt = false;
function uppdateraTema() {
  const plats = pos || GBG;
  const nytt = inst.tema === 'morkt' || (inst.tema === 'auto' && arMorkt(plats));
  if (nytt === morkt && document.documentElement.dataset.tema) return;
  morkt = nytt;
  document.documentElement.dataset.tema = morkt ? 'morkt' : 'ljust';
  document.querySelector('meta[name=theme-color]').content = morkt ? '#0F1318' : '#FFD43B';
  if (karta) bytKartlager();
}

/* ---------- Karta ---------- */
let bkLager = null;
let karta = null, kartlager = null, punktLager = null, etikettLager = null, migMarkor = null, forstaFix = true;
const renderer = window.L ? L.canvas({ padding: 0.3 }) : null;
const FARG = { rod: '#D0021B', gul: '#F2B705', gron: '#1E9E5A' };

function bytKartlager() {
  if (kartlager) karta.removeLayer(kartlager);
  const stil = morkt ? 'dark_all' : 'light_all';
  kartlager = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${stil}/{z}/{x}/{y}{r}.png`, {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a> · Vägdata © Trafikverket'
  }).addTo(karta);
}
function popupHtml(h) {
  const s = status(h.h);
  const marg = h.h - F().hojd;
  const avst = pos ? ` · ${fmtAvst(avstand(pos, h))} bort` : '';
  return `<b>Fri höjd ${esc(fmtM(h.h))} m</b><br>${esc(h.namn)}${h.vag ? ' · väg ' + esc(h.vag) : ''}${esc(avst)}<br>` +
    `<span class="status s-${s}">${STATUS_TEXT[s]}</span> ${marg <= 0 ? esc(fmtM(-marg)) + ' m för lågt' : 'marginal ' + esc(fmtM(marg)) + ' m'}`;
}
function ritaPunkter() {
  if (!karta) return;
  punktLager.clearLayers();
  data.hinder.forEach((h) => {
    const s = status(h.h);
    L.circleMarker([h.lat, h.lon], { renderer, radius: s === 'gron' ? 6 : 8, color: '#fff', weight: 2, fillColor: FARG[s], fillOpacity: 1 })
      .bindPopup(() => popupHtml(h)).addTo(punktLager);
  });
  ritaEtiketter();
}
function ritaEtiketter() {
  if (!karta) return;
  etikettLager.clearLayers();
  if (karta.getZoom() < 12) return;
  const b = karta.getBounds().pad(0.1);
  let n = 0;
  for (const h of data.hinder) {
    if (!b.contains([h.lat, h.lon])) continue;
    if (++n > 250) break;
    const s = status(h.h);
    L.marker([h.lat, h.lon], {
      icon: L.divIcon({ className: '', html: `<div class="mark m-${s}">${esc(fmtM(h.h, 1))}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
      keyboard: true, title: `Fri höjd ${fmtM(h.h)} m`
    }).bindPopup(() => popupHtml(h)).addTo(etikettLager);
  }
}
function startaKarta() {
  if (!window.L) { $('karta').innerHTML = '<p class="tom">Kartan kunde inte laddas. Kontrollera nätet.</p>'; return; }
  karta = L.map('karta', { zoomControl: false, preferCanvas: true }).setView([GBG.lat, GBG.lon], 9);
  L.control.zoom({ position: 'topright' }).addTo(karta);
  bytKartlager();
  bkLager = L.layerGroup().addTo(karta);
  punktLager = L.layerGroup().addTo(karta);
  etikettLager = L.layerGroup().addTo(karta);
  karta.on('moveend', () => { ritaEtiketter(); ritaBk(); if (vy === 'lista') ritaLista(); });
  ritaPunkter();
}

/* ---------- Bärighet på kartan ---------- */
const BK_NAMN = (bk) => 'BK' + bk;
function bkSammanfattning() {
  if (!bedomning) return '';
  const ok = [4, 1, 2, 3].filter((k) => bedomning[k].ok);
  return ok.length ? ok.map(BK_NAMN).join(', ') : 'ingen klass';
}
function ritaBk() {
  if (!karta || !bkLager) return;
  bkLager.clearLayers();
  const knapp = $('btnBk'), leg = $('bkLegend');
  knapp.setAttribute('aria-pressed', inst.visaBk ? 'true' : 'false');
  if (!inst.visaBk) { leg.innerHTML = ''; return; }
  if (!bkData.segment.length) { leg.textContent = 'Ingen bärighetsdata laddad.'; return; }
  const b = bedomning;
  const kraverBk4 = b && !b[1].ok && b[4].ok;
  const ingen = b && !b[4].ok && !b[1].ok;
  let text;
  if (ingen) text = '<i style="background:#D0021B"></i>För tungt för alla klasser – kontrollera vikterna.';
  else if (kraverBk4) text = '<i style="background:#1E9E5A"></i>Ditt ekipage kräver BK4 – bara gröna vägar.';
  else if (b && b[3].ok) text = 'Ditt ekipage får köra på alla bärighetsklasser.';
  else text = `<i style="background:#D0021B"></i>För låg bärighet för ${esc(F().namn)}`;
  if (karta.getZoom() < 9) { leg.innerHTML = text + '<br>Zooma in för att se vägarna.'; return; }
  leg.innerHTML = text + (bkData.exempel ? '<br><b>Exempeldata</b>' : '');
  const v = karta.getBounds().pad(0.1);
  const [s0, w0, n0, e0] = [v.getSouth(), v.getWest(), v.getNorth(), v.getEast()];
  let n = 0;
  for (const sg of bkData.segment) {
    const [a, bb, c, d] = sg.bb;
    if (c < s0 || a > n0 || d < w0 || bb > e0) continue;
    let farg = null;
    if (b && !b[sg.bk].ok) farg = '#D0021B';
    else if (kraverBk4 && sg.bk === 4) farg = '#1E9E5A';
    if (!farg) continue;
    if (++n > 5000) break;
    L.polyline(sg.pts, { renderer, color: farg, weight: 5, opacity: 0.8 })
      .bindPopup(`<b>${BK_NAMN(sg.bk)}</b><br>${b && !b[sg.bk].ok ? esc(b[sg.bk].skal.join(' · ')) : 'Ditt ekipage får köra här.'}`)
      .addTo(bkLager);
  }
}

/* ---------- Lista ---------- */
let filter = 'alla';
function ritaLista() {
  const bas = pos || (karta ? { lat: karta.getCenter().lat, lon: karta.getCenter().lng } : GBG);
  let rader = data.hinder.map((h) => ({ h, d: avstand(bas, h), s: status(h.h) }))
    .filter((r) => r.d < 50000 && (filter === 'alla' || r.s !== 'gron'))
    .sort((a, b) => a.d - b.d).slice(0, 60);
  $('listInfo').textContent = pos
    ? `Närmast din position, inom 5 mil. ${F().namn}: ${fmtM(F().hojd)} m.`
    : 'Platstjänster är avstängda – listan utgår från kartans mittpunkt.';
  if (!rader.length) {
    $('lista').innerHTML = `<li class="tom">${filter === 'alla' ? 'Inga höjdhinder inom 5 mil.' : 'Inga hinder som är för låga för ditt fordon inom 5 mil.'}</li>`;
    return;
  }
  $('lista').innerHTML = rader.map((r, i) => `
    <li><button class="rad" data-i="${i}">
      <span class="skylt" aria-hidden="true">${esc(fmtM(r.h.h, 1))}</span>
      <span class="info"><span class="namn">${esc(r.h.namn)}</span><br>
        <span class="sub">${esc(fmtAvst(r.d))}${r.h.vag ? ' · väg ' + esc(r.h.vag) : ''} · <span style="white-space:nowrap">fri höjd ${esc(fmtM(r.h.h))} m</span></span></span>
      <span class="status s-${r.s}">${STATUS_TEXT[r.s]}</span>
    </button></li>`).join('');
  $('lista').querySelectorAll('button.rad').forEach((b) => b.addEventListener('click', () => {
    const h = rader[+b.dataset.i].h;
    visaVy('karta');
    if (karta) { karta.setView([h.lat, h.lon], 15); L.popup().setLatLng([h.lat, h.lon]).setContent(popupHtml(h)).openOn(karta); }
  }));
}

/* ---------- Vyer ---------- */
let vy = 'karta';
function visaVy(ny) {
  if (ny === 'install') { oppnaInst(); return; }
  vy = ny;
  $('vyKarta').hidden = ny !== 'karta';
  $('vyLista').hidden = ny !== 'lista';
  document.querySelectorAll('.flik').forEach((f) => f.classList.toggle('aktiv', f.dataset.vy === ny));
  if (ny === 'karta' && karta) setTimeout(() => karta.invalidateSize(), 0);
  if (ny === 'lista') ritaLista();
}

/* ---------- Hyttläge ---------- */
async function oppnaHytt(auto) {
  hyttAktiv = true; hyttAuto = auto;
  $('hytt').hidden = false;
  document.querySelector('meta[name=theme-color]').content = '#0B0E13';
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  ritaHytt();
}
function stangHytt(manuellt) {
  hyttAktiv = false;
  if (manuellt && hyttAuto) stangdManuellt = true;
  $('hytt').hidden = true;
  uppdateraTema();
  document.querySelector('meta[name=theme-color]').content = morkt ? '#0F1318' : '#FFD43B';
  try { if (wakeLock) wakeLock.release(); } catch (e) {}
  wakeLock = null;
}
function framfor() {
  if (!pos) return [];
  return data.hinder
    .filter((h) => !ignorerade.has(h.id))
    .map((h) => ({ h, d: avstand(pos, h), s: status(h.h) }))
    .filter((r) => r.d < FRAMAT_M && (riktningGrad == null ? r.d < 1500 : vinkelSkillnad(riktning(pos, r.h), riktningGrad) <= KON_GRADER))
    .sort((a, b) => a.d - b.d);
}
let primar = null;
function ritaHytt() {
  if (!hyttAktiv) return;
  $('hyttDinHojd').textContent = `DIN HÖJD ${fmtM(F().hojd)} M`;
  ritaHyttBk();
  const lista = framfor();
  primar = lista.find((r) => r.s !== 'gron') || null;
  const visad = primar || lista[0] || null;
  if (visad) {
    $('hyttAvstand').innerHTML = esc(fmtAvst(visad.d)).replace(/ (m|km)$/, ' <small>$1</small>');
    $('hyttMatare').style.width = `${Math.max(4, (1 - visad.d / FRAMAT_M) * 100)}%`;
    const marg = visad.h.h - F().hojd;
    $('hyttFri').textContent = fmtM(visad.h.h);
    $('hyttMarg').textContent = (marg <= 0 ? '−' : '+') + fmtM(Math.abs(marg));
    $('hyttFri').className = $('hyttMarg').className = 'stor c-' + visad.s;
    $('hyttNamn').textContent = `${visad.h.namn}${visad.h.vag ? ' · väg ' + visad.h.vag : ''}`;
  } else {
    $('hyttAvstand').textContent = '–';
    $('hyttMatare').style.width = '0';
    $('hyttFri').textContent = $('hyttMarg').textContent = '–';
    $('hyttFri').className = $('hyttMarg').className = 'stor';
    $('hyttNamn').textContent = pos ? 'Inga höjdhinder framför dig.' : 'Väntar på GPS …';
  }
  $('hyttVarning').hidden = !primar;
  $('hyttLugn').hidden = !!primar || !pos;
  $('btnIgnorera').hidden = !primar;
  if (primar) {
    const rod = primar.s === 'rod';
    $('hyttVarning').classList.toggle('gul', !rod);
    $('hyttVarnText').textContent = rod
      ? `Du får inte plats – ${fmtM(F().hojd - primar.h.h)} m för lågt. Välj en annan väg.`
      : `Nära gränsen – bara ${fmtM(primar.h.h - F().hojd)} m marginal. Kör försiktigt.`;
    varnaMedRost(primar);
  }
  const efter = lista.filter((r) => r !== visad).slice(0, 2);
  $('hyttDarefter').innerHTML = efter.length
    ? efter.map((r) => `<div class="ruta"><div class="stor c-${r.s}">${esc(fmtM(r.h.h))}</div><div class="sub">${esc(fmtAvst(r.d))}${r.h.vag ? ' · väg ' + esc(r.h.vag) : ''}</div></div>`).join('')
    : '<div class="ruta"><div class="sub">Inget mer inom 3 km.</div></div>';
  $('hyttGps').textContent = !pos ? 'Ingen GPS-position ännu.'
    : riktningGrad == null ? 'Färdriktningen är okänd – visar hinder runt omkring dig.'
    : `GPS-noggrannhet ±${Math.round(pos.acc)} m. Hinder visas i färdriktningen, oavsett vilken väg de ligger på.`;
}
const bkSagda = new Set();
function ritaHyttBk() {
  const ruta = document.querySelector('.hytt-bk');
  ruta.classList.remove('varn');
  if (!bkData.segment.length) { $('hyttBk').textContent = '–'; $('hyttBkText').textContent = 'Ingen bärighetsdata laddad.'; return; }
  if (!pos) { $('hyttBk').textContent = '–'; $('hyttBkText').textContent = 'Väntar på GPS …'; return; }
  const sg = narmasteSegment(pos, 30);
  const b = bedomning;
  if (!sg) {
    $('hyttBk').textContent = 'BK1?';
    $('hyttBkText').textContent = b && !b[1].ok
      ? 'Ingen uppgift för vägen här. Ditt ekipage kräver BK4 – kontrollera skyltningen.'
      : 'Ingen särskild klass – allmän väg är normalt BK1.';
    return;
  }
  $('hyttBk').textContent = BK_NAMN(sg.bk);
  if (b && !b[sg.bk].ok) {
    ruta.classList.add('varn');
    $('hyttBkText').textContent = `${F().namn} är för tungt här: ${b[sg.bk].skal[0]}.`;
    if (!bkSagda.has(sg.id)) {
      bkSagda.add(sg.id);
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      if (inst.rost && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(`Varning. Du kör på en väg med bärighetsklass ${sg.bk}. Ekipaget är för tungt.`);
        u.lang = 'sv-SE'; speechSynthesis.speak(u);
      }
    }
  } else $('hyttBkText').textContent = 'Ditt ekipage får köra här.';
}
function varnaMedRost(r) {
  const niva = r.d < 300 ? 2 : r.d < 1000 ? 1 : 0;
  if (!niva || (sagda.get(r.h.id) || 0) >= niva) return;
  sagda.set(r.h.id, niva);
  if (r.s === 'rod' && navigator.vibrate) navigator.vibrate([300, 150, 300]);
  if (!inst.rost || !('speechSynthesis' in window)) return;
  const avst = niva === 2 ? 'strax framför dig' : `om ${fmtAvst(r.d).replace('km', 'kilometer').replace(' m', ' meter')}`;
  const text = r.s === 'rod'
    ? `Varning. Lågt hinder ${avst}. Fri höjd ${fmtM(r.h.h)} meter. Du får inte plats.`
    : `Höjdhinder ${avst}. Fri höjd ${fmtM(r.h.h)} meter. Liten marginal.`;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'sv-SE';
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

/* ---------- GPS ---------- */
function nyPosition(p) {
  const c = p.coords;
  pos = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, speed: c.speed, t: p.timestamp };
  if (c.heading != null && !Number.isNaN(c.heading) && (c.speed || 0) > 2) riktningGrad = c.heading;
  else if (senastRiktPos && avstand(senastRiktPos, pos) > 25) riktningGrad = riktning(senastRiktPos, pos);
  if (!senastRiktPos || avstand(senastRiktPos, pos) > 25) senastRiktPos = pos;

  if (karta) {
    if (!migMarkor) migMarkor = L.marker([pos.lat, pos.lon], { icon: L.divIcon({ className: '', html: '<div class="mig"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, zIndexOffset: 1000 }).addTo(karta);
    else migMarkor.setLatLng([pos.lat, pos.lon]);
    if (forstaFix) { karta.setView([pos.lat, pos.lon], 13); forstaFix = false; }
  }
  // automatiskt körläge
  const fart = c.speed ?? 0;
  if (fart >= KOR_FART) { snabbaFixar++; stillaSedan = 0; } else snabbaFixar = 0;
  if (fart < 1) { stillaSedan = stillaSedan || Date.now(); } else if (fart >= KOR_FART) stillaSedan = 0;
  if (inst.autoKor && snabbaFixar >= 2 && !hyttAktiv && !stangdManuellt) oppnaHytt(true);
  if (stillaSedan && Date.now() - stillaSedan > 60000) {
    stangdManuellt = false;
    if (hyttAktiv && hyttAuto) stangHytt(false);
  }
  ritaHytt();
  if (vy === 'lista' && !hyttAktiv) ritaListaStrypt();
}
let listTimer = 0;
function ritaListaStrypt() { if (listTimer) return; listTimer = setTimeout(() => { listTimer = 0; ritaLista(); }, 3000); }
function startaGps() {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.watchPosition(nyPosition, () => { ritaHytt(); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}

/* ---------- Inställningar och fordon ---------- */
const TYPNAMN = { lastbil: 'Lastbil', 'lastbil-slap': 'Lastbil med släp', 'dragbil-pv': 'Dragbil + påhängsvagn', 'dragbil-dolly': 'Dragbil + dolly + påhängsvagn', buss: 'Buss', annat: 'Annat' };
const fmtT = (x) => (x === '' || x == null || !Number.isFinite(+x)) ? '–' : String(Math.round(+x * 100) / 100).replace('.', ',');
function visaHojd() {
  const f = F();
  $('pillHojd').textContent = `${fmtM(f.hojd)} m · ${fmtT(f.vikt)} t`;
  $('btnFordon').setAttribute('aria-label', `Fordon: ${f.namn}, ${fmtM(f.hojd)} meter, ${fmtT(f.vikt)} ton. Ändra.`);
}
function dataText() {
  const n = data.hinder.length;
  return `${n.toLocaleString('sv-SE')} höjdhinder${data.kalla ? ' · ' + data.kalla : ''}${data.uppdaterad ? ' · uppdaterad ' + data.uppdaterad : ''}${data.exempel ? ' · EXEMPELDATA' : ''}`;
}
function bkDataText() {
  const n = bkData.segment.length;
  return n ? `${n.toLocaleString('sv-SE')} vägsträckor med bärighetsklass${bkData.kalla ? ' · ' + bkData.kalla : ''}${bkData.uppdaterad ? ' · uppdaterad ' + bkData.uppdaterad : ''}${bkData.exempel ? ' · EXEMPELDATA' : ''}`
    : 'Ingen bärighetsdata laddad.';
}

/* Fordonsväljare */
function fyllFordonsval() {
  $('valFordon').innerHTML = inst.fordon.map((f) =>
    `<option value="${esc(f.id)}"${f.id === inst.aktivt ? ' selected' : ''}>${esc(f.namn || 'Namnlöst')}${f.reg ? ' (' + esc(f.reg) + ')' : ''} · ${esc(fmtM(f.hojd))} m · ${esc(fmtT(f.vikt))} t</option>`).join('');
  $('btnTaBort').disabled = inst.fordon.length < 2;
}
const FALT = [
  ['fNamn', 'namn', 'text'], ['fReg', 'reg', 'text'], ['fTyp', 'typ', 'text'],
  ['fHojd', 'hojd', 'hojd'], ['fBredd', 'bredd', 'tal'], ['fLangd', 'langd', 'tal'],
  ['fVikt', 'vikt', 'tal'], ['fTjanst', 'tjanst', 'tal'], ['fAxelavst', 'axelavst', 'tal']
];
function visaFordon() {
  const f = F();
  for (const [id, nyckel, sort] of FALT) {
    const v = f[nyckel];
    $(id).value = v == null ? '' : sort === 'hojd' ? Number(v).toFixed(2) : v;
  }
  ritaGrupper();
  ritaBkResultat();
}
function ritaGrupper() {
  const f = F();
  $('grupper').innerHTML = f.grupper.map((g, i) => `
    <div class="grupp" data-i="${i}">
      <div class="full">
        <select data-falt="typ" aria-label="Typ, nummer ${i + 1}">
          <option value="enkel"${g.typ === 'enkel' ? ' selected' : ''}>${i + 1}. Enkelaxel</option>
          <option value="boggi"${g.typ === 'boggi' ? ' selected' : ''}>${i + 1}. Boggi (2 axlar)</option>
          <option value="trippel"${g.typ === 'trippel' ? ' selected' : ''}>${i + 1}. Trippelaxel (3 axlar)</option>
        </select>
        <button type="button" class="ta-bort" data-tabort="${i}" aria-label="Ta bort nummer ${i + 1}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <label>Tryck (ton)<input type="number" inputmode="decimal" step="0.1" min="0" max="40" data-falt="tryck" value="${esc(g.tryck ?? '')}"></label>
      ${g.typ === 'enkel'
        ? `<label class="vaxel"><input type="checkbox" data-falt="driv"${g.driv ? ' checked' : ''}> Drivande axel</label>`
        : `<label>${g.typ === 'boggi' ? 'Avstånd mellan axlarna (m)' : 'Avstånd yttre axlarna (m)'}<input type="number" inputmode="decimal" step="0.01" min="0" max="10" data-falt="avst" value="${esc(g.avst ?? '')}"></label>`}
      ${g.typ === 'boggi' ? `<label class="vaxel"><input type="checkbox" data-falt="luft"${g.luft ? ' checked' : ''}> Dubbelmonterade hjul och luftfjädring</label>` : ''}
    </div>`).join('');
}
function ritaBkResultat() {
  uppdateraBedomning();
  const f = F(), b = bedomning;
  const summa = Vikt.summaTryck(f);
  const diff = Math.abs(summa - (+f.vikt || 0));
  $('summaInfo').textContent = `Summa axeltryck: ${fmtT(summa)} t` + (diff > 0.5 ? ` – stämmer inte med bruttovikten ${fmtT(f.vikt)} t.` : ' – stämmer med bruttovikten.');
  $('bkResultat').innerHTML = [4, 1, 2, 3].map((k) => `
    <div class="bk-rad ${b[k].ok ? 'ok' : 'nej'}"><b>BK${k}</b>
      <span>${b[k].ok ? `Ja (max ${esc(fmtT(b[k].brutto))} t)` : 'Nej – ' + esc(b[k].skal.join(', '))}</span></div>`).join('');
}
function fordonAndrat(ritaKartan) {
  sparaInst();
  uppdateraBedomning();
  fyllFordonsval();
  ritaBkResultat();
  visaHojd();
  if (ritaKartan) { sagda.clear(); ritaPunkter(); }
  ritaBk();
  if (vy === 'lista') ritaLista();
  ritaHytt();
}
for (const [id, nyckel, sort] of FALT) {
  $(id).addEventListener(sort === 'text' ? 'input' : 'input', (e) => {
    const f = F();
    if (sort === 'text') { f[nyckel] = e.target.value.trim() || (nyckel === 'namn' ? 'Namnlöst' : ''); }
    else {
      const v = talEllerNull(e.target.value);
      if (sort === 'hojd') { if (v == null || v < 1.5 || v > 5) return; f.hojd = Math.round(v * 100) / 100; }
      else f[nyckel] = v == null ? '' : v;
    }
    fordonAndrat(sort === 'hojd');
  });
}
$('fTyp').addEventListener('change', (e) => { F().typ = e.target.value; fordonAndrat(false); });
$('valFordon').addEventListener('change', (e) => {
  inst.aktivt = e.target.value; bkSagda.clear(); $('taBortFraga').hidden = true;
  visaFordon(); fordonAndrat(true);
});
$('btnNyttFordon').addEventListener('click', () => {
  const ny = nyttFordon({ namn: `Fordon ${inst.fordon.length + 1}` });
  inst.fordon.push(ny); inst.aktivt = ny.id;
  visaFordon(); fordonAndrat(true); $('fNamn').focus(); $('fNamn').select();
});
$('btnKopiera').addEventListener('click', () => {
  const kopia = nyttFordon({ ...JSON.parse(JSON.stringify(F())), id: undefined });
  kopia.id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  kopia.namn = `${F().namn} (kopia)`;
  inst.fordon.push(kopia); inst.aktivt = kopia.id;
  visaFordon(); fordonAndrat(true); $('fNamn').focus(); $('fNamn').select();
});
$('btnTaBort').addEventListener('click', () => {
  if (inst.fordon.length < 2) return;
  $('taBortText').textContent = `Ta bort ${F().namn}?`;
  $('taBortFraga').hidden = false;
});
$('btnTaBortNej').addEventListener('click', () => { $('taBortFraga').hidden = true; });
$('btnTaBortJa').addEventListener('click', () => {
  inst.fordon = inst.fordon.filter((f) => f.id !== inst.aktivt);
  inst.aktivt = inst.fordon[0].id;
  $('taBortFraga').hidden = true;
  visaFordon(); fordonAndrat(true);
});
$('btnNyGrupp').addEventListener('click', () => { F().grupper.push({ typ: 'enkel', driv: false, tryck: 8 }); ritaGrupper(); fordonAndrat(false); });
$('grupper').addEventListener('input', (e) => {
  const rad = e.target.closest('.grupp'); const falt = e.target.dataset.falt;
  if (!rad || !falt || falt === 'typ') return;
  const g = F().grupper[+rad.dataset.i];
  if (e.target.type === 'checkbox') g[falt] = e.target.checked;
  else { const v = talEllerNull(e.target.value); g[falt] = v == null ? '' : v; }
  fordonAndrat(false);
});
$('grupper').addEventListener('change', (e) => {
  const rad = e.target.closest('.grupp');
  if (!rad || e.target.dataset.falt !== 'typ') return;
  const g = F().grupper[+rad.dataset.i];
  g.typ = e.target.value;
  if (g.typ === 'boggi' && !g.avst) g.avst = 1.35;
  if (g.typ === 'trippel' && !g.avst) g.avst = 2.62;
  ritaGrupper(); fordonAndrat(false);
});
$('grupper').addEventListener('click', (e) => {
  const knapp = e.target.closest('[data-tabort]'); if (!knapp) return;
  F().grupper.splice(+knapp.dataset.tabort, 1);
  ritaGrupper(); fordonAndrat(false);
});

function oppnaInst() {
  fyllFordonsval();
  visaFordon();
  $('taBortFraga').hidden = true;
  $('inMarg').value = inst.marg.toFixed(2);
  $('inAutoKor').checked = inst.autoKor;
  $('inRost').checked = inst.rost;
  $('inVisaBk').checked = inst.visaBk;
  $('inTema').value = inst.tema;
  $('dataInfo').textContent = dataText();
  $('bkDataInfo').textContent = bkDataText();
  $('dlgInst').showModal();
}
function allaRitas() { visaHojd(); ritaPunkter(); ritaBk(); if (vy === 'lista') ritaLista(); ritaHytt(); $('exempelBanner').hidden = !data.exempel && !bkData.exempel; }
function lasHojd(el) {
  const v = talEllerNull(el.value);
  if (v != null && v >= 1.5 && v <= 5) return Math.round(v * 100) / 100;
  return null;
}
$('inMarg').addEventListener('input', (e) => { const v = talEllerNull(e.target.value); if (v != null && v >= 0 && v <= 1) { inst.marg = v; sparaInst(); allaRitas(); } });
$('inAutoKor').addEventListener('change', (e) => { inst.autoKor = e.target.checked; sparaInst(); });
$('inRost').addEventListener('change', (e) => { inst.rost = e.target.checked; sparaInst(); });
$('inVisaBk').addEventListener('change', (e) => { inst.visaBk = e.target.checked; sparaInst(); ritaBk(); });
$('inTema').addEventListener('change', (e) => { inst.tema = e.target.value; sparaInst(); uppdateraTema(); });
document.querySelectorAll('.stegare button').forEach((b) => b.addEventListener('click', () => {
  const inp = b.parentElement.querySelector('input');
  const v = (talEllerNull(inp.value) ?? 4) + parseFloat(b.dataset.steg);
  inp.value = Math.min(5, Math.max(1.5, v)).toFixed(2);
  inp.dispatchEvent(new Event('input'));
}));
$('inFil').addEventListener('change', (e) => {
  const fil = e.target.files[0]; if (!fil) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const ny = tolkaData(JSON.parse(r.result));
      ny.exempel = false; if (!ny.kalla) ny.kalla = fil.name;
      if (ny.sort === 'hinder' && ny.hinder.length) {
        data = ny;
        try { localStorage.setItem(DATA_KEY, JSON.stringify({ hinder: data.hinder, kalla: data.kalla, uppdaterad: data.uppdaterad })); }
        catch (err) { $('dataInfo').textContent = dataText() + ' (för stor för att sparas – ladda den igen nästa gång)'; allaRitas(); return; }
        $('dataInfo').textContent = dataText();
      } else if (ny.sort === 'bk' && ny.segment.length) {
        bkData = ny; byggRutnat();
        try {
          const platt = bkData.segment.map((sg) => [sg.bk, sg.pts.flat().map((x) => Math.round(x * 1e5) / 1e5)]);
          localStorage.setItem(BK_KEY, JSON.stringify({ segment: platt, kalla: bkData.kalla, uppdaterad: bkData.uppdaterad }));
          $('bkDataInfo').textContent = bkDataText();
        } catch (err) { $('bkDataInfo').textContent = bkDataText() + ' (för stor för att sparas – ladda den igen nästa gång)'; }
      } else { $('dataInfo').textContent = 'Hittade varken höjdhinder eller bärighetsklasser i filen.'; return; }
      allaRitas();
    } catch (err) { $('dataInfo').textContent = 'Filen kunde inte läsas. Den måste vara JSON eller GeoJSON.'; }
  };
  r.readAsText(fil);
  e.target.value = '';
});
$('btnStandardData').addEventListener('click', async () => {
  try { localStorage.removeItem(DATA_KEY); localStorage.removeItem(BK_KEY); } catch (e) {}
  await Promise.all([laddaData(), laddaBk()]);
  $('dataInfo').textContent = dataText(); $('bkDataInfo').textContent = bkDataText(); allaRitas();
});

/* ---------- Knappar ---------- */
document.querySelectorAll('.flik').forEach((f) => f.addEventListener('click', () => visaVy(f.dataset.vy)));
document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
  filter = c.dataset.filter;
  document.querySelectorAll('.chip').forEach((x) => x.classList.toggle('aktiv', x === c));
  ritaLista();
}));
$('btnFordon').addEventListener('click', oppnaInst);
$('btnBk').addEventListener('click', () => { inst.visaBk = !inst.visaBk; sparaInst(); ritaBk(); });
$('btnCentrera').addEventListener('click', () => { if (pos && karta) karta.setView([pos.lat, pos.lon], 14); else startaGps(); });
$('btnKor').addEventListener('click', () => { stangdManuellt = false; oppnaHytt(false); });
$('btnStangHytt').addEventListener('click', () => stangHytt(true));
$('btnIgnorera').addEventListener('click', () => { if (primar) { ignorerade.add(primar.h.id); ritaHytt(); } });
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && hyttAktiv && 'wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
});

/* ---------- Start ---------- */
(async function start() {
  uppdateraTema();
  visaHojd();
  startaKarta();
  await Promise.all([laddaData(), laddaBk()]);
  allaRitas();
  if (!inst.startad) {
    const f = F();
    $('inStartHojd').value = f.hojd.toFixed(2);
    $('inStartNamn').value = f.namn;
    $('inStartVikt').value = f.vikt;
    $('inStartAvst').value = f.axelavst;
    $('dlgStart').showModal();
    $('dlgStart').addEventListener('close', () => {
      const f2 = F();
      const h = lasHojd($('inStartHojd')); if (h != null) f2.hojd = h;
      const n = $('inStartNamn').value.trim(); if (n) f2.namn = n;
      const v = talEllerNull($('inStartVikt').value); if (v != null) f2.vikt = v;
      const a = talEllerNull($('inStartAvst').value); if (a != null) f2.axelavst = a;
      inst.startad = true; fordonAndrat(true); startaGps();
    }, { once: true });
  } else startaGps();
  setInterval(uppdateraTema, 5 * 60 * 1000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
}
