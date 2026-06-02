# BvL Gebrauchtmaschinen

Web-App zum Verwalten und Ansehen von BvL-Gebrauchtmaschinen.

- **Login mit Passwort** (keine offene Seite)
  - **Betrachter-Passwort:** kann alle Maschinen und Felder ansehen
  - **Admin-Passwort:** kann zusaetzlich Maschinen hinzufuegen, bearbeiten, loeschen
- Bilder + PDF werden hochgeladen und dauerhaft gespeichert (SQLite-Datenbank + Dateiordner unter `/data`)
- BvL Corporate Design mit Original-Logo

## Wichtige Environment-Variablen
| Variable | Bedeutung |
|---|---|
| `VIEWER_PASSWORD` | Passwort zum Ansehen |
| `ADMIN_PASSWORD` | Passwort fuer Aenderungen |
| `SESSION_SECRET` | Zufallszeichenkette zum Signieren der Logins |
| `DATA_DIR` | Datenverzeichnis (Standard `/data`) |
| `PORT` | Port (Standard 3000) |

## Wichtig fuer den Betrieb
Das Verzeichnis `/data` MUSS als persistentes Volume eingebunden werden,
sonst gehen Maschinen und Bilder bei jedem Neu-Deploy verloren.

Siehe **ANLEITUNG.md** fuer die Schritt-fuer-Schritt-Veroeffentlichung auf Hostinger + Coolify.
