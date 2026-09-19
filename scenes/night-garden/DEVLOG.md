## Mushroom placement revision

Unequal, hand-placed colonies (3 / 1 / 2 / 2) replace repeated four-mushroom
clusters. Separate x/z offsets, height/radius, cap fullness and growth direction.
Roots still raycast against actual supporting rocks. A larger low-contrast
mushroom on the near rock lip receives depth blur; a tiny solitary mushroom sits
on a distant bank. Two local lights remain on the middle-ground focal colonies.
Browser inspected at the current viewport; no console errors.

## Receding water, warm moss, antialiasing

The striped screen-facing water card is replaced by `src/forest-water.js`: a
narrowing curved stream on the inclined stage floor spanning 26 world units in
depth. Animated multiscale noise drives surface normals and weak irregular
highlights. The environment plate supplies approximate reflection color; this
is not a live planar reflection of foreground geometry. One water draw, no
reflection pass, ray tracing, or fluid simulation.

Moss blades are under half the previous height, with a larger sampling budget,
56 smaller model patches, and olive root/tip variation. The iMoss bending shader
now feeds MeshStandardMaterial and receives actual scene shadows instead of
using its own bright rim light. Hemisphere/key/rim reduced and warmed. Added
cropped close rock edges and small distant banks. HDR scene target uses 4x MSAA;
foliage masks use alpha-to-coverage. Existing depth blur stays active.

Verified in the in-app browser at its current viewport: no console errors,
59 fps / 1.12M triangles / 197 draws in the displayed two-second runtime sample.
This is a short preview measurement, not a sustained power or battery benchmark.
Add `&stats=1` to the scene URL to show the diagnostic counter.

## Composition and motion revision

23 fern groups now make an asymmetric tall left frame and lower right frame,
with dark distant foliage, sharp middle plants and blurred close foreground.
Mushroom clusters raycast onto actual rocks; curved stems and four rounded cap
profiles replace the screen-positioned cones. Local mushroom light is restrained.
The original Claude scene stays unchanged. This scene uses its own moth behavior
copy: slower flight and flaps, rare heading flicks, one airborne moth, frequent
resting wing fans and smooth heading/position presentation. Unlit wing materials
avoid light intensity pulsing as the textured planes rotate.

Validation: syntax check, actual browser render without console errors, and
`node scenes/night-garden/tests/moth-calm.mjs` (300 simulated seconds: all three
moths fly and fan, land successfully, never more than one airborne).

## Asset garden revision — 2026-09-18

Entry: `index.html` / `src/main.js` → async `src/garden-assets.js`.
Real CC0 Poly Haven rocks, fern clusters and moss patches now replace the generated
bank and leaf assembly. iMoss vertex shader distributes clumped strands on stone
surfaces. A depth texture limits 16-tap blur to near-camera leaves. Cooler rim light,
warmer mushroom lights, an animated pool and the original distant forest plate.
See THIRD-PARTY.md before sharing: this version includes CC BY-NC 4.0 material.

Verified in the actual in-app browser: alpha-cut foliage, textured rocks, moss,
visible background, water, and no console errors. This is a real asset scene, but
its lighting/composition are not claimed to match the approved concept exactly.
No sustained GPU/power benchmark yet. The earlier procedural garden remains in
src/garden.js and the archive; its geometry tests cover that old implementation.

# Night Garden — Composition v3

Preview: http://localhost:8080/scenes/night-garden/?v=composition-v3

**Visual comparison is now available.** On 2026-09-18 browser access recovered. Composition v3 and the new moss carpet were inspected in the live browser at the user's viewport. The first shell shader compilation error (reserved GLSL identifier) was fixed, the scene reloaded successfully, and two color iterations were compared in screenshots. Coverage is visibly denser. This is still not a match to the approved concept: overall lighting, rock shapes, vegetation and moss clump structure need further art direction. No measured GPU/battery performance or native-wallpaper acceptance.

Claude's `../night-garden/` and the original aquarium `../riverscape/` remain unchanged. Prior studies are preserved in `archive/`. The native host has not been installed or switched.

