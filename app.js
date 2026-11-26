/* Fri höjd – Fabler & Fakta Studio
   Tre roller: Karta och Lista är flikar, Hyttläget slår på av sig självt när man kör. */
{
'use strict';

/* ---------- Inställningar ---------- */
const INST_KEY = 'frihojd.inst';
const DATA_KEY = 'frihojd.egenData';
const STANDARD = { hojd: 4.0, marg: 0.2, autoKor: true, rost: true, tema: 'auto', startad: false };
let inst = { ...STANDARD };
try { inst = { ...STANDARD, ...JSON.parse(localStorage.getItem(INST_KEY) || '{}') }; } catch (e) {}
function sparaInst() { try { localStorage.setItem(INST_KEY, JSON.stringify(inst)); } catch (e) {} }

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
  if (h <= inst.hojd) return 'rod';
  if (h < inst.hojd + inst.marg) return 'gul';
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

function talEllerNull(v) {
  if (v == null || v === '') return null;
  const t = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(t) ? t : null;
}
function hittaFalt(props, monster) {
  for (const k of Object.keys(props)) if (monster.test(k)) return props[k];
  return undefined;
}
function tolkaData(json) {
  const ut = { hinder: [], exempel: !!json.exempel, kalla: json.kalla || json['källa'] || '', uppdaterad: json.uppdaterad || '' };
  if (Array.isArray(json.hinder)) {
    json.hinder.forEach((h, i) => {
      const fri = talEllerNull(h.h);
      if (fri == null || !Number.isFinite(+h.lat) || !Number.isFinite(+h.lon)) return;
      ut.hinder.push({ id: String(h.id ?? i), lat: +h.lat, lon: +h.lon, h: fri, namn: h.namn || 'Höjdhinder', vag: h.vag || '' });
    });
    return ut;
  }
  if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
    if (!ut.kalla) ut.kalla = 'Egen GeoJSON-fil';
    json.features.forEach((f, i) => {
      const g = f.geometry; const p = f.properties || {};
      if (!g) return;
      let c = g.type === 'Point' ? g.coordinates
        : g.type === 'LineString' ? g.coordinates[Math.floor(g.coordinates.length / 2)]
        : g.type === 'MultiPoint' ? g.coordinates[0]
        : g.type === 'MultiLineString' ? g.coordinates[0][0] : null;
      if (!c) return;
      let lat = +c[1], lon = +c[0];
      if (Math.abs(lon) > 180 || Math.abs(lat) > 90) ({ lat, lon } = sweref99tmTillWgs84(+c[1], +c[0]));
      const fri = talEllerNull(hittaFalt(p, /fri.?h|h[oö]jd|height/i));
      if (fri == null || fri <= 0 || fri > 20) return;
      const namn = hittaFalt(p, /^(namn|name|beskrivning|typ)/i);
      const vag = hittaFalt(p, /v[aä]g.?n|vagnummer|road|^v[aä]g$/i);
      ut.hinder.push({ id: String(f.id ?? p.id ?? i), lat, lon, h: fri, namn: namn ? String(namn) : 'Höjdhinder', vag: vag != null ? String(vag) : '' });
    });
  }
  return ut;
}
async function laddaData() {
  let egen = null;
  try { egen = localStorage.getItem(DATA_KEY); } catch (e) {}
  if (egen) {
    try { data = tolkaData(JSON.parse(egen)); if (data.hinder.length) return; } catch (e) {}
  }
  try {
    const svar = await fetch('data/hinder.json', { cache: 'no-cache' });
    data = tolkaData(await svar.json());
  } catch (e) {
    data = { hinder: [], exempel: false, kalla: 'Kunde inte läsa appens data', uppdaterad: '' };
  }
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
  const marg = h.h - inst.hojd;
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
  punktLager = L.layerGroup().addTo(karta);
  etikettLager = L.layerGroup().addTo(karta);
  karta.on('moveend', () => { ritaEtiketter(); if (vy === 'lista') ritaLista(); });
  ritaPunkter();
}

