# 3D Print Modeler

A browser-based 3D printing modeler built with React, Vite, and Three.js.

## Features

- Add cube, sphere, cylinder, and 3D text objects.
- Move, rotate, and scale objects with TransformControls.
- Work in millimeters on a 3D printer build plate.
- Switch printer presets, including Bambu A1 mini and Bambu H2D.
- Multi-select, group, ungroup, merge, and duplicate objects.
- Mark objects as Solid or Hole.
- Apply boolean hole cutting with `three-bvh-csg`.
- Edit cube bevel radius and bevel segments.
- Export STL and OBJ.
- Save and load project JSON.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local Vite URL, usually:

```text
http://127.0.0.1:5173
```

## Repository

Use this GitHub repository URL when asking GPT/Codex to fetch the project:

```text
https://github.com/rock85159339-max/3D
```

If a tool asks specifically for a git clone URL, use:

```text
https://github.com/rock85159339-max/3D.git
```