## Composition

The target is `assets/approved-reference.png`: a deep teal-black distant forest, open dark middle, large wet leaves framing the edges, a diagonal branch descending from the left, low moss-covered rocks and small warm mushrooms.

`composition.js` registers branch points, six rock bounds, twelve large leaves, fern groups, mushrooms and the bank profile in the reference's 1586 × 992 image coordinates. An orthographic camera applies the same cover crop as the background and comparison image. Depth remains available for lighting, surface shape and occlusion; it does not change the registered projection.

**Overlay reference** superimposes the exact approved image over the running scene. Use the opacity slider to compare alignment. This image is a reference, not a screenshot of the render. **Aquarium** opens the unchanged original.

## Geometry and materials

Only the distant forest is a generated background plate. Rocks, wood, curved leaves/petioles, fern pinnae, moss shoots and mushrooms are geometry. Moths use Claude's textured body plane and hinged wing planes, with his flight/rest/landing animation.

- `surfaces.js`: rock cutting planes, pits/strata and cracked branch geometry adapted from Chase Lean's MIT source.
- `leaf-anatomy.js`: original anatomical leaf surfaces and stems, registered to the new composition. Original underwater lighting is not used.
- `materials.js`: existing CC0 Poly Haven rock/bark maps, wet leaf coating and vein shading. The generated moss color map is mixed at three different rotations/scales/offsets through a coherent noise mask to reduce obvious repetition. Actual seams and repetition still require visual inspection.
- `moss.js`: triangle-area-weighted surface sampling, orientation/noise coverage, eight geometry shells forming a connected carpet, and six branching shoot variants. Shells use root-position noise to thin outward, with darker roots and lighter tips. White base material avoids multiplying already-colored instances by another dark tint. This is a procedural distribution mask, not baked ambient occlusion or a physically simulated growth system.
- `garden.js`: registered banks/rocks/log, merged foliage, instanced moss and modeled mushroom stems/caps/undersides. No dew beads in this revision.
- `moths.js`: adapter around Claude's original flock. Preserves textured wing halves and landing/takeoff timing; adds pointer attraction and startle. No volumetric moth body or wing motion blur in this revision.
- `lens.js`: HDR scene target, quarter-resolution glow blur and vignette. No full-scene temporal trails or depth of field.
- `main.js`: moonlight, rim/fill and mushroom lights, 44 fireflies, pointer interaction and power-aware frame loop.

Moss research: Adobe's [Moss filter documentation](https://experienceleague.adobe.com/en/docs/substance-3d-sampler/using/filters/wear-and-finish/moss) describes masks, orientation, clump size and fine detail as separate controls. This scene applies that separation using its own procedural masks; it does not include Substance output or a baked crevice map.

Static scenery's shadow map renders once. Small leaf wind and moth motion do not update shadows. DPR is capped at 1.0 on battery, 1.5 otherwise. These choices have not been validated with measured frame or battery timings.

## Checks

From the repository root:

```
npm run check
node --experimental-loader ./scenes/riverscape/tests/three-loader.mjs scenes/night-garden/tests/composition.mjs
node --experimental-loader ./scenes/riverscape/tests/three-loader.mjs scenes/night-garden/tests/garden.mjs
node scenes/night-garden/tests/moths.mjs
```

Checks cover syntax; projection at four viewport ratios; bank endpoints; area-weighted moss sampling; finite geometry, valid indices/bounds and construction budgets; moth state updates. Current construction: 50 mesh objects, approximately 1,323,662 submitted geometry triangles before shadows/postprocessing, 60,942 foliage vertices and 18,078 moss instances. These are CPU construction checks, not WebGL render tests or performance measurements. The older `tests/flight.mjs` covers the superseded flight system, not this version.

## Required visual follow-up

1. Open Composition v3 and compare the exact crop at several overlay opacities. Inspect branch and leaf silhouettes, bank height and open background.
2. Check moss scale/density/repetition, wet highlights, mushroom ground contact, moth alpha edges and light balance in an actual screenshot.
3. Verify slow attraction, rapid escape, pause, resize, hidden/resume, overlay controls and context restoration in the browser.
4. Measure frame times/GPU cost at the user's screen size and tune density or resolution if needed.
5. Install the native wallpaper only after visual acceptance and an explicit request.

