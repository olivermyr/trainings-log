# PROJECT_STATUS – Trainings Log

_Letzte Aktualisierung: 12.11.2026 · nach Arbeitspaket 5_

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
  screens/  Today, Profile (Plan), Exercises (Bibliothek/Editor), Workout (+Stopwatch), Placeholders (History/Progress)
  db/       + plan.ts, workout.ts, timers.ts
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

## AP3 – Workout-Tracking ✅
**Implementiert**
- `db/workout.ts`:
  - `startWorkout` (immer nur ein aktives Training), Sätze werden mit der letzten Ausführung derselben Übung vorausgefüllt, tagübergreifend
  - `getPreviousPerformance`, `finishWorkout` (unerledigte Sätze werden verworfen; ohne erledigten Satz kein Abschluss), `discardWorkout`
  - Sätze hinzufügen und entfernen (bei einseitigen Übungen paarweise), Übung zum heutigen Training hinzufügen oder daraus entfernen, Notiz pro Übung und Training
- `domain/workout.ts`: `buildInitialSets`, `previousFor`, `progressionSuggestion` (Satz 1 ≥ repMax bzw. Zeit ≥ Ziel → +increment; einseitig: die schwächere Seite entscheidet), Parser für „82,5“ und „2:30“
- `screens/Workout.tsx` (Route `/workout`, außerhalb der Tab-Bar):
  - Übungsblöcke zum Aufklappen; nach der letzten erledigten Übung klappt automatisch die nächste offene auf
  - Spalte LAST, Eingabefelder für kg und Wiederholungen; ✓ prüft auf leere Felder und setzt dann den Fokus darauf
  - Erledigte Sätze sind gesperrt, erst ein Tipp macht sie bearbeitbar
  - Gewichtsvorschlag mit „Apply“, Abschluss-Sheet
- Today: Buttons „Start Workout“ bzw. „Resume Workout“, „Train a different day“
- Mini-Leiste über der Tab-Bar, solange ein Training läuft

## AP4 – Pausentimer & Slow-Motion-Stoppuhr ✅
**Implementiert**
- Timer speichern ihre Zeitstempel in `settings` (`restTimer`, `stopwatch`). Damit stimmen sie nach Sperrbildschirm, Navigation und Neuladen.
- Pause startet automatisch nach ✓ (`maybeStartRestAfter`); bei einseitigen Übungen erst, wenn beide Seiten erledigt sind. Dauer laut `exercise.restSeconds`.
- `RestPanel`: Countdown, Fortschrittsbalken, +30s, Skip. Bei Ablauf wird das Panel orange, pulsiert und zählt „+0:12“ weiter. Ohne laufenden Timer gibt es einen manuellen Button „Rest m:ss“.
- Die Mini-Leiste zeigt während der Pause den Countdown, danach „Go“.
- `StopwatchOverlay`: 3 s Vorlauf, große Zeitanzeige, Tempobalken DOWN/UP mit je `tempoSeconds`, Zähler für Wiederholungen, Fortschritt zum Ziel mit Markierung für den letzten Wert, große Stop-Fläche. Danach Ergebnis mit Zusatzgewicht, „Save Set“ oder „Redo“. Die Zeit kann auch manuell eingegeben werden.
- Wake Lock, solange ein Training läuft
- Keine Töne und keine Vibration (gewünscht; iOS-Web-Apps können ohnehin nicht vibrieren)

**Tests:** 28/28 grün. Ende-zu-Ende im iPhone-Viewport geprüft, mit Fake-Clock für die Timer:
- Training komplett mit Vorausfüllen und Gewichtsvorschlag
- Neuladen während eines laufenden Trainings
- Neuladen während der laufenden Stoppuhr (die Zeit läuft korrekt weiter)
- Pause → Mini-Leiste → „Rest over“

## AP5 – Kalender, History, Bearbeiten & Nachtragen ✅
**Implementiert**
- `domain/history.ts`:
  - `classifyPastDays`: Ruhetag (Tag nach dem letzten Plantag oder explizit markiert) vs. Lücke
  - `monthGrid`: Wochen beginnen am Montag
- `domain/stats.ts`: Volumen = Gewicht × Wiederholungen × loadFactor, nur erledigte Arbeitssätze, Zeit-Übungen = 0
- `getPreviousPerformance(exerciseId, refWorkout)` berücksichtigt nur Trainings **vor** dem betrachteten Training. Werte aus späteren Trainings landen damit nicht in nachgetragenen.
- `createBackfillWorkout(planDayId, date)` legt ein Training direkt mit Status „done“ an (12:00 Uhr) und blockiert damit kein Live-Training. `finalizeWorkout` verwirft unerledigte Sätze und löscht leere Trainings. Dazu `updateWorkout` (Datum, Notiz) und `toggleRestDay`.
- `Workout.tsx` → gemeinsamer `WorkoutEditor` mit Live-Modus und Edit-Modus:
  - Edit: Datumsfeld, „Done“, keine Pausen und kein Wake Lock; die Stoppuhr erlaubt nur manuelle Zeiteingabe
  - Route `/history/workout/:id/edit`
- `History.tsx`:
  - Monatskalender: erledigte Trainings als gefüllter Punkt in der Tagesfarbe, geplante als Ring (70 Tage im Voraus), Lücken als Strich, Ruhetage ohne Markierung
  - Tagespanel: Trainings, Plan, „Log Workout“ zum Nachtragen, Ruhetag markieren
  - Liste der Trainings im Monat mit Sätzen und Volumen; Desktop zweispaltig
- `WorkoutDetail.tsx` (`/history/workout/:id`, als Zusammenfassung unter `/summary/:id`): Dauer, Sätze, Volumen, Sätze pro Übung, Notiz, Bearbeiten, Löschen. „Finish“ führt jetzt zur Zusammenfassung.

**Tests:** 32/32 grün. Ende-zu-Ende geprüft:
- zwei Trainings nachgetragen, Ruhetag markiert
- Today schlägt danach korrekt Day 3 vor
- Live-Training → Zusammenfassung

## Offen
- Supabase-Projekt noch nicht angelegt (AP9)
- Progress zeigt bis AP7 nur einen leeren Zustand
- Die Zusammenfassung zeigt noch keine PRs und keinen Vergleich mit dem letzten gleichen Tag (AP6)
- „Last“ bei der Stoppuhr ist der letzte Wert; ein echter PR folgt mit AP6

## Deployment
GitHub `olivermyr/trainings-log` → Actions-Workflow (Tests, Build) → GitHub Pages: https://olivermyr.github.io/trainings-log/

## Nächster Schritt
**AP6 – PRs & Zusammenfassung**:
- PR-Erkennung: schwerstes Gewicht, meiste Wiederholungen bei einem Gewicht, bestes e1RM (Epley), höchstes Volumen pro Einheit, längste Zeit bei einem Gewicht, meiste Wiederholungen mit Körpergewicht
- PR-Badge am Satz im Live-Training
- Zusammenfassung mit PRs und Vergleich mit dem letzten gleichen Trainingstag
