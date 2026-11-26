#!/usr/bin/env python3
"""
Gör om Trafikverkets höjdhinder (NVDB, från Lastkajen) till data/hinder.json för appen Fri höjd.

Användning:
    python3 nvdb_till_json.py <fil.gpkg eller fil.geojson> [ut.json]

- Hämta datan gratis på https://lastkajen.trafikverket.se (skapa konto, välj vägdata
  med företeelsen "Höjdhinder upp till 4,5 meter", format GeoPackage eller GeoJSON).
- Koordinater i SWEREF 99 TM (EPSG:3006) räknas om till WGS84.
- Kräver bara Python 3, inga extra paket.
"""
import json, math, re, sqlite3, struct, sys, datetime

HOJD = re.compile(r"fri.?h|h[oö]jd|height", re.I)
NAMN = re.compile(r"^(namn|name|beskrivning|typ)", re.I)
VAG = re.compile(r"v[aä]g.?n|vagnummer|road|^v[aä]g$", re.I)


def sweref99tm_till_wgs84(northing, easting):
    a, f, lon0, k0, fe = 6378137.0, 1 / 298.257222101, math.radians(15.0), 0.9996, 500000.0
    e2 = f * (2 - f); n = f / (2 - f)
    ar = a / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    d1 = n / 2 - 2 * n**2 / 3 + 37 * n**3 / 96 - n**4 / 360
    d2 = n**2 / 48 + n**3 / 15 - 437 * n**4 / 1440
    d3 = 17 * n**3 / 480 - 37 * n**4 / 840
    d4 = 4397 * n**4 / 161280
    As = e2 + e2**2 + e2**3 + e2**4
    Bs = -(7 * e2**2 + 17 * e2**3 + 30 * e2**4) / 6
    Cs = (224 * e2**3 + 889 * e2**4) / 120
    Ds = -(4279 * e2**4) / 1260
    xi = northing / (k0 * ar); eta = (easting - fe) / (k0 * ar)
    xp = xi - sum(d * math.sin(2 * k * xi) * math.cosh(2 * k * eta) for k, d in enumerate((d1, d2, d3, d4), 1))
    ep = eta - sum(d * math.cos(2 * k * xi) * math.sinh(2 * k * eta) for k, d in enumerate((d1, d2, d3, d4), 1))
    phi = math.asin(math.sin(xp) / math.cosh(ep))
    lon = lon0 + math.atan(math.sinh(ep) / math.cos(xp))
    s = math.sin(phi) ** 2
    lat = phi + math.sin(phi) * math.cos(phi) * (As + Bs * s + Cs * s * s + Ds * s**3)
    return math.degrees(lat), math.degrees(lon)


def till_wgs(x, y):
    """x = öst/longitud, y = nord/latitud."""
    if abs(x) <= 180 and abs(y) <= 90:
        return y, x
    return sweref99tm_till_wgs84(y, x)


def tal(v):
    if v is None or v == "":
        return None
    try:
        t = float(str(v).replace(",", "."))
    except ValueError:
        return None
    return t if 0 < t <= 20 else None


# ---------- GeoPackage ----------
def las_wkb(b, o=0):
    """Returnerar (x, y) för en representativ punkt i en WKB-geometri."""
    end = "<" if b[o] == 1 else ">"
    typ = struct.unpack_from(end + "I", b, o + 1)[0]
    iso = (typ & 0x0FFFFFFF) // 1000          # 0 = 2D, 1 = Z, 2 = M, 3 = ZM
    har_z = bool(typ & 0x80000000) or iso in (1, 3)
    har_m = bool(typ & 0x40000000) or iso in (2, 3)
    bas = (typ & 0x0FFFFFFF) % 1000
    dim = 2 + har_z + har_m
    o += 5
    if bas == 1:  # Point
        return struct.unpack_from(end + "dd", b, o)
    if bas == 2:  # LineString – mittersta punkten
        n = struct.unpack_from(end + "I", b, o)[0]
        i = n // 2
        return struct.unpack_from(end + "dd", b, o + 4 + i * 8 * dim)
    if bas in (4, 5, 6, 7):  # Multi* / GeometryCollection – första delen
        return las_wkb(b, o + 4)
    if bas == 3:  # Polygon – första punkten
        return struct.unpack_from(end + "dd", b, o + 8)
    raise ValueError(f"Okänd geometrityp {typ}")