## Assets and provenance

Generated-image prompts are retained in `ASSET-PROMPTS.md`. Assets are copied into this scene, not referenced from temporary generated-image storage.

- `assets/distant-forest.png`: background-only reconstruction from the approved concept.
- `assets/moss-color.png`: generated moss surface color; seamless tiling was requested but not visually verified.
- `assets/approved-reference.png`: approved concept, comparison only.
- Rock/bark maps: reused from `../riverscape/assets/` (Poly Haven CC0; upstream credit retained).
- Moth alpha textures: reused from `../night-garden/assets/`.

Original project: https://github.com/chaseleantj/desktop-habitats — Copyright 2026 Chase Lean, MIT. Preserve the repository LICENSE and bundled Three.js/asset notices when publishing a remix.

## Moss carpet revision

Previous moss/material source is retained in `archive/moss-v3/`. New connected coverage replaces the sparse colony cutoff. The shell carpet gives the bank, rocks and branch a continuous foundation; geometric shoots sit above it. Rock roughness was increased and clearcoat reduced to remove the most metallic highlights.

Primary technique references (ideas only; no external code/assets copied):
- https://claudegosselin.artstation.com/projects/x3oLQ2 — AC Shadows artist breakdown: consistent carpet across ground/props, soft transitions and underlying material blend.
- https://pedro876.github.io/Articles/ShellTexturing.html — layered geometry, height clipping, root darkening and overdraw limitations.

Eight shells add fragment overdraw. CPU triangle count increased about 6% after simplifying individual shoots, but that does not measure fragment cost. First shader error remains in the browser's historical console log; no additional compilation error appeared after correcting the identifier and reloading.


## Current asset garden — dense wind revision (2026-09-18)

This supersedes the earlier procedural Composition v3 implementation notes above.
The active stage is `garden-assets.js`: licensed Poly Haven rock, fern and moss
models, iMoss-derived surface fibers, and the original textured moth wings.

- Denser, shorter moss: sampling budget 95,000 per selected rock, 92 model patches,
  plus continuous warm moss coloring underneath the fibers. Rock texture detail
  remains visible through the underlying material blend.
- `forest-wind.js` bends fern tips on the GPU with anchored roots; moss uses the
  same time source and a slow, small-amplitude breeze. Shadow maps remain static.
- Water is a low, shallow projected strip between the banks, narrowing toward the
  distant treeline. Its color reflection is an approximation, not a second scene
  render or a physical fluid simulation.
- Foreground mushrooms form an unequal trio, one broad cap and two slender stems
  with small caps, subtle warm emission, and depth-based blur.
- Moth wings now use lit rough materials and receive scene shadows. Fireflies
  reduced from 44 to 26, with smaller, dimmer green-gold sprites.
- The active lens includes 4x MSAA, depth-based foreground blur and gentle bloom.

Validation: syntax check passed; browser screenshots at 1524 x 987 showed no
console errors, denser moss, low water and lit moths. Visible two-second FPS
samples were 58–60 with approximately 1.79M triangles and 211–212 draws. This is
not a sustained battery or GPU-time benchmark. Earlier geometry-test counts in
this document refer to the retired procedural stage, not this asset stage.

## Living shore revision (2026-09-18)

- Fern bending uses distance from the root, including horizontal frond tips,
  instead of only local vertex height. Visible tip travel is stronger and slow.
- Every mushroom part shares a root-anchored quadratic bend, so the cap and stem
  stay connected while moving. Normals and static shadow maps are not deformed.
- Nine tapered, curved long-moss tufts move in the shared gust field. Twenty-three
  small reused rock chips and four fallen branch segments dress the banks.
- The center foreground stone moved right/up; the lower support moved left to
  leave an open water channel. The right foreground lip is slightly higher.
