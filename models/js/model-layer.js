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
 *
 * Usage:
 *   const models = createModelLayer({ map });
 *   map.addLayer(models.layer);                // last, so it draws on top
 *   models.add('drainage/main', url, placement);
 *   models.show('drainage/main', false);
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// The GLBs are Draco-compressed (tools/models/prepare-glbs.sh: the drainage
// model went from 17 MB to 0.4 MB). The decoder is the one that ships with
// three.js, fetched from the same pinned CDN copy as three itself.
const DRACO_DECODER_PATH = 'https://unpkg.com/three@0.185.1/examples/jsm/libs/draco/';

export function createModelLayer({ map }) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  /** key -> { group, visible, placement } */
  const items = new Map();
  /** url -> Promise<THREE.Object3D>, so the same file is fetched once */
  const files = new Map();
  let scene = null;
  let camera = null;
  let renderer = null;

  /**
   * The matrix that takes a glTF model (metres, Y up, -Z north) to its spot
   * in MapLibre's world (Mercator: x east, y south, z up, the globe in one
   * unit). Read right to left:
   *   1. lift or sink the model by its ground offset (along its own up axis)
   *   2. turn it about its up axis by the heading (clockwise from north is a
   *      NEGATIVE rotation about +Y in three.js's right-handed frame)
   *   3. stand it up: a quarter turn about x takes Y-up to Z-up, and the
   *      negative y scale flips to Mercator's south-pointing y
   *   4. scale metres to Mercator units at this latitude, move to the anchor
   */
  function placementMatrix(p) {
    const mc = maplibregl.MercatorCoordinate.fromLngLat(p.anchor, 0);
    const s = mc.meterInMercatorCoordinateUnits();
    const heading = THREE.MathUtils.degToRad(p.heading_deg || 0);
    return new THREE.Matrix4()
      .makeTranslation(mc.x, mc.y, mc.z)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationY(-heading))
      .multiply(new THREE.Matrix4().makeTranslation(0, p.ground_offset_m || 0, 0));
  }

  function loadFile(url) {
    if (!files.has(url)) {
      files.set(url, loader.loadAsync(url).then((gltf) => {
        // Blender's flat materials come through as MeshStandardMaterial. Two
        // fixes on the way in: draw both faces (a few parts, the lake surface
        // and apron slabs, are single planes), and make everything matte. A
        // metallic surface reflects its surroundings and there are none to
        // reflect here, so metal came out black on the first try (2026-10-26).
        gltf.scene.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.material.side = THREE.DoubleSide;
          o.material.metalness = 0;
          o.material.roughness = Math.max(o.material.roughness ?? 1, 0.6);
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

      // Daylight. Light directions are in Mercator space, where +z is up and
      // +y is south: the sun stands high in the south-east, the sky fills in
      // the rest, so vertical faces still read against the flat roofs.
      const sky = new THREE.HemisphereLight(0xffffff, 0x9aa0a6, 1.8);   // first try at 1.1 read too dark
      sky.position.set(0, 0, 1);
      scene.add(sky);
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(0.5, 0.7, 1.0);
      scene.add(sun);

      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      // MapLibre has already drawn the city by the time we run. Clearing here
      // would wipe it out from under the models.
      renderer.autoClear = false;

      for (const item of items.values()) if (item.group) scene.add(item.group);
      map.triggerRepaint();
    },

    render(_gl, args) {
      if (!renderer || !scene.children.length) return;
      // MapLibre 5 passes an options object; older versions passed the matrix
      // itself. Accept either, so a version bump cannot silently blank the layer.
      const m = args?.defaultProjectionData?.mainMatrix ?? args?.mainMatrix ?? args;
      if (!m) return;
      camera.projectionMatrix = new THREE.Matrix4().fromArray(m);
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
      const item = { group: null, visible: true, placement };
      items.set(key, item);
      const model = await loadFile(url);
      const group = new THREE.Group();
      group.add(model);
      group.matrixAutoUpdate = false;
      group.matrix.copy(placementMatrix(placement));
      group.visible = item.visible;
      item.group = group;
      if (scene) { scene.add(group); map.triggerRepaint(); }
      return group;
    },

    has(key) { return items.has(key); },

    /** For checks from the console: the three.js scene. */
    get scene() { return scene; },

    show(key, on) {
      const item = items.get(key);
      if (!item) return;
      item.visible = !!on;
      if (item.group) { item.group.visible = item.visible; map.triggerRepaint(); }
    }
  };
}
