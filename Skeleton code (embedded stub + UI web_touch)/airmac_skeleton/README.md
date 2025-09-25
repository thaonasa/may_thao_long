
# AIR MAC SMART - Web-only Skeleton

This repository contains a minimal **server** (Node/Express) and **web UI** (HTML/CSS/JS) for AIR MAC SMART.

## How to run (dev)
1. Open a terminal in `server/`:
   ```bash
   npm install
   npm run dev
   ```
   Server starts at `http://localhost:8080`

2. Open `web/index.html` in your browser (via file:// or local static server).

> Note: the device/pressure is **simulated** in `/api/cases/:id/status`. Replace with real embedded I/O when wiring to hardware.

## Folders
- `server/` — Express API; in-memory store; scoring logic; basic safety behaviors.
- `web/` — Three screens: `patient.html`, `clinical.html`, `operate.html`.

## PlantUML
See `../airmac_state_diagram.puml` and `../airmac_sequence_diagram.puml`.

## Mockups (Figma-importable)
SVGs in `../mockup_*.svg` can be imported into Figma for detailed visual design.

---
Generated at: 2025-09-05T01:23:33.955600
