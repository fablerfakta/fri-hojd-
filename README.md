# Fri höjd

En webbapp för lastbilsförare som visar höjdhinder (låga broar, viadukter, portaler) på svenska vägar,
enligt Trafikverkets vägdatabas NVDB. Fabler & Fakta Studio.

**Fordon**
- Spara flera fordon/ekipage: namn, regnummer, typ, höjd, bredd, längd, bruttovikt, tjänstevikt,
  axelavstånd och alla axlar/boggier/trippelaxlar med tryck. Byt aktivt fordon under Inställningar.
- Appen räknar ut vilka bärighetsklasser (BK1–BK4) ekipaget får köra på, enligt trafikförordningens
  bruttoviktstabeller (bilaga 1–4) och 4 kap. 12 § (axel-, boggi- och trippelaxeltryck).

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
4. Bärighet: beställ företeelsen *Bärighet* och kör `python3 verktyg/nvdb_till_json.py --bk Barighet.gpkg data/bk.json`
5. Publicera om. (Eller ladda filen direkt i appen under Inställningar → Ladda egen datafil.)

Vägdatan är öppen (CC0). Kartan: © OpenStreetMap, © CARTO.

## Begränsningar
- Följ alltid skyltningen. Datan kan vara fel eller inaktuell.
- Hinder högre än 4,5 m och tillfälliga hinder (vägarbeten) finns inte med i NVDB.
- Viktberäkningen tar inte hänsyn till lokala viktbegränsningar på broar, tjällossning, särregler för enskilda fordon eller dispenser.
- Bredd och längd sparas men kontrolleras ännu inte mot vägdata.
- Körläget visar hinder i färdriktningen inom 3 km, men vet inte vilken väg du kommer att ta.

## Publicera
Statisk sajt – fungerar direkt på GitHub Pages. Kan installeras på hemskärmen (PWA).
