# Formwork

A parametric 3D model customizer, in the spirit of MakerWorld/Thingiverse "Customizer" apps.
Start from a base mathematical shape, add and remove components to build it up, tune
whatever you've added in a live 3D preview, and export a print-ready STL for Bambu
Studio (or any slicer).

## What's here (Phase 1 — parametric customizer)

### Base shape → components → customize

Rather than picking one of a fixed list of finished, differently-named shapes, you pick
one of five **base mathematical forms** ([src/components/ShapeGallery.tsx](src/components/ShapeGallery.tsx)),
each of which starts in its plainest possible state (a bare cylinder, a plain sphere)
and exposes a set of **components** you add and remove yourself
([src/components/ParamPanel.tsx](src/components/ParamPanel.tsx), `ComponentGroup` in
[src/engine/types.ts](src/engine/types.ts)) — each one an "+ Add X" toggle that, once
active, reveals its own sliders and can be individually removed again, so the shape is
genuinely built up rather than chosen whole:

- **Revolve** ([src/engine/revolveShell.ts](src/engine/revolveShell.ts) +
  [src/shapes/revolveShapes.ts](src/shapes/revolveShapes.ts)) — a 2D profile spun around
  an axis: the mathematical base behind vases, lamp shades/bases, bowls, pots, and cups.
  Components: **Profile Curve** (bulge/cinch, or a hand-drawn/uploaded custom silhouette
  — see **Sketch-to-profile** below), **Cross-Section Shape** (swap the circle for a
  [Gielis superformula](https://en.wikipedia.org/wiki/Superformula) curve — flowers,
  stars, gears), **Twist** (spirals the whole form top-to-bottom), **Surface Texture**
  (ribs/flutes, waves, or organic noise displacing the surface), **Perforation** (real
  cut-through holes — honeycomb or circle-punch — via boolean CSG; see **Perforation**
  below). All five compose freely and correctly together (e.g. perforation holes
  tile correctly across a twisted, superformula-cross-sectioned surface).
- **Blob** ([src/engine/blobGeometry.ts](src/engine/blobGeometry.ts) +
  [src/shapes/blobShapes.ts](src/shapes/blobShapes.ts)) — a noise-displaced icosahedron:
  the mathematical base behind gems, rocks, and asteroids. Components: **Roughness**
  (3D noise displacement — the technique behind open-source procedural rock/gem
  generators; low "detail" keeps flat gem-like facets, high detail + roughness gives a
  craggy boulder), **Flatten** (squashes top/bottom into an egg/lens shape).
- **Branch** ([src/engine/branchGeometry.ts](src/engine/branchGeometry.ts) +
  [src/shapes/branchShapes.ts](src/shapes/branchShapes.ts)) — a recursive, seeded
  branching structure (coral/root/tree), in the spirit of classic procedural L-system
  generators. No separate components — depth, branch count, and seed *are* the
  customization; change the seed for an entirely different specimen. Tapered cylinder
  segments joined by spheres; each is individually closed/watertight, so the union
  prints correctly without a CSG boolean step.
- **Photo Panel** ([src/engine/lithophaneGeometry.ts](src/engine/lithophaneGeometry.ts) +
  [src/shapes/lithophaneShapes.ts](src/shapes/lithophaneShapes.ts)) — upload a photo and
  it becomes a flat relief panel (thick where dark, thin where light) — the classic
  lithophane technique. See **Photo-to-relief** below.
- **Terrain Map** ([src/engine/terrainGeometry.ts](src/engine/terrainGeometry.ts) +
  [src/shapes/terrainShapes.ts](src/shapes/terrainShapes.ts)) — the same relief-panel
  technique, but the height source is real-world elevation data for a location you pick,
  not an image. See **Terrain maps from real elevation data** below.

**Quick-start templates**: the eleven previously separate Revolve "shapes" (Lamp Shade,
Vase, Planter/Pot, Tumbler/Cup, Twisted Spire, Wave Bowl, Organic Pod, Flower Vase, Gear
Planter, Lamp Base, Honeycomb Lamp Shade) and the two Blob ones (Crystal Gem, Boulder)
still exist, but as **named starting points** ([src/shapes/revolveTemplates.ts](src/shapes/revolveTemplates.ts),
[src/shapes/blobTemplates.ts](src/shapes/blobTemplates.ts)) rather than distinct fixed
shapes — clicking one just loads that combination of components/values into the same
Revolve or Blob editor, and you keep adding, removing, and tuning from there. A
`ShapeDefinition`'s param *ranges* live once on the base shape; a `ShapeTemplate` is just
a values overlay on top, so there's a single source of truth for what's tunable.

Every base shape *and every template* is regression-checked for zero non-manifold edges
via `npm run verify:geometry`, including closed/sealed sculptural forms (Organic Pod)
and merged multi-mesh structures (Coral Branch).

- **Live preview** ([src/components/Viewer3D.tsx](src/components/Viewer3D.tsx)): React
  Three Fiber canvas with auto-framing camera, orbit controls, and real-time geometry
  rebuilds as you drag sliders. 1 scene unit = 1mm, matching slicer conventions.
- **STL export** ([src/lib/exportStl.ts](src/lib/exportStl.ts)): binary STL via
  `three-stdlib`'s `STLExporter`, downloaded client-side — no server involved.

All of the above runs 100% locally in the browser — no AI, no API keys, no cost. (The
separate **AI Generate** tab, covered in Phase 2 below, is opt-in and does use a cloud
API.)

### Sketch-to-profile

The Revolve base is, mathematically, just a 2D silhouette spun around an axis — the same
principle behind real lathe/pottery-wheel design. So "sketch to 3D" is implemented
honestly and locally, no AI required: add the **Profile Curve** component and pick
**Custom sketch** and [SketchPad](src/components/SketchPad.tsx) opens.

- **Draw**: drag across the canvas (left edge = center axis, right = wider) to paint a
  half-profile; it's mirrored live into the full silhouette and immediately revolved.
- **Upload a photo of a rough sketch**: for each row, it walks in from the axis edge and
  finds the rightmost pixel darker than the threshold slider — the standard
  "half-profile silhouette" convention. Works best with a dark outline on a light
  background (pencil/pen on paper, photographed square-on); you can then draw over the
  auto-traced result to clean it up.

This intentionally does *not* attempt general image-to-3D (an uploaded photo of, say, a
whole room or an arbitrary 3D object won't produce anything sensible — it only reads a
silhouette). That's a materially different, much harder problem; see Phase 2 below.

### Perforation (real cut-through holes — honeycomb lamps, etc.)

The **Surface Texture** component (ribs/waves/organic) only *displaces* the surface — it
can't make an actual hole, so it can't produce a real honeycomb-perforated lamp shade
where light shines through open hexagons. **Perforation** is a separate component that
actually removes material via boolean CSG: add it, pick **Honeycomb** or **Circle
punch** (or start from the **Honeycomb Lamp Shade** quick-start template), tune hole
spacing/size, and it cuts a real grid of holes through the wall — tiled correctly across
twisted, tapered, or superformula-cross-sectioned surfaces alike, since it drills each
hole using the shape's own exact outer-surface position and normal at that point.

**Why manifold-3d and not three-bvh-csg**: the first implementation used
[three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg), a popular three.js CSG
library — but it consistently produced non-manifold output (dozens of open-boundary
edges) for exactly this shape of operation: drilling radially through a curved
cylindrical wall. Isolated testing (denser tessellation, vertex welding, clearing
material groups) ruled out a setup mistake; it turned out to be a known, still-open
upstream limitation (their own README points to triangle-splitting issues and
recommends [Manifold](https://github.com/elalish/manifold) for robustness). Swapping in
[manifold-3d](https://github.com/elalish/manifold) (the WASM build of that library)
resolved it completely — verified with this app's own manifold-check tooling down to
zero non-manifold edges, including a 378-hole honeycomb lamp shade.

Since manifold-3d loads as WASM (async) but every shape's `build()` is synchronous
everywhere else in this app, perforation degrades gracefully: it's skipped (shape
renders solid) until the module finishes loading — usually under a second — after which
the next recompute picks it up automatically ([src/engine/manifoldSingleton.ts](src/engine/manifoldSingleton.ts)).

### Photo-to-relief (lithophane) + color band guide for the Bambu A1

The **Photo Panel** shape ([src/lib/imageToHeightmap.ts](src/lib/imageToHeightmap.ts) +
[src/engine/lithophaneGeometry.ts](src/engine/lithophaneGeometry.ts)) turns an uploaded
photo into a flat relief slab, built the same way as everything else here: a front
relief surface sampled from the image's grayscale brightness (dark = thick, light =
thin) plus a flat back plane, sealed by a perimeter rim into one watertight solid. The
panel's height auto-matches the photo's aspect ratio, so nothing gets stretched.

This one physical shape serves two different print techniques:
- **Backlit lithophane** (the classic technique): print in one translucent filament and
  put it in front of a light — the varying thickness alone reproduces the image in
  grayscale, no color/AMS needed.
- **Opaque multi-color art on an AMS printer** (e.g. Bambu Lab A1): [ColorBandGuide](src/components/ColorBandGuide.tsx)
  splits the thickness range into bands and tells you the exact Z heights to trigger a
  filament color change in Bambu Studio. Since every column's *tallest visible layer*
  determines its printed color, and brighter image areas are shorter (per the lithophane
  formula above), assigning your lightest filament to the base band and your darkest to
  the top band makes the printed color roughly track the image's tone — using height
  alone, no color-transmission data required.
- **What this deliberately isn't**: true HueForge-style multi-layer color *blending*
  (translucent layers of different colors stacked and blended based on each filament's
  actual measured transmission distance) is a materially harder, different problem that
  needs calibrated per-filament data this app doesn't have. The band-guide technique
  above is the well-established simpler alternative — honest about the difference rather
  than pretending to replicate it.

### Terrain maps from real elevation data

The **Terrain Map** shape ([src/lib/elevation.ts](src/lib/elevation.ts) +
[src/engine/terrainGeometry.ts](src/engine/terrainGeometry.ts)) is the same watertight
relief-panel construction as the Photo Panel, but instead of image brightness, the
height source is real-world elevation for a location you pick — inspired directly by
3D-printed topographic trail-map art (e.g. TrailPrint3D, 3DTrails).

- Pick a location (five built-in presets — Grand Canyon, Half Dome, Mount Rainier, Zion
  Narrows, Matterhorn — or any latitude/longitude) and an area span in km, then **Fetch
  Terrain Data**: this samples a grid of real elevation points via
  [Open-Meteo](https://open-meteo.com)'s free, key-less elevation API — no account, in
  keeping with the "no accounts" spirit of the sites this is modeled on. Verified
  working directly from the browser (CORS-enabled); requests are batched at 100
  coordinates each (the API's per-request limit).
- **GPX route overlay** ([src/lib/gpx.ts](src/lib/gpx.ts) +
  [src/lib/geo.ts](src/lib/geo.ts) + [src/components/GpxUploadControl.tsx](src/components/GpxUploadControl.tsx)) —
  upload a `.gpx` file (exported from Strava, Garmin, Komoot, etc.) and your exact route
  is embossed as a raised line over the terrain, with the location and area span
  auto-fit to the route's bounding box. This is the signature look of
  [Type II Studio](https://typeii.studio)'s route-art prints: the route is parsed
  client-side (`DOMParser` over `<trkpt>`/`<rtept>`), converted to normalized panel UV
  coordinates, and added as a point-to-segment-distance falloff on top of the elevation
  heightmap inside the same `thicknessAt(u, v)` function the relief panel already uses —
  no separate mesh, no CSG, so it stays watertight for free. A route with no elevation
  data loaded yet (or one that falls outside the fetched area) still renders cleanly; it
  just has nothing to sit on top of, or falls outside the panel bounds and has zero
  visible influence.
- **Vertical exaggeration**: real terrain is usually far too subtle to read at desk-model
  scale, so the relief height is computed as "true-to-scale for this print's horizontal
  size" times an exaggeration multiplier (default 5x), not applied blindly.
- **Honest scope for now**: this is a genuine first version, not a clone of every
  TrailPrint3D/3DTrails/Type II Studio feature. No automatic terrain coloring, no
  contour lines, no non-rectangular (circle/hex) outlines, no title/subtitle text or
  medal-mount hardware, no multi-route compositions, no place-name search (Nominatim's
  usage policy discourages the kind of direct client-side calls this app would need, so
  it's skipped rather than built against a policy it wouldn't respect) — square panels
  from a manually-entered or preset coordinate, with an optional single route, only. See
  Roadmap.

### Where these techniques come from

- [Gielis superformula](https://en.wikipedia.org/wiki/Superformula) — a single polar
  formula (m/n1/n2/n3 params) that produces an enormous range of natural and mechanical
  outlines (flowers, shells, starfish, gears); widely used in generative design and CAD.
- Open-source parametric-CAD ecosystem (OpenSCAD + [BOSL2](https://github.com/BelfrySCAD/BOSL2),
  Gridfinity, dotSCAD) — validated the overall "customizer" pattern this app already
  used (param-driven shapes with live re-generation), and is the natural place to look
  next for threads/fasteners/modular-storage shape families.
- Voronoi/honeycomb lamps (very common open-source/Thingiverse/Printables designs) —
  directly implemented as the Perforation layer (honeycomb/circle-punch via real
  boolean CSG); a true irregular Voronoi-cell pattern specifically (vs. a regular hex
  or circle grid) is still a Roadmap item.
- [Manifold](https://github.com/elalish/manifold) — a topologically-robust CSG/geometry
  kernel (WASM) — directly implemented as the Perforation layer's boolean engine; see
  **Perforation** above for why it replaced an initial three-bvh-csg attempt.
- Noise-displaced icosphere rock/gem generators (e.g. the Three.js "SeedRock" approach) —
  directly implemented as the Blob family.
- Procedural L-system / recursive branch generators (a standard technique for
  trees/coral/roots in generative art) — directly implemented as the Branch family.
- Lithophanes (a very old technique, originally porcelain, now a 3D-printing staple) and
  the height-band approach to multi-color AMS prints (a simpler, honest alternative to
  full HueForge-style translucency blending) — directly implemented as the Lithophane
  family and [ColorBandGuide](src/components/ColorBandGuide.tsx).
- [TrailPrint3D](https://trailprint3d.com) (a free Blender add-on),
  [3DTrails](https://3d-trails.com) (pre-made topo-map prints of famous trails), and
  [Type II Studio](https://typeii.studio) (GPX-route-as-raised-line wall art) —
  directly implemented as the Terrain Map family (including the GPX route overlay), at
  a first-version scope; see **Terrain maps from real elevation data** above for exactly
  what's included vs. not yet.

### Known limitation

Plain STL carries no color information. The color picker is preview-only for now; a
future update can add 3MF export (which Bambu Studio reads with per-object/multi-color
info) for shapes that use a single flat color.

## Phase 2 — AI Generate (arbitrary objects — figurines, idols, characters — via Meshy)

For genuinely arbitrary organic/character shapes no amount of revolve/blob/branch math
can produce — figurines, religious idols, human dolls, mascots, busts — the **AI
Generate** tab sends a prompt or a photo to [Meshy](https://www.meshy.ai)'s API and
returns a real, arbitrary mesh, requested directly in STL format so no format
conversion step is needed:

- **From description**: Meshy's text-to-3D API, two-stage (preview = geometry, refine =
  texture) — since printing only needs geometry, this always stops after the untextured
  preview stage, skipping texturing entirely (cheaper, faster). Try "a small seated
  Buddha statue", "a Ganesha idol, traditional Indian style", "a standing human
  figurine" — the example prompts in the panel are exactly this use case.
- **From photo**: Meshy's image-to-3D API, for when you have a reference image instead.
- [server/index.ts](server/index.ts) — a small local Express backend that holds the
  Meshy API key server-side (it must never reach the browser) and proxies
  `POST /api/generate-from-image` and `POST /api/generate-from-text`: creates a Meshy
  task, polls it to completion ([server/meshy.ts](server/meshy.ts)), downloads the
  resulting STL, and streams it back.
- The frontend ([src/components/AIGeneratePanel.tsx](src/components/AIGeneratePanel.tsx))
  shows progress while it waits (generation typically takes 30s–a few minutes), then
  loads the returned STL via `STLLoader` into the same
  [Viewer3D](src/components/Viewer3D.tsx) the parametric shapes use, with a "scale to
  height" control (Meshy's output isn't in real-world mm) before export.
- **Honest limitation**: unlike the parametric shapes (guaranteed watertight by
  construction), an AI-generated mesh is *not* guaranteed manifold/printable — check it
  in your slicer's mesh-repair tool (Bambu Studio has one built in) before printing.

**Setup** (needs a free Meshy account — I can't sign up on your behalf):
1. Create a free account at [meshy.ai](https://www.meshy.ai) (Free plan: 100
   credits/month, no card required — about 3 image-to-3D generations/month at the
   default settings this app uses) and copy an API key from your dashboard.
2. Copy [.env.example](.env.example) to `.env` in the project root and paste your key
   into `MESHY_API_KEY=` — `.env` is gitignored, never commit it.
3. `npm run dev` now starts *both* the Vite frontend and this backend together (see
   below) — no separate step needed.

## Running it

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite frontend (:5173) and the AI-generation backend (:8787,
see Phase 2 above) together via `concurrently`; Vite proxies `/api/*` to the backend in
dev. The parametric-shapes side of the app works with zero setup — the backend is only
needed for the AI Generate tab, and just logs a warning (not a crash) if `MESHY_API_KEY`
isn't set. `npm run dev:web` / `npm run dev:server` run either half alone.

Other scripts: `npm run build` (typecheck + production frontend bundle — the backend
isn't part of this build; deploying the AI feature means also running `server/index.ts`
somewhere with `MESHY_API_KEY` set), `npm run lint` (oxlint), `npm run verify:geometry`
(manifold/watertightness sanity check + writes sample STLs to `scripts/out/`, gitignored).

## Roadmap

**Phase 3 — mobile (Android/iOS).** The shape/geometry engine in `src/engine` and
`src/shapes` has no DOM or browser-only dependencies beyond `three`, so it's a
reasonable candidate to lift into a shared package consumed by a React Native app
(`three` has a React Native-compatible path via `expo-three`/`react-native-webgl`).
The UI layer (`src/components`, `src/App.tsx`) would be rebuilt natively; the state
store (`zustand`) and STL export logic would mostly carry over as-is.

**Other things worth adding before this feels "done":**
- A true irregular Voronoi-cell perforation pattern (the current Perforation layer
  does regular hex/circle grids; real Voronoi tessellation is a further step, though
  the CSG plumbing to cut it is now in place and proven).
- Real HueForge-style multi-layer color blending for the Photo Panel (needs calibrated
  per-filament transmission-distance data — see **Photo-to-relief** above for why the
  simpler band-guide approach was chosen instead for now).
- A cylindrical/wrapped lithophane ("photo lamp shade") using the same heightmap
  technique on the revolve-shell family's surface-texture layer.
- More shape families beyond revolve/blob/branch/lithophane (extruded/boxy things,
  text/monogram embossing, multi-part assemblies, gridfinity-style modular bins).
- Save/load a design (params) as a small JSON file, and a gallery of past designs.
- 3MF export with color.
- Drainage-hole / mounting-hole cutouts for the planter — now straightforward since
  the Perforation layer's CSG plumbing already exists.
- Terrain Map: circle/hex/frame outline options, automatic biome coloring, contour
  lines, title/subtitle text embossing, multi-route compositions, multi-tile maps for
  wall-scale prints — the full TrailPrint3D/3DTrails/Type II Studio feature set is a lot
  more than the current first version (which now includes GPX route overlay).
- A parametric humanoid/character base (in the spirit of open-source morphable-model
  tools like MakeHuman) as a genuine mathematical alternative to AI generation for
  figurines/dolls — a much larger undertaking (a trained blend-shape body model, not a
  simple formula) than anything else in this app; AI Generate is the practical answer
  for that use case today.
