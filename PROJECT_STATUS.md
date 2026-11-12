# PROJECT_STATUS – Trainings Log

_Letzte Aktualisierung: 12.11.2026 · nach Arbeitspaket 2_

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

## AP2 – Plan-Editor & Übungsbibliothek ✅
**Implementiert**
- Tage: hinzufügen, umbenennen, Farbe wählen, im Zyklus verschieben, löschen (mit zweitem Tipp zur Bestätigung; alte Trainings bleiben erhalten)
- „Day N“ wird aus der Position berechnet, der Name ist nur der Titel. Nach dem Verschieben bleiben die Nummern dadurch korrekt.
- Übungen pro Tag: hinzufügen (aus der Bibliothek oder neu anlegen), entfernen, nach oben oder unten verschieben
- Übungsbibliothek: Liste, neue Übung, archivieren und wiederherstellen. Archivieren entfernt die Übung aus allen Tagen, die Historie bleibt.
- Übungseditor mit Autosave:
  - Typ (Weight / Bodyweight / Slow tempo), Seiten getrennt, Gewicht pro Hantel
  - Sätze, Wiederholungsspanne, Zielzeit, Sekunden pro Phase, Gewichtsschritt, Pause
  - Gewichtung der Muskelgruppen (–/½/1), dauerhafte Notiz
- Neue Dateien: `db/plan.ts` (+test), `screens/Exercises.tsx`, `components/Form.tsx` (Stepper, Segmented, Toggle, Sheet, CommitInput), `form.css`, `profile.css`

**Tests:** 12/12 grün. Klickpfad im iPhone-Viewport durchgespielt: Übung verschieben, aus der Bibliothek hinzufügen, Editor öffnen.

## Offen
- GitHub-Repo `trainings-log` (Public) muss der Nutzer anlegen, danach Push und GitHub Pages
- Supabase-Projekt noch nicht angelegt (AP9)
- History und Progress zeigen bis AP5/AP7 nur leere Zustände; der Start-Button folgt mit AP3

## Nächster Schritt
**AP3 – Workout-Tracking**: Training starten, Sätze mit Werten der letzten Ausführung vorausfüllen, Vorwerte anzeigen, abhaken und sperren, Sätze hinzufügen und löschen, einseitige Übungen, Absturzsicherheit, Gewichtsvorschlag.