- Water now extends from z=14 to -26, with displaced geometry and analytic wave
  normals. A 640-pixel-wide mirrored scene render supplies actual planar object
  reflections at 10 Hz. Water motion itself renders every frame. Fine iMoss fibers
  and firefly sprites are excluded from the reflection pass; modeled foliage and
  rocks remain. The flat background illustration is replaced with a dim sky color
  in reflections, avoiding a second screen-space moon. This is a realtime surface
  approximation, not fluid dynamics or ray-traced refraction. The plane is shallowly
  inclined in the existing front-facing orthographic composition coordinates.

Validation: syntax check passed; browser loaded without shader errors. A settled
short FPS sample showed 58 fps at the existing viewport; reflection frames perform
an extra scene pass. Battery life has not been measured.

## Mirrored pool, mossy near rock, living details (2026-09-18, Claude)

Astra's versions of the six files touched first are in `archive/living-shore/`.

- Water (`src/forest-water.js`) is again a single screen-facing band, now behind
  the middle rocks at z −12 with its far edge at the reference waterline. Because
  the stage camera is orthographic and looks straight along −z, a real horizontal
  plane is edge-on, so horizontality comes from the cues instead: the previous
  frame mirrored vertically about the waterline (exact for an orthographic front
  view), ripples that compress toward the far shore, reflectivity that drops toward
  the viewer. The reflection texture is `lens.history`, a half-resolution copy of
  the finished HDR frame, so the extra mirrored scene pass and its draw-call spikes
  are gone. Ripples are fine and slow; the reflection barely moves.
- Pebbles: 16 clusters and 22 single stones (procedural `rockGeometry`, merged
  into one mesh with `materials.stone`) sit on the upward faces of the mid rocks.
- The near-left rock rose to y −4.4 and the reference's own bottom-left rock
  (`ROCKS[0]`) became a mossy mound: `mossUndercoat(mesh, vivid)` and per-rock
  `[mesh, vivid, samples]` entries for iMoss fibres make their coats brighter,
  greener and more complete (170 k / 160 k fibre samples, taller strands), with
  28 greener model patches on the near rock. A camera-side fill (0.8) and a spot
  aimed at that corner light it. Near depth blur starts closer to the camera
  (depth .143–.172), so the near rock and its mushrooms are nearly sharp while the
  corner ferns, moved to z 8.6–8.8, stay soft.
- Foreground mushrooms are a four-stem clump rising from one spot and fanning
  outward; stems arc smoothly instead of an S-bend.
- Fern sway rate follows plant width (big fronds slow, small ones quicker); moss
  model patches move in the same field at 35 % travel; iMoss fibre wind is now
  visible (amplitude .012).
- Four moths, sizes 52/44/40/34, four perches on the log; the second wears the
  sage skin cut from `assets/moth-sage.png` into `assets/moth-sage-{body,wing-left,
  wing-right}.png` (soft body polygon, premultiplied downscale, straight alpha).

Verified in the in-app browser (2298×1752 canvas, DPR 1.5): no shader failures,
no console errors, 60 fps in a short sample, 2.53 M triangles, 263 draws,
515 702 moss instances. A two-frame difference 2.5 s apart changes 25 % of the
fern pixels top-left, 24 % on the mossy mound and 10 % on the water band, so the
foliage and moss move and the pool stays calm. Region luminance against the
cover-fitted reference is still lower in the middle band (mid-left 9.5 vs 28.6);
the bottom third is at 16–21 vs 25–31. Not measured: power and battery.

## Depth pass: lantern, deep moths and fireflies, waxy caps (2026-09-18, Claude)

- `src/stone-lantern.js`: a six-sided kasuga-style stone lantern from primitives
  (short pillar, open fire box, hexagonal roof), unlit, on its own rock at the far
  right shore (x 3.9, z −6.5), so the pool mirrors it. Six fireflies live around
  it and one warm point light follows their centroid, so they visibly light it.
