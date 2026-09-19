# Third-party code and assets

Night Garden is a remix. The code written for it is MIT (see LICENSE), but it stands on
the work below, and one part of it, the iMoss shader, is licensed for non-commercial
use only. That makes the wallpaper as a whole non-commercial: use it, share it, change
it, but do not sell it or bundle it into something sold.

## Desktop Habitats — Chase Lean — MIT

<https://github.com/chaseleantj/desktop-habitats>

The wallpaper host (`wallpaper/Wallpaper.swift`, the installer and the way the app sits
behind the desktop icons, reads the cursor and throttles itself when covered or on
battery) is Chase Lean's, adapted to a new scene, name and bundle identifier. The scene
also reuses his frame loop and maths helpers (`src/frame-loop.js`, `src/math.js`) and two
Poly Haven textures he shipped with Riverscape. Night Garden started as a response to
his aquarium; without it there would be no garden.

## iMoss — Hieu Le — CC BY-NC 4.0

Source: <https://github.com/ledhieu/imoss> · <https://imoss.bio/> · <https://leduchieu.com/>

Licence: Creative Commons Attribution-NonCommercial 4.0 International, retained in full
at `scenes/night-garden/vendor/imoss/LICENSE`. The original vertex and fragment shaders
and `MossBall.svelte` are kept unchanged in `scenes/night-garden/vendor/imoss/src/`.

Changes: the vertex shader bends surface-distributed instances instead of a ball, with
flow-aligned tangents, world-scale strand geometry and GPU-only wind; the fragment
shading is new, adapted from iMoss's root/tip, wrap and Fresnel ideas to the scene's
cooler light. None of the original per-strand CPU simulation or supersampling pipeline
is used.

## Poly Haven — CC0

<https://polyhaven.com/license>

- Rock Moss Set 01, Kless Gyzen — <https://polyhaven.com/a/rock_moss_set_01>
- Fern 02, Rico Cilliers and Rob Tuytel — <https://polyhaven.com/a/fern_02>
- Moss 01, Rob Tuytel — <https://polyhaven.com/a/moss_01>
- Rock Boulder Dry (textures) — <https://polyhaven.com/a/rock_boulder_dry>
- Rough Wood (textures) — <https://polyhaven.com/a/rough_wood>

The three models are the 2K glTF exports with their PBR textures and separate alpha
masks, rearranged, scaled and relit; the two texture sets came by way of Riverscape.

## Three.js — MIT

Three.js r180, `vendor/three.module.js` and `vendor/three.core.js`, licence at
`vendor/THREE-LICENSE.txt`. GLTFLoader and BufferGeometryUtils from the r180 examples in
`scenes/night-garden/vendor/three-addons/`.

## Generated images

The distant forest plate, the moss colour texture and the two moth sprite sets in
`scenes/night-garden/assets/` were generated for this project with an image model and
are published under the repository's MIT licence. The prompts are recorded in
`scenes/night-garden/ASSET-PROMPTS.md`.
