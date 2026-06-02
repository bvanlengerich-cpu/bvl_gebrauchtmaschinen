# Veröffentlichen auf bvlki.cloud — Schritt für Schritt

Ziel: Die App läuft öffentlich erreichbar unter **https://bvlki.cloud**, mit Login,
Upload und dauerhafter Speicherung. Weg: GitHub → Coolify (du brauchst keine Kommandozeile).

---

## Teil A — Code auf GitHub hochladen (per Browser, ohne Git-Befehle)

1. Auf **github.com** anmelden.
2. Oben rechts auf **+** → **New repository**.
3. Repository-Name z. B. `bvlki-gebrauchtmaschinen`.
   - Sichtbarkeit: **Private** (empfohlen) ist in Ordnung — Coolify kann auch private Repos.
     Wenn es einfacher sein soll, geht auch **Public**.
   - Nichts ankreuzen (kein README), dann **Create repository**.
4. Auf der nächsten Seite: **„uploading an existing file"** anklicken.
5. **Alle Dateien aus dem Projektordner** (siehe unten) per Drag & Drop ins Browserfenster ziehen.
   Wichtig: Die Ordner `node_modules` und `data` NICHT hochladen (die sind gar nicht erst dabei).
6. Unten auf **Commit changes** klicken. Fertig — der Code liegt jetzt auf GitHub.

Diese Dateien/Ordner gehören ins Repository:
```
server.js
package.json
package-lock.json
Dockerfile
docker-compose.yml
.dockerignore
.gitignore
.env.example
README.md
ANLEITUNG.md
public/   (kompletter Ordner: index.html, app.js, styles.css, logo-bvl.svg)
```

---

## Teil B — In Coolify deployen

1. Coolify öffnen (`http://187.124.175.211:3000`) und anmelden.
2. Links **Projects** → dein Projekt öffnen (oder **+ Add** → neues Projekt anlegen) →
   **+ New** → **Application**.
3. Quelle wählen:
   - **Public Repository:** Repo-URL einfügen (z. B. `https://github.com/DEINNAME/bvlki-gebrauchtmaschinen`).
   - **Private Repository:** einmalig **GitHub App** in Coolify verbinden („Sources" → GitHub),
     danach das Repo aus der Liste wählen.
4. **Build Pack** auf **Dockerfile** stellen (Coolify erkennt das Dockerfile meist automatisch).
   Port bleibt **3000**.

### B1 — Passwörter setzen (Environment Variables)
Im Reiter **Environment Variables** drei Einträge anlegen:

| Name | Wert |
|---|---|
| `VIEWER_PASSWORD` | dein Betrachter-Passwort (z. B. `bvl-ansehen`) |
| `ADMIN_PASSWORD` | dein Admin-Passwort (anders & sicher!) |
| `SESSION_SECRET` | eine lange Zufallszeichenkette (einfach Tasten wild drücken, 30+ Zeichen) |

### B2 — Dauerhaften Speicher einrichten (SEHR WICHTIG)
Im Reiter **Storages / Persistent Storage**:
- **+ Add** → **Volume Mount**
- Name: `bvl-data`
- **Destination Path im Container: `/data`**

> Ohne diesen Schritt werden bei jedem Neu-Deploy ALLE Maschinen und Bilder gelöscht.
> Mit dem Volume bleiben sie dauerhaft erhalten.

### B3 — Domain eintragen
Im Reiter **Domains** (oder „General" → Domain):
- `https://bvlki.cloud` eintragen (und optional zusätzlich `https://www.bvlki.cloud`).
- Coolify holt automatisch ein SSL-Zertifikat (https). Das kann beim ersten Mal 1–2 Minuten dauern.

### B4 — Starten
- Oben rechts auf **Deploy** klicken.
- Beim ersten Mal dauert der Build ein paar Minuten (das native Modul wird kompiliert).
- Danach ist die Seite unter **https://bvlki.cloud** erreichbar.

---

## Teil C — Erster Test
1. `https://bvlki.cloud` öffnen → es erscheint die Passwortabfrage.
2. Mit dem **Admin-Passwort** anmelden → oben erscheint „Administration" mit dem Button
   **+ Neue Maschine hinzufügen**.
3. Eine Maschine mit Bildern (und optional PDF) anlegen und speichern.
4. Abmelden, mit dem **Betrachter-Passwort** anmelden → die Maschine ist sichtbar,
   aber es gibt keine Bearbeiten/Löschen-Buttons. So soll es sein.

---

## Passwörter später ändern
In Coolify die Environment Variable ändern und erneut **Deploy** klicken.
Die gespeicherten Maschinen bleiben dabei erhalten (liegen im `/data`-Volume).

## Updates am Code
Neue Datei-Version auf GitHub hochladen (oder Datei dort direkt bearbeiten) →
in Coolify **Deploy** klicken. Bei aktivem Auto-Deploy genügt das Hochladen auf GitHub.

## Sicherheits-Hinweis
Die Passwörter stehen NICHT im Code, sondern nur in den Coolify-Environment-Variablen.
Bitte ein starkes Admin-Passwort wählen, da Admins Daten löschen können.