/* ---------- Lista ---------- */
let filter = 'alla';
function ritaLista() {
  const bas = pos || (karta ? { lat: karta.getCenter().lat, lon: karta.getCenter().lng } : GBG);
  let rader = data.hinder.map((h) => ({ h, d: avstand(bas, h), s: status(h.h) }))
    .filter((r) => r.d < 50000 && (filter === 'alla' || r.s !== 'gron'))
    .sort((a, b) => a.d - b.d).slice(0, 60);
  $('listInfo').textContent = pos
    ? `Närmast din position, inom 5 mil. Ditt fordon: ${fmtM(inst.hojd)} m.`
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
  $('hyttDinHojd').textContent = `DIN HÖJD ${fmtM(inst.hojd)} M`;
  const lista = framfor();
  primar = lista.find((r) => r.s !== 'gron') || null;
  const visad = primar || lista[0] || null;
  if (visad) {
    $('hyttAvstand').innerHTML = esc(fmtAvst(visad.d)).replace(/ (m|km)$/, ' <small>$1</small>');
    $('hyttMatare').style.width = `${Math.max(4, (1 - visad.d / FRAMAT_M) * 100)}%`;
    const marg = visad.h.h - inst.hojd;
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
      ? `Du får inte plats – ${fmtM(inst.hojd - primar.h.h)} m för lågt. Välj en annan väg.`
      : `Nära gränsen – bara ${fmtM(primar.h.h - inst.hojd)} m marginal. Kör försiktigt.`;
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

/* ---------- Inställningar ---------- */
function visaHojd() {
  $('pillHojd').textContent = `${fmtM(inst.hojd)} m`;
}
function dataText() {
  const n = data.hinder.length;
  return `${n.toLocaleString('sv-SE')} höjdhinder${data.kalla ? ' · ' + data.kalla : ''}${data.uppdaterad ? ' · uppdaterad ' + data.uppdaterad : ''}${data.exempel ? ' · EXEMPELDATA' : ''}`;
}
function oppnaInst() {
  $('inHojd').value = inst.hojd.toFixed(2);
  $('inMarg').value = inst.marg.toFixed(2);
  $('inAutoKor').checked = inst.autoKor;
  $('inRost').checked = inst.rost;
  $('inTema').value = inst.tema;
  $('dataInfo').textContent = dataText();
  $('dlgInst').showModal();
}
function allaRitas() { visaHojd(); ritaPunkter(); if (vy === 'lista') ritaLista(); ritaHytt(); $('exempelBanner').hidden = !data.exempel; }
function lasHojd(el) {
  const v = talEllerNull(el.value);
  if (v != null && v >= 1.5 && v <= 5) return Math.round(v * 100) / 100;
  return null;
}
$('inHojd').addEventListener('input', (e) => { const v = lasHojd(e.target); if (v != null) { inst.hojd = v; sparaInst(); sagda.clear(); allaRitas(); } });
$('inMarg').addEventListener('input', (e) => { const v = talEllerNull(e.target.value); if (v != null && v >= 0 && v <= 1) { inst.marg = v; sparaInst(); allaRitas(); } });
$('inAutoKor').addEventListener('change', (e) => { inst.autoKor = e.target.checked; sparaInst(); });
$('inRost').addEventListener('change', (e) => { inst.rost = e.target.checked; sparaInst(); });
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
      const json = JSON.parse(r.result);
      const ny = tolkaData(json);
      if (!ny.hinder.length) { $('dataInfo').textContent = 'Hittade inga höjdhinder med fri höjd i filen.'; return; }
      ny.exempel = false; if (!ny.kalla) ny.kalla = fil.name;
      data = ny;
      try { localStorage.setItem(DATA_KEY, JSON.stringify({ hinder: data.hinder, kalla: data.kalla, uppdaterad: data.uppdaterad })); }
      catch (err) { $('dataInfo').textContent = dataText() + ' (för stor för att sparas – laddas om nästa gång)'; allaRitas(); return; }
      $('dataInfo').textContent = dataText();
      allaRitas();
    } catch (err) { $('dataInfo').textContent = 'Filen kunde inte läsas. Den måste vara JSON eller GeoJSON.'; }
  };
  r.readAsText(fil);
  e.target.value = '';
});
$('btnStandardData').addEventListener('click', async () => {
  try { localStorage.removeItem(DATA_KEY); } catch (e) {}
  await laddaData(); $('dataInfo').textContent = dataText(); allaRitas();
});

/* ---------- Knappar ---------- */
document.querySelectorAll('.flik').forEach((f) => f.addEventListener('click', () => visaVy(f.dataset.vy)));
document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
  filter = c.dataset.filter;
  document.querySelectorAll('.chip').forEach((x) => x.classList.toggle('aktiv', x === c));
  ritaLista();
}));
$('btnFordon').addEventListener('click', oppnaInst);
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
  await laddaData();
  allaRitas();
  if (!inst.startad) {
    $('inStartHojd').value = inst.hojd.toFixed(2);
    $('dlgStart').showModal();
    $('dlgStart').addEventListener('close', () => {
      const v = lasHojd($('inStartHojd'));
      if (v != null) inst.hojd = v;
      inst.startad = true; sparaInst(); allaRitas(); startaGps();
    }, { once: true });
  } else startaGps();
  setInterval(uppdateraTema, 5 * 60 * 1000);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
}
