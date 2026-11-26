# Fri höjd

En webbapp för lastbilsförare som visar höjdhinder (låga broar, viadukter, portaler) på svenska vägar,
enligt Trafikverkets vägdatabas NVDB. Fabler & Fakta Studio.

**Tre lägen**
- **Karta** – alla hinder på kartan, färgade efter ditt fordons höjd (röd = för lågt, gul = nära gränsen, grön = OK).
- **Lista** – hindren närmast dig, sorterade på avstånd.
- **Körläge** – slår på av sig självt när du kör (över ca 15 km/h) och stängs när du stått still en minut.
  Visar nästa hinder i färdriktningen med stora siffror och säger till med röst.
  Mörkt läge slås på automatiskt efter solnedgång.

## Riktig data från Trafikverket
Appen levereras med **exempeldata**. Så byter du till riktiga höjdhinder:
1. Skapa ett gratis konto på https://lastkajen.trafikverket.se
2. Beställ vägdata med företeelsen *Höjdhinder upp till 4,5 meter* för hela Sverige, som GeoPackage (.gpkg) eller GeoJSON.
3. Kör: `python3 verktyg/nvdb_till_json.py Hojdhinder.gpkg data/hinder.json`
4. Publicera om. (Eller ladda filen direkt i appen under Inställningar → Ladda egen datafil.)

Vägdatan är öppen (CC0). Kartan: © OpenStreetMap, © CARTO.

## Begränsningar
- Följ alltid skyltningen. Datan kan vara fel eller inaktuell.
- Hinder högre än 4,5 m och tillfälliga hinder (vägarbeten) finns inte med i NVDB.
- Körläget visar hinder i färdriktningen inom 3 km, men vet inte vilken väg du kommer att ta.

## Publicera
Statisk sajt – fungerar direkt på GitHub Pages. Kan installeras på hemskärmen (PWA).
