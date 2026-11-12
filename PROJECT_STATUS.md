# PROJECT_STATUS – Trainings Log

_Letzte Aktualisierung: 12.11.2026 · nach Arbeitspaket 9_

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
React 19 + TypeScript + Vite 8 · vite-plugin-pwa · Dexie (IndexedDB) · react-router (Hash-Routing) · Vitest + fake-indexeddb · Supabase (Auth per E-Mail-Code + Sync).

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

## Zyklus-Anker (Nutzerwunsch 12.11.) ✅
- Profile → „Set Today's Workout“ speichert `settings.cycleAnchor = {date, planDayId}`.
- `projectSchedule(..., anchor)`: Der Anker gilt, bis ein Training an einem späteren Datum geloggt wird. Ein Training am Anker-Tag selbst übernimmt wieder.
- Nutzer will heute (Do 12.11.) Day 4, damit der Sonntag Ruhetag ist. Das muss er selbst in der App setzen, weil die Daten lokal auf seinem Gerät liegen.

## AP6 – Personal Records & Zusammenfassung ✅
**Implementiert**
- `domain/records.ts`:
  - `e1rm` (Epley)
  - `detectPRs(ex, previousSessions, current)` erkennt `weight`, `e1rm`, `repsAtWeight` (nur Gewichte, die schon einmal verwendet wurden), `volume` (pro Einheit), `reps` (Körpergewicht) und `time` (pro Zusatzgewicht; ein neues höheres Zusatzgewicht zählt als `weight`)
  - Die erste Einheit einer Übung setzt nur die Basis und erzeugt keine PRs. Jede PR-Art wird genau dem besten Satz zugeordnet.
  - `sessionScore` für den Vergleich mit dem letzten Mal
- `db/workout.ts`: `getExerciseSessions(exerciseId, ref)` (nur Einheiten vor dem Training), `getPreviousSameDay(ref)`
- `useWorkoutDetail` liefert pro Übung `prs` und `compare` (letztes Training desselben Plantags). Live-Query: Das PR-Badge erscheint direkt nach ✓.
- Im Training: kleines orangefarbenes „PR“ unter der Satznummer, PR-Chip im Übungskopf
- Zusammenfassung und Detailansicht:
  - Volumen ±% gegenüber dem letzten gleichen Trainingstag
  - Liste der PRs pro Übung mit altem Wert
  - ↑ Better / ↓ Lower / = Same pro Übung

**Tests:** 43/43 grün. Ende-zu-Ende geprüft: Training nachgetragen → Live-Training mit mehr Gewicht → PR-Badge im Training → Zusammenfassung zeigt drei PRs und +7 %.

## AP7 – Analytics (Progress) ✅
**Implementiert**
- `domain/analytics.ts`:
  - `exerciseSeries` (pro Einheit: e1RM, Top-Satz, Wiederholungen, Volumen, beste Zeit)
  - `comparePeriods` (Bestwert der letzten 4 Wochen gegen die 4 Wochen davor)
  - `weeklyStats` (inklusive leerer Wochen, Durchschnittsdauer nur bei echten Zeiten > 5 min)
  - `muscleSets`, `muscleSetsByWeek` (gewichtet; einseitige L+R zählen als 1 Satz)
- `useLoggedWorkouts()`: ein Loader für alle Analytics (erledigte Arbeitssätze)
- `components/Chart.tsx` mit eigenen SVG-Charts, umgesetzt nach dem dataviz-Skill:
  - LineChart: 2px-Linie, Crosshair und Tooltip, Tastatur ←/→, optionale Ziellinie; Marker nur bei ≤ 16 Punkten, sonst nur am Endpunkt
  - ColumnChart: Säulen ≤ 24px mit 4px runder Oberkante, Tooltip pro Säule
  - HBarChart: Wert am Balkenende
  - `niceTicks` mit den Modi `any`, `integer` und `time` (Schritte von 15/30/60 s)
  - Nur eine Datenreihe pro Chart, Farbe immer Orange, Text nie in der Datenfarbe, eine Y-Achse
- `screens/Progress.tsx`, Ansicht per Segmented-Control:
  - Exercises: Liste mit dem letzten Wert, sortiert nach dem letzten Training. Übungsdetail `/progress/exercise/:id` mit Kennzahlen, Metrik-Umschalter (Est. 1RM / Top weight / Top reps / Volume; Time / Weight; Best set / Total reps), Vergleich 4 gegen 4 Wochen, Zeitraum, Bestwerte pro Gewicht, Liste der Einheiten als Tabellenansicht mit Link zum Training
  - Volume: Kennzahlen (diese Woche, Workouts, Durchschnittsdauer), Volumen pro Woche, Workouts pro Woche, Volumen pro Training
  - Muscles: Durchschnitt nur über **abgeschlossene** Wochen, horizontale Balken ohne Soll-Linie, Tipp auf eine Muskelgruppe zeigt deren Wochenverlauf
- Testhooks `window.__db` und `__api` nur im Dev-Server (`import.meta.env.DEV`), nicht im Production-Build

**Tests:** 51/51 grün. Visuell geprüft mit rund 70 generierten Trainings über 12 Wochen im Dev-Server (der Seed läuft nur im Test-Browser, nie im Produktionscode).

## AP8 – Body Metrics ✅
**Implementiert**
- `domain/body.ts`:
  - `BUILTIN_METRICS`: weight, bodyFat, arm, chest, waist, thigh, restingHr, hrv, sleep
  - `parseMetric` (Schlaf als „7:30“ oder „7.5“), `formatMetric`, `ageFrom`, `latestWithChange` (Änderung gegenüber dem letzten Wert vor etwa 4 Wochen), `slugKey`