- Fireflies: 64, seventy percent far (z −4 to −32), scaled and dimmed by a
  pseudo-perspective factor because the camera is orthographic. The pointer draws
  only the curious ones, slowly and unevenly (per-firefly curiosity and interest),
  each on its own looping path, so no ring forms; a live probe showed 6 of 64
  following after 15 s of a slow pointer over the pool.
- Moths: while cruising, a moth may drift 2–9 units back toward the pool and
  return; scale follows the same pseudo-perspective, so it shrinks into the dark
  and the pool reflects it faintly. Any landing state brings it back to the branch.
- Mushroom caps use MeshPhysicalMaterial with clearcoat and a waxy inner glow
  (`waxyGlow`: strongest at the centre and underside, fading to the rim). The lone
  mushrooms on the centre-left and right rocks got two small companions each.
- Fluffy iMoss fibres now also cover the five centre rocks (135 k samples each,
  vivid 1.35) and the fallen log (70 k); the grass tuft sits in its rock.
- Water ripples are twice as fine; glints are smaller points. The near-rock spot
  is a touch yellower.

Verified in the in-app browser (2167×1752 canvas): no shader failures, no console
errors, 57 fps in a short sample, 3.07 M triangles, 310 draws, 650 217 moss
instances. The debug hook `habitatStats()` now also reports pointer state, firefly
following/near counts and moth depth.

## Installed as the desktop wallpaper (2026-09-18, Claude)

`upstream-desktop-habitats/wallpaper-night-garden/` is a third install variant beside
`wallpaper/` (aquarium) and `wallpaper-night-garden/` (2.5D scene). It is the same app
name, bundle id and launch label as the 2.5D variant (`Night Garden.app`,
`com.zheke.night-garden`), so the two replace each other and either `uninstall.sh` removes
whichever is installed; Desktop Habitats' own app is never touched. Its `Wallpaper.swift`
differs from the 2.5D one only in the scene page (`/scenes/night-garden/wallpaper.html`)
and a null-safe `covered` probe, because this scene removes `#loading` once it starts.

Because this scene imports code and textures from its siblings, the bundle carries
`scenes/night-garden` (tests and archive stripped), `scenes/night-garden/{src,assets}`,
`scenes/riverscape/{src,assets}` and `vendor`: 28 MB in all.

```sh
sh upstream-desktop-habitats/wallpaper-night-garden/install.sh    # build, install, start, login item
sh upstream-desktop-habitats/wallpaper-night-garden/uninstall.sh  # stop and remove
```

First install on the 5120×2880 display: canvas 3840×2160 (DPR cap 1.5), WebGL2 up, no
failures, the agent asks for 60 fps on AC. The `THREE.FileLoader: HTTP Status 0 received`
lines in `/tmp/night-garden.log` are three.js warning about the custom URL scheme
returning no HTTP status; the six glTF/bin loads succeed. Still picture written to
`~/Pictures/Night Garden.png`.

Load on the installed app (M5 Pro, 5120×2880, AC power, 60 fps, no browser preview open;
`ioreg` IOAccelerator counters sampled every 2 s, no sudo): GPU device utilization
69–73 % mean, 81 % peak, against a 6 % idle baseline with the agent stopped. CPU: the
WebKit content and GPU helper processes each hold 22–28 % of one core, the agent itself
3 %. Memory: about 1.4 GB in each helper. Battery drain could not be measured on AC;
`sudo powermetrics --samplers gpu_power,cpu_power -i 5000 -n 6` gives watts. At this load
the scene is a heavy wallpaper; the 30 fps battery rate and a lower DPR cap are the
obvious levers.

## Placement editor and tuning.json (2026-09-19, Claude)

