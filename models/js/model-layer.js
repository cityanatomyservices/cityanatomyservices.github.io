/**
 * model-layer.js — GLB models standing on the map.
 *
 * One MapLibre custom layer that draws any number of glTF models INSIDE the
 * map's own WebGL context with three.js. Because they are drawn in the map's
 * 3D space (not on a second canvas over the top), they keep correct
 * perspective, lean with the camera and land in the right place at every
 * zoom, for free. The map still owns the one canvas on the page.
 *
 * A model is placed by a `placement` from data/placements.json:
 *   anchor          [lon, lat] where the model's local origin goes
 *   heading_deg     model +Y ("model north") turned clockwise from true north
 *   ground_offset_m metres added to the model's up axis so its ground meets
 *                   the flat map plane (the map has no terrain)
 *   bounds          [west, south, east, north] footprint, for the shadow
 *                   camera and the ground that catches the shadow
 *
 * Usage:
 *   const models = createModelLayer({ map });
 *   map.addLayer(models.layer);                // last, so it draws on top
 *   models.add('drainage/main', url, placement);
 *   models.spotlight('drainage/main');         // aim the sun's shadow at it
 *   models.show('drainage/main', false);
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// The GLBs are Draco-compressed (tools/models/prepare-glbs.sh: the drainage
// model went from 17 MB to 0.5 MB). The decoder is the one that ships with
// three.js, fetched from the same pinned CDN copy as three itself.
const DRACO_DECODER_PATH = 'https://unpkg.com/three@0.185.1/examples/jsm/libs/draco/';

// Where the sun stands, in the map frame (x east, y north, z up): high in
// the south-east, so vertical faces read against the flat roofs and the
// shadows fall north-west. Unit length does not matter.
const SUN_DIRECTION = new THREE.Vector3(0.5, -0.7, 1.0).normalize();
const SHADOW_MAP_SIZE = 2048;
const SHADOW_OPACITY = 0.35;

export function createModelLayer({ map }) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  /** key -> { group, ground, visible, placement } */
  const items = new Map();
  /** url -> Promise<THREE.Object3D>, so the same file is fetched once */
  const files = new Map();
  let scene = null;
  let camera = null;
  let renderer = null;
  let sun = null;

  /**
   * COORDINATES, and the two traps in them.
   *
   * MapLibre's world is Mercator: x east, y SOUTH, z up, the whole globe in
   * one unit. That frame is left-handed, and three.js assumes a right-handed
   * one: it decides which side of every triangle is the front from the
   * object's matrix, so a mirror hidden in the camera makes it light every
   * face from the wrong side (the first version of this page had murky, flat
   * models for exactly this reason, 2026-10-26). The cure is to put the
   * mirror where three.js never looks: the camera's projection matrix gets a
   * y flip, and everything else lives in a right-handed "map frame": x east,
   * y NORTH, z up, in Mercator units.
   *
   * The second trap is precision. Austin sits at about (0.23, 0.41) in
   * Mercator units and one metre is 0.00000003 of them; the graphics card
   * works in 32-bit floats, which cannot hold both at once, so vertices
   * would snap to a grid of about half a metre. So the scene is kept
   * RELATIVE TO AN ORIGIN near the model being looked at: objects carry small
   * coordinates and the big offset is folded into the projection matrix,
   * which is built here in 64-bit arithmetic every frame. spotlight() moves
   * the origin; placementMatrix() positions everything against it.
   */
  const FLIP_Y = new THREE.Matrix4().makeScale(1, -1, 1);
  /** the scene origin, in the map frame */
  const origin = new THREE.Vector3(0, 0, 0);

  /** A lon/lat as a point in the map frame (Mercator units, y north). */
  function mapPoint(lngLat) {
    const mc = maplibregl.MercatorCoordinate.fromLngLat(lngLat, 0);
    return { x: mc.x, y: -mc.y, metre: mc.meterInMercatorCoordinateUnits() };
  }

  /**
   * The matrix that takes a glTF model (metres, Y up, -Z north) to its spot
   * in the map frame, relative to the origin. Read right to left:
   *   1. lift or sink the model by its ground offset (along its own up axis)
   *   2. turn it about its up axis by the heading (clockwise from north is a
   *      NEGATIVE rotation about +Y in three.js's right-handed frame)
   *   3. stand it up: a quarter turn about x takes glTF's Y-up/-Z-north to
   *      the map frame's Z-up/+Y-north
   *   4. scale metres to Mercator units at this latitude, move to the anchor
   */
  function placementMatrix(p) {
    const a = mapPoint(p.anchor);
    const heading = THREE.MathUtils.degToRad(p.heading_deg || 0);
    return new THREE.Matrix4()
      .makeTranslation(a.x - origin.x, a.y - origin.y, 0)
      .scale(new THREE.Vector3(a.metre, a.metre, a.metre))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationY(-heading))
      .multiply(new THREE.Matrix4().makeTranslation(0, p.ground_offset_m || 0, 0));
  }

  /** The model's footprint box in the map frame, relative to the origin. */
  function footprint(p) {
    const b = p.bounds;
    const sw = mapPoint([b[0], b[1]]);
    const ne = mapPoint([b[2], b[3]]);
    return {
      cx: (sw.x + ne.x) / 2 - origin.x, cy: (sw.y + ne.y) / 2 - origin.y,
      w: ne.x - sw.x, h: ne.y - sw.y, metre: sw.metre
    };
  }

  /** Re-place every object against the current origin. */
  function replaceAll() {
    for (const item of items.values()) {
      if (item.group) item.group.matrix.copy(placementMatrix(item.placement));
      if (item.ground) {
        const f = footprint(item.placement);
        item.ground.position.set(f.cx, f.cy, 0);
      }
    }
  }

  function loadFile(url) {
    if (!files.has(url)) {
      files.set(url, loader.loadAsync(url).then((gltf) => {
        // Blender's flat materials come through as MeshStandardMaterial. On
        // the way in: draw both faces (a few parts, the lake surface and
        // apron slabs, are single planes); make everything matte (a metallic
        // surface reflects its surroundings and there are none to reflect,
        // so metal came out black on the first try); cast and catch shadows.
        // Baked ambient occlusion, when a model has it, arrives as an
        // occlusion texture and GLTFLoader wires it up on its own.
        gltf.scene.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.castShadow = true;
          o.receiveShadow = true;
          const m = o.material;
          m.side = THREE.DoubleSide;
          m.metalness = 0;
          m.roughness = Math.max(m.roughness ?? 1, 0.6);
          // Blender's glass arrives as a "transmission" material. three.js
          // renders that with an extra full-screen pass that does not work
          // inside MapLibre's context, so glass becomes plain see-through.
          if (m.transmission > 0) {
            m.transmission = 0;
            m.transparent = true;
            m.opacity = 0.45;
            m.depthWrite = false;
            o.castShadow = false;
          }
        });
        return gltf.scene;
      }));
    }
    return files.get(url);
  }

  const layer = {
    id: 'models-3d',
    type: 'custom',
    renderingMode: '3d',

    onAdd(_map, gl) {
      // A plain Camera, not a Perspective one: MapLibre hands us a finished
      // projection matrix every frame, so three.js must not compute its own.
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Daylight: the sun, which casts the shadows, and a sky light that
      // fills in the shade so nothing goes black.
      const sky = new THREE.HemisphereLight(0xffffff, 0x9aa0a6, 1.2);
      sky.position.set(0, 0, 1);
      scene.add(sky);
      sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.castShadow = true;
      sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
      sun.shadow.bias = -0.0002;
      scene.add(sun);
      scene.add(sun.target);

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.setPixelRatio(1);
      // MapLibre has already drawn the city by the time we run. Clearing here
      // would wipe it out from under the models.
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;   // the soft variant is deprecated in three r185

      for (const item of items.values()) {
        if (item.group) scene.add(item.group);
        if (item.ground) scene.add(item.ground);
      }
      map.triggerRepaint();
    },

    render(_gl, args) {
      if (!renderer || !scene.children.length) return;
      // MapLibre 5 passes an options object; older versions passed the matrix
      // itself. Accept either, so a version bump cannot silently blank the layer.
      const m = args?.defaultProjectionData?.mainMatrix ?? args?.mainMatrix ?? args;
      if (!m) return;
      // three.js remembers the canvas size it started with; the shadow pass
      // resets the viewport to that, so keep it current.
      const c = map.getCanvas();
      const size = renderer.getSize(new THREE.Vector2());
      if (size.x !== c.width || size.y !== c.height) renderer.setSize(c.width, c.height, false);
      // MapLibre's matrix, then the handedness mirror, then the origin shift
      // (see the note on coordinates above)
      camera.projectionMatrix = new THREE.Matrix4().fromArray(m)
        .multiply(FLIP_Y)
        .multiply(new THREE.Matrix4().makeTranslation(origin.x, origin.y, 0));
      // three.js and MapLibre share one GL context and each assumes it owns
      // the state. This hands it back in the condition MapLibre expects.
      renderer.resetState();
      renderer.render(scene, camera);
    }
  };

  return {
    layer,

    /** Load a GLB (once per url) and stand it on the map. Resolves when drawn. */
    async add(key, url, placement) {
      if (items.has(key)) return items.get(key).group;
      const item = { group: null, ground: null, visible: true, placement };
      items.set(key, item);
      const model = await loadFile(url);
      const group = new THREE.Group();
      group.add(model);
      group.matrixAutoUpdate = false;
      group.matrix.copy(placementMatrix(placement));
      group.visible = item.visible;
      item.group = group;
      // An invisible sheet on the map plane under the model that only shows
      // the shadow falling on it, so the building sits in its own shadow
      // instead of floating. Sized to the footprint plus a margin.
      if (placement.bounds) {
        const f = footprint(placement);
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(f.w * 1.6 + 200 * f.metre, f.h * 1.6 + 200 * f.metre),
          new THREE.ShadowMaterial({ opacity: SHADOW_OPACITY, transparent: true, depthWrite: false })
        );
        ground.position.set(f.cx, f.cy, 0);
        ground.receiveShadow = true;
        ground.visible = item.visible;
        item.ground = ground;
        if (scene) scene.add(ground);
      }
      if (scene) { scene.add(group); map.triggerRepaint(); }
      return group;
    },

    has(key) { return items.has(key); },

    show(key, on) {
      const item = items.get(key);
      if (!item) return;
      item.visible = !!on;
      if (item.group) item.group.visible = item.visible;
      if (item.ground) item.ground.visible = item.visible;
      map.triggerRepaint();
    },

    /**
     * Point the sun's shadow camera at one model and move the scene origin
     * to it. Call it for the model being looked at: a shadow map covers one
     * square of ground at a time, and the finer that square the crisper the
     * shadows (2048 pixels over a 300 m building is 15 cm; over the 6 km
     * drainage network it is 3 m, which is as good as it gets there).
     */
    spotlight(key) {
      const item = items.get(key);
      if (!item || !item.placement.bounds || !sun) return;
      const a = mapPoint(item.placement.anchor);
      origin.set(a.x, a.y, 0);
      replaceAll();
      const f = footprint(item.placement);
      // half-size of the square the shadow camera covers: the footprint plus
      // room for the model's height and the length of its shadow
      const r = Math.max(f.w, f.h) * 0.75 + 150 * f.metre;
      const centre = new THREE.Vector3(f.cx, f.cy, 0);
      sun.target.position.copy(centre);
      sun.position.copy(centre).addScaledVector(SUN_DIRECTION, r * 3);
      const cam = sun.shadow.camera;
      cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
      cam.near = r; cam.far = r * 5;
      cam.updateProjectionMatrix();
      // push the shadow test half a metre along the surface normal so flat
      // faces do not shadow themselves in stripes
      sun.shadow.normalBias = 0.5 * f.metre;
      map.triggerRepaint();
    },

    /** For checks from the console: the three.js scene and renderer. */
    get scene() { return scene; },
    get renderer() { return renderer; }
  };
}