- `db/body.ts`:
  - Profil in `settings.bodyProfile` (Größe, Geburtsdatum, Geschlecht)
  - `saveBodyValues` mit Upsert: pro Wert und Tag nur ein Eintrag
  - eigene Messwerte in `bodyMetricDefs` (Schlüssel `c_<slug>`, ohne Duplikate)
  - `deleteBodyEntry`
- `screens/Body.tsx`:
  - Progress → „Body“: Gruppen Body / Measurements / Recovery mit letztem Wert und Änderung (neutral, ohne Bewertung)
  - Formular „Log Measurements“: Datum frei wählbar, nur ausgefüllte Werte werden gespeichert, ungültige Eingaben blockieren den Button
  - eigene Messwerte hinzufügen, Detailansicht `/progress/body/:key` mit Chart, Einträgen und Löschen (mit zweitem Tipp)
  - Profile → Abschnitt „Body“: Größe, Geburtsdatum (das Alter wird berechnet), Geschlecht
- `BackButton` nach `components/BackButton.tsx` verschoben (vorher zirkulärer Import Profile ↔ Body)
- Body funktioniert auch ohne geloggte Trainings

**Tests:** 60/60 grün. Ende-zu-Ende geprüft: Profil setzen, drei Messungen loggen, ungültige Schlafeingabe abgefangen, Detail-Chart

## AP9 – Cloud-Backup, Login, Export ✅
**Supabase**
- Projekt `trainings-log`, ref `grsxgrzbatvubvcsotyd`, Region eu-central-1, Organisation „Automatisierung“, Free Plan
- **Eine generische Tabelle** `public.records (user_id, table_name, id, data jsonb, updated_at bigint, deleted_at, server_ts)`, PK `(user_id, table_name, id)`
  - Begründung: Die Gerätedatenbank ist die Quelle der Wahrheit, die Cloud dient als Kopie und Sync. Ein JSONB-Spiegel braucht bei Schemaänderungen keine Migrationen.
- RLS: select, insert und update nur bei `user_id = auth.uid()`; kein delete, weil gelöschte Datensätze als Soft-Delete übertragen werden
- Trigger `records_touch` setzt bei jedem Update `server_ts`. RPC `push_records(jsonb)` macht einen Batch-Upsert; ein Datensatz wird nur ersetzt, wenn er strikt neuer ist (Last-Write-Wins).
- Per SQL geprüft (mit Rollback): ein veralteter Push wird ignoriert, Nutzer B sieht 0 Zeilen von Nutzer A. Der Security-Advisor meldet keine Probleme.
- **Manuell vom Nutzer erledigt (Dashboard):** E-Mail-Templates „Magic Link“ und „Confirm signup“ enthalten `{{ .Token }}` (Code statt Link)

**App**
- `sync/engine.ts` (testbar mit injiziertem Remote):
  - Push: alle lokalen Zeilen mit `updatedAt > lastPush`
  - Pull: alle Zeilen mit `server_ts > lastPull`, lokal nur übernommen, wenn sie neuer sind
  - Erste Synchronisierung eines Geräts: Hat das Konto schon Daten und das Gerät noch keine Trainings, wird der lokale Startplan verworfen. So entstehen auf dem MacBook keine Duplikate.
  - Synchronisierte Einstellungen nur `cycleAnchor` und `bodyProfile`; Timer, Seed-Flag und `sync.state` bleiben auf dem Gerät
- `sync/index.ts`: Sync startet nach lokalen Änderungen (Dexie-Hooks, 2,5 s Verzögerung), bei Fokus, bei `online` und alle 2 Minuten. Mutex, Status über `useSyncStatus`; Schreibvorgänge aus dem Pull lösen keinen neuen Push aus (`applyingRemote`).
- `sync/supabase.ts`: Client mit Publishable Key (öffentlich gedacht, Schutz über RLS), Login per OTP-Code (`signInWithOtp` → `verifyOtp` type `email`)
- `sync/backup.ts`: JSON-Backup (alle Tabellen) und Wiederherstellung (Merge, der neuere Datensatz gewinnt), CSV mit einer Zeile pro Satz. Auf dem iPhone über das Teilen-Menü, sonst als Download.
- `screens/Account.tsx` (Profile): Abschnitte Cloud backup (Login, Status, Sync Now, Sign Out) und Data (Export, Restore)

**Tests:** 67/67 grün, darunter Sync zwischen zwei Geräten mit Fake-Remote: Erstsync ohne Duplikate, Änderungen in beide Richtungen, Last-Write-Wins, Soft-Deletes, Filter für Einstellungen, nur geänderte Zeilen werden gepusht. JSON-Roundtrip und CSV getestet.
**Nicht testbar aus der Sandbox:** echter Netzwerkzugriff auf supabase.co (Proxy blockiert). Der Live-Login muss beim Nutzer verifiziert werden.

## Offen
- Live-Test von Login und Sync auf dem iPhone durch den Nutzer
- Die Stoppuhr zeigt „Last“ (letzter Wert), nicht den Bestwert
- Bundle 217 kB gzip (Supabase-Client); Code-Splitting wäre möglich, ist aber nicht nötig, weil alles vorab gecacht wird

## Deployment
GitHub `olivermyr/trainings-log` → Actions-Workflow (Tests, Build) → GitHub Pages: https://olivermyr.github.io/trainings-log/

## Nächster Schritt
**AP10 – Testing, Feinschliff, Abschluss**:
- systematischer Durchlauf aller Abläufe (iPhone- und Desktop-Viewport), Rückmeldungen des Nutzers aus echten Trainings einarbeiten
- Stoppuhr: Bestwert statt letztem Wert
- UX-Feinschliff, Barrierefreiheit (Fokus, Labels), Performance
- README für das Repo