Open the preview with `?edit=1` (for example
http://localhost:8080/scenes/night-garden/?edit=1&stats=1) and a panel appears on the
right. Click a rock, fern, the log, the lantern or a mushroom to select it; drag to move
it across the picture, shift-drag to move it in depth, alt-drag to turn it, arrow keys
nudge (PageUp/PageDown for depth). Lights show as markers: a ring at the source, a square
where a spot or directional light aims, both draggable. The panel edits the same values
as sliders, plus each light's intensity, colour, colour temperature (Kelvin), ground
colour for the hemisphere light, cone angle, penumbra, distance and decay, and the frame's
exposure, background level and fog. Every object has a "back to code" button.

Changes are kept in the browser's localStorage and apply on every preview load. The JSON
in the panel is the whole set; "Download tuning.json" saves it. Placed as
`scenes/night-garden/tuning.json` it is read at startup by the preview and by the
installed wallpaper (the installer copies the scene folder whole), so a reinstall bakes
the tweaks in. Rocks are registered as `rock-0…6`, `shore-rock-0…6`,
`depth-rock-0…4`, `lantern-rock`; ferns `fern-0…22`; `log`, `lantern`; mushrooms
`mushroom-<colony>-<index>`; lights `hemisphere`, `moon`, `rim`, `fill`,
`near-rock-spot`, `warm-spot`, `lantern-glow`, `mushroom-glow-<colony>`.

Limits: moss fibres and moss patches are baked onto rock surfaces at build time, so after
a rock moves its moss follows only after a reload (the panel has a button for that).
Mushrooms are placed on their rock at build time too and follow after a reload. The
lantern glow's intensity is driven by the fireflies, so only its colour and radius are
editable. The editor is loaded only in the preview (`src/tuning-editor.js`, on demand);
the wallpaper page never loads it, it only reads `tuning.json` through `src/tuning.js`.

Also in this pass: every moth cruise is now an excursion 8–15 units back over the pool
with a stronger shrink (focal length 8), the lantern glow from fireflies is a faint
flicker (0.12 per firefly, 0.55 at most), and six out-of-focus fireflies drift in front of
the near rocks as soft bokeh discs.

### Moss controls in the editor (2026-09-19, Claude)

Two ways to take moss off, both stored under `moss` in the same tuning record
(localStorage while editing, `tuning.json` when shipped):

- **Per object.** Select a rock, shore rock, the log or the near left rock and the object
  section shows *ворс мха* (fibre density 0–1), *подшёрсток* (the green undercoat shader,
  0–1) and *кустики мха* (the `moss_01` patches on/off), plus "Убрать мох совсем" /
  "Вернуть мох". Stored as `moss.objects[id] = {fibers, coat, patches}`; defaults are
  not written.
- **Eraser.** Section *Мох*: toggle "Ластик" (hotkey `E`), set the radius, then drag
  across a rock. Every pointer step adds a world-space sphere `[x, y, z, r]` to
  `moss.erase`; fibres, patches and undercoat inside it disappear immediately. "Отменить
  штрих" removes the last stroke, "Вернуть стёртый мох" clears the list.

- **Deleting objects.** Any registered object (rock, fern, mushroom, log, lantern) has
  "Удалить из сцены" (or the Delete key). It is stored as `objects[id].hidden = true`, so
  the object only becomes invisible and can be restored from the "Удалено:" list under
  the object picker or with "Вернуть в сцену". Hiding a rock hides its fibres, patches
  and undercoat; hiding a mushroom hides its glow light (`userData.ownerId` on the light).

How it is applied (`src/tuning.js`): fibres carry an owner index and a random key per
instance; `fiberMask()` hides an instance when its key is above the owner's density or
it lies inside any erase sphere. In the editor (`setEditing(true)` from `?edit=1`) every
fibre is generated and the mask goes into an `aErase` instanced attribute that collapses
the blade in the vertex shader, so painting is live and cheap (only the touched index
range is re-uploaded). In the wallpaper the mask is applied before the geometry is
built, so erased fibres cost nothing. The undercoat shader gets `mossAmount` per mesh
and the newest 64 erase spheres as a uniform array (`ERASE_MAX`); the fibres and patches
honour the full list. Patches are hidden when their anchor point is inside a sphere.

Verified in the preview: erasing and stripping a rock update the frame at once without
shader errors; loading the same record without `?edit=1` produced 587 264 fibre instances
instead of 648 949 and no `aErase` attribute. This is also the intended path for the
load reduction discussed above: thin or strip the rocks that matter least, save
`tuning.json`, reinstall.
