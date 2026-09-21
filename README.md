# Formwork

A parametric 3D model customizer, in the spirit of MakerWorld/Thingiverse "Customizer" apps.
Pick a base shape, drag sliders to reshape it in a live 3D preview, and export a
print-ready STL for Bambu Studio (or any slicer).

## What's here (Phase 1 — parametric customizer)

Four geometry families, thirteen catalog entries, all built on techniques borrowed from
real open-source/generative-design tooling (see **Where these techniques come from**
below) rather than invented from scratch:

- **Revolve-shell family** ([src/engine/revolveShell.ts](src/engine/revolveShell.ts) +
  [src/shapes/revolveShapes.ts](src/shapes/revolveShapes.ts)): Lamp Shade, **Lamp Base**,
  Vase, Planter/Pot, Tumbler/Cup, Twisted Spire, Wave Bowl, Organic Pod, Flower Vase, Gear
  Planter. A watertight, manifold, double-walled shell revolved around the Y axis, with
  five composable parametric layers:
  - **silhouette** — height profile: straight/bulge/cinch curve, *or* a hand-drawn/uploaded
    custom profile (see **Sketch-to-profile** below),
  - **cross-section** — a circle, or a [Gielis superformula](https://en.wikipedia.org/wiki/Superformula)
    curve (flowers, stars, gears, rounded polygons — one formula, `petals`/`n1`/`n2`/`n3`
    sliders, huge range of outlines),
  - **twist** — spirals the whole form top-to-bottom (classic "twisted vase mode"),
  - **surface texture** — ribs/flutes, waves, or cheap deterministic organic/coral noise,
    all of which spiral automatically if twist is also applied.
  - Lamp Base is sized for real hardware: open top for a standard socket/harp riser
    (~28-32mm), open bottom to route the cord and add a weight for stability — same
    hollow-shell shape as Vase, just different proportions/openings, so it needed zero
    new geometry code.
- **Blob family** ([src/engine/blobGeometry.ts](src/engine/blobGeometry.ts) +
  [src/shapes/blobShapes.ts](src/shapes/blobShapes.ts)): Crystal Gem, Boulder. A
  noise-displaced icosahedron (the technique behind open-source procedural rock/gem
  generators) — subdivision level controls facet density, a seeded 3D noise field
  displaces each vertex along its own radial direction, and a faceted/smooth toggle
  switches between flat-shaded gem facets and a rounded boulder look. Solid, not hollow.
- **Branch family** ([src/engine/branchGeometry.ts](src/engine/branchGeometry.ts) +
  [src/shapes/branchShapes.ts](src/shapes/branchShapes.ts)): Coral Branch. A recursive,
  seeded branching structure (coral/root/tree), in the spirit of classic procedural
  L-system generators — tapered cylinder segments joined by spheres; change the seed for
  an entirely different specimen. Each segment is individually closed/watertight, so the
  union prints correctly without a CSG boolean step.
- **Lithophane family** ([src/engine/lithophaneGeometry.ts](src/engine/lithophaneGeometry.ts) +
  [src/shapes/lithophaneShapes.ts](src/shapes/lithophaneShapes.ts)): Photo Panel. Upload a
  photo and it becomes a flat relief panel — thick where the image is dark, thin where
  it's light, the classic backlit-lithophane technique. See **Photo-to-relief** below.

Every shape is regression-checked for zero non-manifold edges via `npm run
verify:geometry`, including closed/sealed sculptural forms (Organic Pod) and merged
multi-mesh structures (Coral Branch).

- **Live preview** ([src/components/Viewer3D.tsx](src/components/Viewer3D.tsx)): React
  Three Fiber canvas with auto-framing camera, orbit controls, and real-time geometry
  rebuilds as you drag sliders. 1 scene unit = 1mm, matching slicer conventions.
- **STL export** ([src/lib/exportStl.ts](src/lib/exportStl.ts)): binary STL via
  `three-stdlib`'s `STLExporter`, downloaded client-side — no server involved.

All of the above runs 100% locally in the browser — no AI, no API keys, no cost. (The
separate **AI Generate** tab, covered in Phase 2 below, is opt-in and does use a cloud
API.)

### Sketch-to-profile

Revolve shapes are, mathematically, just a 2D silhouette spun around an axis — the same
principle behind real lathe/pottery-wheel design. So "sketch to 3D" is implemented
honestly and locally for this shape family, no AI required: pick **Profile curve →
Custom sketch** on any revolve shape and [SketchPad](src/components/SketchPad.tsx) opens.

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

### Where these techniques come from

- [Gielis superformula](https://en.wikipedia.org/wiki/Superformula) — a single polar
  formula (m/n1/n2/n3 params) that produces an enormous range of natural and mechanical
  outlines (flowers, shells, starfish, gears); widely used in generative design and CAD.
- Open-source parametric-CAD ecosystem (OpenSCAD + [BOSL2](https://github.com/BelfrySCAD/BOSL2),
  Gridfinity, dotSCAD) — validated the overall "customizer" pattern this app already
  used (param-driven shapes with live re-generation), and is the natural place to look
  next for threads/fasteners/modular-storage shape families.
- Voronoi lamps (a very common open-source/Thingiverse/Printables design) — inspired the
  idea, but a true perforated-cell shell needs real 3D Voronoi tessellation + boolean
  subtraction (see Roadmap); not implemented yet.
- Noise-displaced icosphere rock/gem generators (e.g. the Three.js "SeedRock" approach) —
  directly implemented as the Blob family.
- Procedural L-system / recursive branch generators (a standard technique for
  trees/coral/roots in generative art) — directly implemented as the Branch family.
- Lithophanes (a very old technique, originally porcelain, now a 3D-printing staple) and
  the height-band approach to multi-color AMS prints (a simpler, honest alternative to
  full HueForge-style translucency blending) — directly implemented as the Lithophane
  family and [ColorBandGuide](src/components/ColorBandGuide.tsx).

### Known limitation

Plain STL carries no color information. The color picker is preview-only for now; a
future update can add 3MF export (which Bambu Studio reads with per-object/multi-color
info) for shapes that use a single flat color.

## Phase 2 — AI Generate (arbitrary photos, via Meshy)

For photos/sketches that aren't revolve-symmetric (sketch-to-profile above only covers
silhouette shapes), the **AI Generate** tab sends an uploaded image to
[Meshy](https://www.meshy.ai)'s image-to-3D API and returns a real, arbitrary mesh —
requested directly in STL format, so no format conversion step is needed.

- [server/index.ts](server/index.ts) — a small local Express backend that holds the
  Meshy API key server-side (it must never reach the browser) and proxies
  `POST /api/generate-from-image`: creates a Meshy task, polls it to completion
  ([server/meshy.ts](server/meshy.ts)), downloads the resulting STL, and streams it back.
- The frontend ([src/components/AIGeneratePanel.tsx](src/components/AIGeneratePanel.tsx))
  uploads the image, shows progress while it waits (generation typically takes
  30s–a few minutes), then loads the returned STL via `STLLoader` into the same
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
- A true perforated Voronoi-cell shell (real cut-through holes, not just a bump
  texture) — needs a CSG boolean step, e.g. via `three-bvh-csg`, to subtract cells from
  the revolve shell.
- Real HueForge-style multi-layer color blending for the Photo Panel (needs calibrated
  per-filament transmission-distance data — see **Photo-to-relief** above for why the
  simpler band-guide approach was chosen instead for now).
- A cylindrical/wrapped lithophane ("photo lamp shade") using the same heightmap
  technique on the revolve-shell family's surface-texture layer.
- More shape families beyond revolve/blob/branch/lithophane (extruded/boxy things,
  text/monogram embossing, multi-part assemblies, gridfinity-style modular bins).
- Save/load a design (params) as a small JSON file, and a gallery of past designs.
- 3MF export with color.
- Drainage-hole / mounting-hole cutouts for the planter (also needs real CSG).
