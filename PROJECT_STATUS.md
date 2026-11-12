# PROJECT_STATUS – Trainings Log

_Letzte Aktualisierung: 12.11.2026 · nach Arbeitspaket 1_

Konzept: siehe `KONZEPT.md` im Claude-Projekt „Trainings Log“ (Phase 2, freigegeben).

## Entscheidungen nach Konzeptfreigabe
- Slow-Motion (`timed_tempo`): Ziel immer 5:00. Ab 5:00 wird Gewicht vorgeschlagen; mit neuem Gewicht gilt wieder 5:00.
- Slow-Motion hat ein Gewichtsfeld. Leg Press Calf Raises mit Zusatzgewicht (Vorbelegung = letzter Wert), Squats/RDLs Standard 0.
- Akzentfarbe Orange `#FF9F0A`.
- Tempobalken: 7 s DOWN, 7 s UP (eine Wiederholung = 14 s).
- Signale nur visuell, kein Ton, keine Vibration. Kein RIR.
- Progression `weight_reps`: Satz 1 erreicht `repMax` → nächstes Mal `+increment`. Bei einseitigen Übungen gilt die schwächere Seite.
- „Letztes Training“ = letzte Ausführung derselben Übung, über alle Trainingstage hinweg.
- Zyklus: D1…D6 → Ruhetag. Ausgelassene Tage verschieben den Plan. Der Ruhetag ist der erste Kalendertag nach D6.

## Stack
React 19 + TypeScript + Vite 8 · vite-plugin-pwa · Dexie (IndexedDB) · react-router (Hash-Routing) · Vitest + fake-indexeddb. Geplant: Supabase (Auth per E-Mail-Code + Sync).

## Struktur
```
src/
  domain/   types.ts, cycle.ts (+test), format.ts
  db/       db.ts (Dexie-Schema v1), seed.ts (+test), queries.ts (Live-Queries), ids.ts
  components/ Shell.tsx (Tab-Bar mobil / Sidebar ≥900px), Icons.tsx
  screens/  Today.tsx, Profile.tsx (Plan + Tagesdetail), Placeholders.tsx (History/Progress leer)
  styles/   tokens.css (Design-Tokens), base.css
public/     icon.svg + PNG-Icons
```

## AP1 – Grundgerüst ✅
**Implementiert**
- PWA-Setup: Manifest, Service Worker, Offline-Cache, iOS-Meta-Tags, Icons
- Design-Tokens im dunklen Look, Navigation mit 4 Tabs bzw. Desktop-Sidebar
- Lokales Datenbankschema mit allen Tabellen aus dem Konzept, Soft-Delete und `updatedAt` für den späteren Sync
- Startplan wird einmalig angelegt: 22 Übungen, 6 Tage, geteilte Übungen als eine Entität
- Zykluslogik als reine Funktion mit Tests: nächstes Training, Verschiebung, Ruhetag
- Today: Wochenvorschau (7 Tage) und nächstes Training mit den Übungen
- Profile: Liste der Plantage, Tagesdetail
- `navigator.storage.persist()` gegen Datenverlust auf iOS

**Tests:** 8/8 grün (Zyklus, Seed). Build und Typprüfung sauber. Screenshots im iPhone- und Desktop-Viewport geprüft.

## Offen
- Hosting-Konto (GitHub oder Vercel) fehlt noch vom Nutzer
- Supabase-Projekt noch nicht angelegt (AP9)
- History und Progress zeigen bis AP5/AP7 nur leere Zustände; der Start-Button folgt mit AP3

## Nächster Schritt
**AP2 – Übungsbibliothek und Plan-Editor**: Tage und Übungen hinzufügen, entfernen, verschieben, umbenennen; Übungseinstellungen (Typ, Spanne, Sätze, Pause, Steigerung, Muskeln, Notiz).
Danach **AP3 – Workout-Tracking**.