def las_gpkg_geom(blob):
    if blob is None or blob[:2] != b"GP":
        return None
    flaggor = blob[3]
    env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get((flaggor >> 1) & 0x07, 0)
    if flaggor & 0x10:  # tom geometri
        return None
    return las_wkb(blob, 8 + env)


def las_gpkg(sokvag):
    db = sqlite3.connect(sokvag)
    tabeller = [r[0] for r in db.execute("select table_name from gpkg_contents where data_type='features'")]
    hojdtab = [t for t in tabeller if re.search(r"h[oö]jd", t, re.I)]
    for tab in hojdtab or tabeller:
        geomkol = db.execute("select column_name from gpkg_geometry_columns where table_name=?", (tab,)).fetchone()
        if not geomkol:
            continue
        cur = db.execute(f'select * from "{tab}"')
        kolumner = [d[0] for d in cur.description]
        hkol = next((k for k in kolumner if HOJD.search(k) and k != geomkol[0]), None)
        if not hkol:
            continue
        print(f"  Tabell {tab}: höjd i kolumnen '{hkol}'", file=sys.stderr)
        for rad in cur:
            p = dict(zip(kolumner, rad))
            try:
                xy = las_gpkg_geom(p[geomkol[0]])
            except Exception:
                xy = None
            if xy:
                yield p, xy


# ---------- GeoJSON ----------
def forsta_punkt(g):
    t, c = g.get("type"), g.get("coordinates")
    if t == "Point": return c
    if t == "LineString": return c[len(c) // 2]
    if t in ("MultiPoint",): return c[0]
    if t in ("MultiLineString", "Polygon"): return c[0][0]
    if t == "MultiPolygon": return c[0][0][0]
    return None


def las_geojson(sokvag):
    with open(sokvag, encoding="utf-8") as f:
        fc = json.load(f)
    for ft in fc.get("features", []):
        g = ft.get("geometry")
        c = forsta_punkt(g) if g else None
        if c:
            yield ft.get("properties") or {}, (c[0], c[1])


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    inn = sys.argv[1]
    ut = sys.argv[2] if len(sys.argv) > 2 else "hinder.json"
    kalla = las_gpkg(inn) if inn.lower().endswith(".gpkg") else las_geojson(inn)
    hinder, sedda = [], set()
    for i, (p, (x, y)) in enumerate(kalla):
        h = tal(next((v for k, v in p.items() if HOJD.search(k)), None))
        if h is None:
            continue
        lat, lon = till_wgs(x, y)
        nyckel = (round(lat, 5), round(lon, 5), h)
        if nyckel in sedda:
            continue
        sedda.add(nyckel)
        namn = next((v for k, v in p.items() if NAMN.search(k) and v), None)
        vag = next((v for k, v in p.items() if VAG.search(k) and v not in (None, "")), None)
        hinder.append({"id": str(p.get("fid", p.get("id", i))), "lat": round(lat, 6), "lon": round(lon, 6),
                       "h": round(h, 2), "namn": str(namn) if namn else "Höjdhinder",
                       "vag": str(vag) if vag is not None else ""})
    if not hinder:
        print("Hittade inga höjdhinder med fri höjd. Kontrollera att filen innehåller företeelsen Höjdhinder.", file=sys.stderr)
        sys.exit(2)
    with open(ut, "w", encoding="utf-8") as f:
        json.dump({"kalla": "Trafikverket NVDB via Lastkajen (CC0)",
                   "uppdaterad": datetime.date.today().isoformat(),
                   "exempel": False, "hinder": hinder}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Klart: {len(hinder)} höjdhinder sparade i {ut}", file=sys.stderr)


if __name__ == "__main__":
    main()
