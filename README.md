# Digitaler Raum – Idylle

Diese Version enthält die statische erste Szene der Installation: eine friedliche Idylle aus warmem Mineral, organischer Architektur, weicher Landschaft, Vegetation und ruhigen Wasserflächen. Sie enthält ausdrücklich noch keine Tunnelreise, keinen Sog, keinen White Room, keinen Ton und keine Videos.

## Struktur

```text
index.html                     Einstiegspunkt, Babylon.js-CDN und Canvas
style.css                      Vollbild-Canvas und zurückhaltende Laufzeitsteuerung
main.js                        Startet Engine, Idylle, Resize und WebXR
assets/
  models/                      Lokale 1K-glTF-Felsen und Vegetation
  textures/                    Lokale CC0-PBR-Texturen für Boden und Architektur
  hdr/                         Lokales Golden-Hour-HDR für PBR-Beleuchtung
  audio/                       Platz für spätere Audiodateien
  videos/                      Platz für spätere Videodateien
scripts/
  core/                        Engine, Idylle-Szene und WebXR-Initialisierung
  camera/                      Stehende Desktop-Kamera (nur Umschauen)
  environment/                 360°-Terrain, 3D-Architektur, Wasser, Vegetation und Materialien
  tunnel/                      Bewusst noch ohne Journey-Logik
  lighting/                    Golden-Hour-Licht und statische Schatten
  audio/                       Bewusst noch leer
  video/                       Bewusst noch leer
  utils/                       Kleine DOM-Helfer
```

Die verwendeten Fremdassets und ihre Lizenzen sind in `ASSET_CREDITS.md` dokumentiert.

## Lokaler Test

Die Dateien müssen über einen lokalen Webserver bereitgestellt werden, da JavaScript-Module nicht zuverlässig über `file://` funktionieren. Ohne Node.js kann im Projektordner zum Beispiel Folgendes verwendet werden:

```bash
python3 -m http.server 8080
```

Danach `http://localhost:8080` im Browser öffnen. Mit der Maus lässt sich die Idylle auf dem Desktop ansehen; die Position bleibt absichtlich fixiert. WebXR benötigt zusätzlich einen kompatiblen Browser und ein kompatibles Headset.

## Manuell auf GitHub Pages veröffentlichen

1. Ein GitHub-Repository im Browser anlegen oder öffnen.
2. Den vollständigen Inhalt dieses Projektordners in die Wurzel des Repositories hochladen; die Ordnerstruktur unverändert lassen.
3. In den Repository-Einstellungen unter **Pages** die Bereitstellung von dem gewünschten Branch und dem Ordner **/(root)** aktivieren.
4. Die von GitHub Pages bereitgestellte HTTPS-Adresse auf dem Meta Quest im Meta Quest Browser öffnen.

## WebXR-Hinweise

- Immersives WebXR funktioniert nur in einem sicheren Kontext: HTTPS oder `localhost`. GitHub Pages erfüllt die HTTPS-Voraussetzung.
- Der Button **VR betreten** erscheint nur, wenn der Browser `immersive-vr` unterstützt. Auf nicht kompatiblen Desktop-Browsern bleibt die Idylle trotzdem nutzbar.
- Die primäre VR-Session verwendet `local-floor`, damit die physisch getrackte Augenhöhe des Headsets über dem Boden verwendet wird. Falls ein Browser diesen Referenzraum nicht anbietet, erfolgt ein sicherer Fallback auf `local`.
- Ein normaler Desktop-Browser kann eine immersive Quest-Session nicht vollständig simulieren. Den finalen VR-Einstieg daher auf Quest 2 oder Quest 3 über die veröffentlichte HTTPS-Seite testen.

## Aktueller Umfang

Die Idylle ist vollständig räumlich aufgebaut. Unter dem Besuchenden liegt ein verformtes Terrain auf natürlicher Stehhöhe mit lokalen PBR-Bodenmaps, gescannten glTF-Felsen, Farnen, Moos, Gras und Sträuchern. Ein unregelmäßiger Landschaftsring setzt das Gelände in allen Blickrichtungen fort und verdeckt seine technische Außenkante.

Die Vegetation verwendet wenige, mehrfach platzierte lokale glTF-Assets mit variierter Größe und Ausrichtung. Dadurch entstehen Vordergrund, Mittelgrund und Fernraum mit echter Tiefenstaffelung und Parallaxe. Rechts vom Startpunkt liegt ein tatsächlicher, vertiefter Tunneleingang aus einer dicken, unregelmäßigen Mineralfassade und einem modellierten Innenraum. Er bleibt ruhig und statisch; es gibt keine Tunnelreise.

Die Moodboard-Bilder sind ausschließlich Art Direction und sind nicht als Bild, Hintergrund, Panorama, Skybox, Ebene oder Projektion im Projekt enthalten. Die offene Himmelsfarbe ist ein im Code erzeugter Farbverlauf, keine Bilddatei.

Das lokale HDR wird nur für Licht und PBR-Reflexionen verwendet; die sichtbare Himmelsfläche bleibt ein im Code erzeugter Verlauf. Die Wasserflächen nutzen eine kleine Babylon-WaterMaterial-Reflexion mit einer 256px Render-Textur. Aufwendige volumetrische Effekte und Post-Processing bleiben zugunsten von Quest-2/3-tauglicher Laufzeit ausgeschlossen.
