/**
 * The seventeen towers, as 3D objects standing on the map.
 *
 * Drawn INSIDE MapLibre's own WebGL context as a custom layer, not on a second
 * canvas over the top. That matters: the towers live in the map's 3D space, so
 * they keep correct perspective, lean with the camera and land in the right
 * place at every zoom, for free. There is one canvas on this page and MapLibre
 * still owns it.
 *
 * It also finishes the idea behind the tour's lean. The camera eases to 50° on
 * arrival "so the tower rises out of the map instead of sitting flat on it" —
 * until now there was no tower there to rise.
 *
 *
 * WHY THIS IS NOT THE BLENDER MODEL
 * ---------------------------------
 * It was, first. assets/3d/moontower.glb is the real thing — an open steel
 * lattice, faithfully modelled — and it looks superb on the splash screen where
 * it fills the phone. On the map it disappeared, for reasons of arithmetic
 * rather than taste:
 *
 *   At the tour's parked zoom of 15.4, one pixel is about 3.1 metres. A real
 *   tower is 47.5 m tall and 3.9 m wide, so it lands 15 px tall and ONE PIXEL
 *   wide. Scale it up 3x for a readable height and the shaft is still under
 *   2 px — all you see is a tall thin spike: too tall, barely visible.
 *
 * A lattice is holes held together by thin steel. Below a few pixels the steel
 * vanishes and only the holes are left. So at map scale the tower stops being a
 * model and becomes a SYMBOL — the same reason a road on a map is drawn far
 * wider than its true width: at true width nobody could see the road.
 *
 * Hence this file. A simplified tower built from three primitives, sized in
 * metres so you can still reason about it, but deliberately stockier than the
 * real thing so it survives at 40 px. Every number is a constant below: change
 * one, reload, see the result. That is the point of it living in code rather
 * than in a .glb.
 */
import { THREE } from '../vendor/three.bundle.js';

// ---------------------------------------------------------------------------
// The tower, in metres. TRUE values noted where we depart from them.
// ---------------------------------------------------------------------------
const HEIGHT_M     = 47.5;  // true: 47.5 m to the top of the crown
const SHAFT_W_M    = 5.0;   // true: ~3.9 m. A CONSTANT width, not a taper.
const CROWN_H_M    = 2.5;   // the little platform under the lamps
const CROWN_W_M    = 6.0;   // kept narrow on purpose — see the note below
const LAMP_RING_M  = 6.0;   // radius the six lamps stand on: the widest point
const LAMP_R_M     = 2.2;   // each lamp bead

// A note on the silhouette, because it took three passes to get right.
//
//   1. The Blender lattice: one pixel wide, invisible (see above).
//   2. A crown platform wider than everything else: read as a hammer, a lump
//      on a stick.
//   3. A hard-tapered spire, glowing all over when lit: read as a cone — a
//      Christmas tree, in the owner's words.
//
// What works is a SLIM MAST OF CONSTANT WIDTH carrying a ring of lights wider
// than itself, with the glow confined to the top. The tower is a stalk; the
// light belongs to the crown. The map's own illumination circles are already
// showing how far that light reaches, so the tower does not need to shout.

/**
 * Everything above is then blown up by this. Together with the widening it is
 * the only untrue thing on the page — a tower at true scale is a speck.
 * SET IT TO 1 to see the truth: the towers will be there, just very small.
 */
const SCALE_MULTIPLIER = 2.0;

// Unlit, the mast is plain steel picked out by the moonlight below — no glow at
// all. Struck alight, the arc spills DOWN the mast from the crown and fades out
// (see topGlowTexture), so only the top ever burns.
const SHAFT_DARK = 0.0;
const SHAFT_LIT  = 1.5;
const CROWN_DARK = 0.05;
const CROWN_LIT  = 1.7;
const LAMP_DARK  = 0.0;
const LAMP_LIT   = 6.0;

const STEEL_COLOR = 0x39476a;   // cold blued steel
const STEEL_GLOW  = 0x9fb4e6;   // moonlight on it
const LAMP_COLOR  = 0xe9e6ff;   // the arc white the theme reserves for lit towers

/**
 * A one-pixel-wide strip, black at the bottom and white at the top, used as the
 * mast's emissiveMap. An emissiveMap multiplies the emissive colour per texel,
 * so the arc light appears to spill down from the crown and fade out a third of
 * the way, instead of the whole mast glowing evenly — which is what made it read
 * as a lit cone. A cylinder's UVs run v=0 at the bottom to v=1 at the top, and
 * three.js flips textures vertically by default, so the canvas is drawn with
 * black at the bottom to land black at the mast's feet.
 */
