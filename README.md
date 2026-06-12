# 3D Print Modeler

A React + Vite + Three.js 3D printing modeler. It can run as a browser app and now also has a Tauri Windows desktop shell.

## Features

- Add cube, sphere, cylinder, torus, cone, and 3D text objects.
- Move, rotate, and scale objects with TransformControls.
- Work in millimeters on a 3D printer build plate.
- Switch printer presets, including Bambu A1 mini and Bambu H2D.
- Multi-select, group, ungroup, merge, duplicate, and mark Solid / Hole objects.
- Apply boolean hole cutting with `three-bvh-csg`.
- Face, edge, vertex, sculpt, print prep, repair, and export workflows.
- Export STL and OBJ.
- Save and load project JSON.
- Desktop builds use Tauri system file dialogs for JSON / STL / OBJ save and open.

## Web Development

```bash
npm install
npm run dev
```

Then open the local Vite URL, usually:

```text
http://127.0.0.1:5173
```

## Desktop Development

```bash
npm install
npm run tauri:dev
```

## Desktop Build

```bash
npm run tauri:build
```

Desktop build notes:

- Tauri requires Rust. Install it from https://rustup.rs/
- Windows requires Microsoft Edge WebView2 Runtime.
- The first desktop build can take longer because Rust dependencies are compiled.

## Repository

Use this GitHub repository URL when asking GPT/Codex to fetch the project:

```text
https://github.com/rock85159339-max/3D
```

If a tool asks specifically for a git clone URL, use:

```text
https://github.com/rock85159339-max/3D.git
```