function topGlowTexture() {
  const h = 64;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = h;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, h, 0, 0);   // bottom -> top
  grad.addColorStop(0.00, '#000000');
  grad.addColorStop(0.62, '#000000');   // the lower two-thirds never light
  grad.addColorStop(0.86, '#55658c');
  grad.addColorStop(1.00, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * One tower's geometry, built once and shared by all seventeen. Geometry is the
 * expensive part; materials are cheap, so each tower gets its own materials (it
 * has to — they light one at a time) but they all point at these same shapes.
 *
 * Y is up here, as three.js expects. The whole thing gets stood up into
 * MapLibre's Z-up world by the matrix in place() below.
 */
function buildShapes() {
  const shaftH = HEIGHT_M - CROWN_H_M;
  return {
    // A four-sided mast of constant width - a lattice read from far enough away.
    shaft: new THREE.CylinderGeometry(SHAFT_W_M / 2, SHAFT_W_M / 2, shaftH, 4, 1),
    shaftY: shaftH / 2,
    crown: new THREE.BoxGeometry(CROWN_W_M, CROWN_H_M, CROWN_W_M),
    crownY: shaftH + CROWN_H_M / 2,
    lamp: new THREE.SphereGeometry(LAMP_R_M, 8, 6),
    lampY: HEIGHT_M,
    glow: topGlowTexture(),   // shared by all seventeen; only intensity differs
  };
}

export function createTowers3D({ map, features }) {
  /** One entry per tower: the materials we switch when it is struck alight. */
  const towers = [];
  /** Which towers were lit before the scene existed. */
  let pending = new Set();
  let scene = null;
  let camera = null;
  let renderer = null;

  function place(shapes, feature) {
    const group = new THREE.Group();

    const shaftMat = new THREE.MeshStandardMaterial({
      color: STEEL_COLOR, metalness: 0.5, roughness: 0.5,
      emissive: STEEL_GLOW, emissiveMap: shapes.glow,
      emissiveIntensity: SHAFT_DARK,
    });
    const crownMat = new THREE.MeshStandardMaterial({
      color: STEEL_COLOR, metalness: 0.5, roughness: 0.5,
      emissive: STEEL_GLOW, emissiveIntensity: CROWN_DARK,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: LAMP_COLOR, emissive: LAMP_COLOR, emissiveIntensity: LAMP_DARK,
    });

    const shaft = new THREE.Mesh(shapes.shaft, shaftMat);
    shaft.position.y = shapes.shaftY;
    group.add(shaft);

    const crown = new THREE.Mesh(shapes.crown, crownMat);
    crown.position.y = shapes.crownY;
    group.add(crown);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lamp = new THREE.Mesh(shapes.lamp, lampMat);
      lamp.position.set(Math.cos(a) * LAMP_RING_M, shapes.lampY, Math.sin(a) * LAMP_RING_M);
      group.add(lamp);
    }

    // MapLibre's world is Mercator: x east, y south, z up, the whole globe in
    // one unit. meterInMercatorCoordinateUnits() is the conversion at this
    // latitude — it changes as you move north or south, so it is per tower.
    const mc = maplibregl.MercatorCoordinate.fromLngLat(feature.geometry.coordinates, 0);
    const s = mc.meterInMercatorCoordinateUnits() * SCALE_MULTIPLIER;

    // three.js is Y-up; Mercator is Z-up with y running south. Hence the
    // quarter turn about x, and the negative y scale that flips the handedness.
    group.matrixAutoUpdate = false;
    group.matrix = new THREE.Matrix4()
      .makeTranslation(mc.x, mc.y, mc.z)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

    scene.add(group);
    towers.push({ id: feature.properties.id, shaftMat, crownMat, lampMat });
  }

  function apply(litIds) {
    for (const t of towers) {
      const on = litIds.has(t.id);
      t.shaftMat.emissiveIntensity = on ? SHAFT_LIT : SHAFT_DARK;
      t.crownMat.emissiveIntensity = on ? CROWN_LIT : CROWN_DARK;
      t.lampMat.emissiveIntensity = on ? LAMP_LIT : LAMP_DARK;
    }
  }

  const layer = {
    id: 'towers-3d',
    type: 'custom',
    renderingMode: '3d',

    onAdd(_map, gl) {
      // A plain Camera, not a Perspective one: MapLibre hands us a finished
      // projection matrix every frame, so three.js must not compute its own.
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Night lighting borrowed from the splash scene. The map already paints
      // each lit tower's pool of light underneath, so there are no point lights
      // here — seventeen of them would be seventeen costs for something drawn.
      scene.add(new THREE.AmbientLight(0x36486a, 1.4));
      const moon = new THREE.DirectionalLight(0x8fa8d8, 1.6);
      moon.position.set(0.4, -0.6, 1.0);   // a direction in Mercator space; +z is up
      scene.add(moon);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(), context: gl, antialias: true,
      });
      // MapLibre has already drawn the city by the time we run. Clearing here
      // would wipe it out from under the towers.
      renderer.autoClear = false;

      const shapes = buildShapes();
      for (const f of features) place(shapes, f);
      apply(pending);
      map.triggerRepaint();
    },

    render(_gl, args) {
      if (!renderer) return;
      // MapLibre 5 passes an options object (verified against 5.24.0); older
      // versions passed the matrix itself. Accept either, so a version bump
      // cannot silently blank the layer.
      const m = args?.defaultProjectionData?.mainMatrix ?? args?.mainMatrix ?? args;
      if (!m) return;
      camera.projectionMatrix = new THREE.Matrix4().fromArray(m);
      // three.js and MapLibre share one GL context and each assumes it owns the
      // state. This hands it back in the condition MapLibre expects.
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };

  return {
    layer,
    /** Called from the same redraw() that refreshes the 2D tower sources. */
    update(litIds) {
      pending = litIds;
      if (towers.length) {
        apply(litIds);
        map.triggerRepaint();
      }
    },
  };
}
