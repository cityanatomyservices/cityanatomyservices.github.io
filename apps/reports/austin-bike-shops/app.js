let map;
let allFeatures = [];
let filteredFeatures = [];
let currentPopup;
let draw;
let measuring = false;
let contourDemSource;

// --- Theme: apply CONFIG.theme overrides to CSS variables ---

function applyConfigTheme() {
  const t = CONFIG.theme || {};
  const root = document.documentElement.style;
  if (t.headerBg)    root.setProperty("--color-header-bg", t.headerBg);
  if (t.pageBg)      root.setProperty("--color-page-bg",   t.pageBg);
  if (t.fontHeading) {
    root.setProperty("--font-heading", `'${t.fontHeading}', sans-serif`);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.fontHeading)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(l);
  }
  if (t.fontBody) {
    root.setProperty("--font-body", `'${t.fontBody}', Arial, sans-serif`);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.fontBody)}:wght@400;500;600&display=swap`;
    document.head.appendChild(l);
  }
}
applyConfigTheme();

// --- Marker icon SVG by style ---

function makeMarkerSvg(color, style) {
  if (style === "drop") {
    // Water drop with inner ring — pool / water theme
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="36" height="48"><path fill="${color}" fill-rule="evenodd" d="M192 512C86 512 0 426 0 320C0 228.8 130.2 57.7 166.6 11.7C172.2 4.4 181.3 0 192 0s19.8 4.4 25.4 11.7C253.8 57.7 384 228.8 384 320c0 106-86 192-192 192zm72-192a72 72 0 1 0-144 0 72 72 0 0 0 144 0z"/></svg>`;
  }
  if (style === "pin") {
    // Simple map pin
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="36" height="48"><path fill="${color}" d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0z"/></svg>`;
  }
  // default: golf ball tee
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="36" height="48"><path fill="${color}" d="M384 192c0 66.8-34.1 125.6-85.8 160L85.8 352C34.1 317.6 0 258.8 0 192C0 86 86 0 192 0S384 86 384 192zM242.1 256.6c0 18.5-15 33.5-33.5 33.5c-4.9 0-9.1 5.1-5.4 8.4c5.9 5.2 13.7 8.4 22.1 8.4c18.5 0 33.5-15 33.5-33.5c0-8.5-3.2-16.2-8.4-22.1c-3.3-3.7-8.4 .5-8.4 5.4zm-52.3-49.3c-4.9 0-9.1 5.1-5.4 8.4c5.9 5.2 13.7 8.4 22.1 8.4c18.5 0 33.5-15 33.5-33.5c0-8.5-3.2-16.2-8.4-22.1c-3.3-3.7-8.4 .5-8.4 5.4c0 18.5-15 33.5-33.5 33.5zm113.5-17.5c0 18.5-15 33.5-33.5 33.5c-4.9 0-9.1 5.1-5.4 8.4c5.9 5.2 13.7 8.4 22.1 8.4c18.5 0 33.5-15 33.5-33.5c0-8.5-3.2-16.2-8.4-22.1c-3.3-3.7-8.4 .5-8.4 5.4zM96 416c0-17.7 14.3-32 32-32l64 0 64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-16 0c-8.8 0-16 7.2-16 16l0 16c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-16c0-8.8-7.2-16-16-16l-16 0c-17.7 0-32-14.3-32-32z"/></svg>`;
}

// --- Info panel toggle ---

function toggleInfoPanel() {
  document.getElementById("infoPanel").classList.toggle("open");
}

document.addEventListener("click", function (e) {
  if (!e.target.closest(".info-btn-wrap")) {
    const panel = document.getElementById("infoPanel");
    if (panel) panel.classList.remove("open");
  }
});

// --- 2D/3D view toggle ---

let is3D = true;

function initViewToggle() {
  const btn = document.getElementById("viewToggle");
  btn.addEventListener("click", () => {
    is3D = !is3D;
    btn.textContent = is3D ? "2D" : "3D";
    if (is3D) {
      map.easeTo({ pitch: CONFIG.pitch, bearing: CONFIG.bearing, duration: 600 });
      map.setLayoutProperty("3d-buildings", "visibility", "visible");
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      map.setLayoutProperty("3d-buildings", "visibility", "none");
    }
  });
}

// --- Satellite view toggle ---

function initSatellite() {
  map.addSource("satellite", {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    attribution: "Tiles &copy; Esri"
  });

  map.addLayer({
    id: "satellite-layer",
    type: "raster",
    source: "satellite",
    layout: { visibility: "none" }
  }, map.getStyle().layers[1].id);

  map.addControl({
    onAdd() {
      this._container = document.createElement("div");
      this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      this._btn = document.createElement("button");
      this._btn.className = "satellite-btn";
      this._btn.textContent = "Satellite";
      this._btn.onclick = () => {
        const on = map.getLayoutProperty("satellite-layer", "visibility") === "visible";
        map.setLayoutProperty("satellite-layer", "visibility", on ? "none" : "visible");
        this._btn.classList.toggle("active", !on);
      };
      this._container.appendChild(this._btn);
      return this._container;
    },
    onRemove() { this._container.parentNode.removeChild(this._container); }
  }, "top-left");
}

// --- Draw tools (terra-draw) ---

function initDraw() {
  var TD = window.terraDraw;
  var TDA = window.terraDrawMaplibreGlAdapter;

  draw = new TD.TerraDraw({
    adapter: new TDA.TerraDrawMapLibreGLAdapter({ map: map, lib: maplibregl }),
    modes: [
      new TD.TerraDrawLineStringMode()
    ]
  });

  draw.start();

  // Mode buttons
  document.querySelectorAll("[data-draw-mode]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      measuring = false;
      map.getCanvas().style.cursor = "";
      document.getElementById("measureBtn").classList.remove("active");
      draw.setMode(btn.dataset.drawMode);
      document.querySelectorAll("[data-draw-mode]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
  });

  // Clear button
  document.getElementById("clearDrawBtn").addEventListener("click", function () {
    draw.clear();
    document.querySelectorAll("[data-draw-mode]").forEach(function (b) { b.classList.remove("active"); });
  });
}

// --- Measure tool ---

function initMeasure() {
  var pts = [];

  map.addSource("measure-pts",  { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addSource("measure-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  map.addLayer({ id: "measure-line-layer", type: "line", source: "measure-line",
    paint: { "line-color": "#e63946", "line-width": 2, "line-dasharray": [3, 2] } });

  map.addLayer({ id: "measure-pts-layer", type: "circle", source: "measure-pts",
    paint: { "circle-radius": 5, "circle-color": "#e63946", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });

  map.addLayer({ id: "measure-labels-layer", type: "symbol", source: "measure-pts",
    layout: { "text-field": ["get", "label"], "text-size": 12, "text-offset": [0, -1.2], "text-anchor": "bottom" },
    paint: { "text-color": "#222", "text-halo-color": "#fff", "text-halo-width": 2 } });

  function haversine(a, b) {
    var R = 3958.8, toRad = function(x) { return x * Math.PI / 180; };
    var dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0]);
    var x = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function redraw() {
    var total = 0;
    map.getSource("measure-pts").setData({ type: "FeatureCollection", features: pts.map(function(pt, i) {
      if (i > 0) total += haversine(pts[i - 1], pt);
      return { type: "Feature", geometry: { type: "Point", coordinates: pt },
        properties: { label: i === 0 ? "Start" : (total.toFixed(2) + " mi") } };
    })});
    map.getSource("measure-line").setData({ type: "FeatureCollection",
      features: pts.length > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: pts } }] : [] });
  }

  function clearMeasure() { pts = []; redraw(); }

  map.on("click", function(e) {
    if (!measuring) return;
    pts.push([e.lngLat.lng, e.lngLat.lat]);
    redraw();
  });

  var btn = document.getElementById("measureBtn");
  btn.addEventListener("click", function() {
    measuring = !measuring;
    btn.classList.toggle("active", measuring);
    map.getCanvas().style.cursor = measuring ? "crosshair" : "";
    if (measuring && draw) {
      draw.setMode("static");
      document.querySelectorAll("[data-draw-mode]").forEach(function(b) { b.classList.remove("active"); });
    }
  });

  document.getElementById("clearDrawBtn").addEventListener("click", clearMeasure);
}

// --- Buildings toggle ---

function initBuildingsToggle() {
  // Collect all building-related layer ids from the style + our custom 3d layer
  const buildingLayers = map.getStyle().layers
    .filter(l => l.id.includes("building"))
    .map(l => l.id)
    .concat(["3d-buildings"]);

  map.addControl({
    onAdd() {
      this._container = document.createElement("div");
      this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      var lbl = document.createElement("label");
      lbl.className = "overlay-ctrl-label";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.addEventListener("change", function () {
        const vis = this.checked ? "visible" : "none";
        buildingLayers.forEach(id => {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
        });
      });
      var span = document.createElement("span");
      span.textContent = "Buildings";
      lbl.appendChild(checkbox);
      lbl.appendChild(span);
      this._container.appendChild(lbl);
      return this._container;
    },
    onRemove() { this._container.parentNode.removeChild(this._container); }
  }, "bottom-left");
}

// --- USGS Topo overlay + elevation exaggeration ---

// --- Always-on terrain + hillshade ---

function initDefaultTerrain() {
  // AWS Terrarium tiles — higher resolution, good coverage for Austin
  map.addSource("terrain-dem", {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    tileSize: 256,
    encoding: "terrarium",
    maxzoom: 14
  });

  map.addLayer({
    id: "hillshade-layer",
    type: "hillshade",
    source: "terrain-dem",
    layout: { visibility: "visible" },
    paint: {
      "hillshade-shadow-color": "#473B24",
      "hillshade-highlight-color": "#ffffff",
      "hillshade-accent-color": "#5a714c",
      "hillshade-illumination-direction": 335,
      "hillshade-exaggeration": 0.3
    }
  });

  // Enable terrain with subtle exaggeration (always on)
  function enableDefaultTerrain() {
    map.setTerrain({ source: "terrain-dem", exaggeration: 1 });
  }

  if (map.isSourceLoaded("terrain-dem")) {
    enableDefaultTerrain();
  } else {
    map.on("sourcedata", function onDemReady(e) {
      if (e.sourceId === "terrain-dem" && map.isSourceLoaded("terrain-dem")) {
        map.off("sourcedata", onDemReady);
        enableDefaultTerrain();
      }
    });
  }
}

// --- Topo overlay (contour lines + terrain exaggeration) ---

function initTopoOverlay() {
  if (!contourDemSource) return;

  map.addSource("contour-source", {
    type: "vector",
    tiles: [contourDemSource.contourProtocolUrl({
      multiplier: 3.28084,
      overzoom: 1,
      thresholds: {
        11: [200, 1000],
        12: [100, 500],
        13: [100, 500],
        14: [50, 200],
        15: [20, 100]
      },
      elevationKey: "ele",
      levelKey: "level",
      contourLayer: "contours"
    })],
    maxzoom: 15
  });

  map.addLayer({
    id: "contour-lines",
    type: "line",
    source: "contour-source",
    "source-layer": "contours",
    layout: { visibility: "none" },
    paint: {
      "line-color": "#5a3a1a",
      "line-opacity": 0.7,
      "line-width": ["match", ["get", "level"], 1, 2, 0.8]
    }
  });

  map.addLayer({
    id: "contour-labels",
    type: "symbol",
    source: "contour-source",
    "source-layer": "contours",
    filter: [">", ["get", "level"], 0],
    layout: {
      visibility: "none",
      "symbol-placement": "line",
      "text-size": 12,
      "text-field": ["concat", ["number-format", ["get", "ele"], {}], "'"],
      "text-font": ["Noto Sans Regular"]
    },
    paint: {
      "text-color": "#5a3a1a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5
    }
  });

  map.addControl({
    onAdd() {
      this._container = document.createElement("div");
      this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      var lbl = document.createElement("label");
      lbl.className = "overlay-ctrl-label";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";

      checkbox.addEventListener("change", function () {
        var vis = this.checked ? "visible" : "none";
        if (map.getLayer("contour-lines")) map.setLayoutProperty("contour-lines", "visibility", vis);
        if (map.getLayer("contour-labels")) map.setLayoutProperty("contour-labels", "visibility", vis);
        map.setTerrain({ source: "terrain-dem", exaggeration: this.checked ? 2 : 1 });
      });

      var span = document.createElement("span");
      span.textContent = "Topo";
      lbl.appendChild(checkbox);
      lbl.appendChild(span);
      this._container.appendChild(lbl);
      return this._container;
    },
    onRemove() { this._container.parentNode.removeChild(this._container); }
  }, "bottom-left");
}

// --- Polygon overlays + Layers panel ---

function initLayersPanel() {
  if (!CONFIG.overlays || CONFIG.overlays.length === 0) return;

  var layersPanelEl;
  map.addControl({
    onAdd() {
      this._container = document.createElement("div");
      this._container.className = "maplibregl-ctrl maplibregl-ctrl-group layers-ctrl";

      var btn = document.createElement("button");
      btn.className = "satellite-btn layers-btn";
      btn.textContent = "Layers";
      btn.setAttribute("aria-label", "Toggle overlay layers");

      layersPanelEl = document.createElement("div");
      layersPanelEl.className = "layers-panel";

      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        layersPanelEl.classList.toggle("open");
      });

      this._container.appendChild(btn);
      this._container.appendChild(layersPanelEl);
      return this._container;
    },
    onRemove() { this._container.parentNode.removeChild(this._container); }
  }, "top-left");

  // Close panel when clicking outside
  document.addEventListener("click", function(e) {
    if (layersPanelEl && !e.target.closest(".layers-ctrl")) {
      layersPanelEl.classList.remove("open");
    }
  });
}

async function addOverlayControl(geojsonPath, sourceId, label, colorProperty) {
  var res;
  try { res = await fetch(geojsonPath); } catch (e) {
    console.warn("Overlay fetch error:", geojsonPath, e); return;
  }
  if (!res.ok) {
    console.warn("Overlay fetch failed:", geojsonPath, res.status); return;
  }
  var data = await res.json();

  var palette = ["#4285f4","#ea4335","#fbbc04","#34a853","#ff6d00","#46bdc6","#7b1fa2","#f06292"];
  var colorExpr = "#4285f4";

  if (colorProperty) {
    var uniqueVals = [...new Set(data.features.map(function(f) { return f.properties[colorProperty]; }))];
    var matchExpr = ["match", ["get", colorProperty]];
    uniqueVals.forEach(function(val, i) { matchExpr.push(val, palette[i % palette.length]); });
    matchExpr.push("#888");
    colorExpr = matchExpr;
  }

  var firstLabelLayer = map.getStyle().layers.find(
    function(l) { return l.type === "symbol" && l.layout && l.layout["text-field"]; }
  );
  var beforeLayer = firstLabelLayer ? firstLabelLayer.id : undefined;

  try {
    map.addSource(sourceId, { type: "geojson", data: data });
    map.addLayer({ id: sourceId + "-fill", type: "fill", source: sourceId,
      layout: { visibility: "none" },
      paint: { "fill-color": colorExpr, "fill-opacity": 0.2 }
    }, beforeLayer);
    map.addLayer({ id: sourceId + "-line", type: "line", source: sourceId,
      layout: { visibility: "none" },
      paint: { "line-color": colorExpr, "line-width": 1.5 }
    }, beforeLayer);
    if (colorProperty) {
      map.addLayer({ id: sourceId + "-labels", type: "symbol", source: sourceId,
        layout: {
          visibility: "none",
          "text-field": ["get", colorProperty],
          "text-size": 11,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
          "text-max-width": 8
        },
        paint: { "text-color": "#222", "text-halo-color": "#fff", "text-halo-width": 1.5 }
      }, beforeLayer);
    }
  } catch (e) {
    console.error("Overlay layer error:", sourceId, e); return;
  }

  // Append checkbox into the shared Layers panel
  var panel = document.querySelector(".layers-panel");
  if (!panel) return;

  var lbl = document.createElement("label");
  lbl.className = "overlay-ctrl-label";
  var checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.addEventListener("change", function () {
    var vis = this.checked ? "visible" : "none";
    map.setLayoutProperty(sourceId + "-fill", "visibility", vis);
    map.setLayoutProperty(sourceId + "-line", "visibility", vis);
    if (colorProperty) map.setLayoutProperty(sourceId + "-labels", "visibility", vis);
  });
  var span = document.createElement("span");
  span.textContent = label;
  lbl.appendChild(checkbox);
  lbl.appendChild(span);
  panel.appendChild(lbl);
}

async function initOverlay() {
  if (!CONFIG.overlays || CONFIG.overlays.length === 0) return;
  for (var i = 0; i < CONFIG.overlays.length; i++) {
    var ov = CONFIG.overlays[i];
    await addOverlayControl(ov.file, "overlay" + i, ov.label, ov.colorProperty);
  }
}

// --- Theme toggle ---

function initTheme() {
  const btn = document.getElementById("themeToggle");
  const saved = localStorage.getItem("theme") || "light";
  applyTheme(saved);
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("theme", next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  // Show sun when dark (click to go light), moon when light (click to go dark)
  btn.textContent = theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
}

async function init() {
  // initTheme() and initReportModal() are not called: the dark-mode button and
  // the report modal are both gone from the page.

  // Set page text from config
  document.getElementById("pageTitle").textContent = CONFIG.title;
  document.title = CONFIG.title;

  // Info panel text from config
  const infoEl = document.getElementById("infoPanelText");
  if (infoEl && CONFIG.infoPanelText) infoEl.textContent = CONFIG.infoPanelText;

  // Set up maplibre-contour DEM source (registers custom protocol)
  if (window.mlcontour && !contourDemSource) {
    contourDemSource = new mlcontour.DemSource({
      url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      encoding: "terrarium",
      maxzoom: 14,
      worker: true
    });
    contourDemSource.setupMaplibre(maplibregl);
  }

  // Create map
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    pitch: CONFIG.pitch,
    bearing: CONFIG.bearing,
    maxBounds: CONFIG.maxBounds || undefined,
    antialias: true,
    preserveDrawingBuffer: true
  });


  // Load GeoJSON
  const response = await fetch("./data.geojson");
  const geojson = await response.json();
  allFeatures = geojson.features;

  map.on("load", () => {
    add3DBuildings();
    // Map content only. Every control initialiser is deliberately NOT called
    // (owner, 2026-09-10) — no satellite, layers, buildings, topo, 2D/3D,
    // draw, measure or overlay buttons. Their functions are still in this file,
    // so turning one back on is one line here, not a rewrite.
    initSkyAndLighting();
    applyStandardColors();
    initDefaultTerrain();
    addPlacesLayers();     // puts data.geojson on the map
    buildFilters();        // no filter UI on the page: returns immediately
    buildTableHead();      // no table on the page: returns immediately
    applyFilters();        // nothing to filter, so this plots every feature
  });
}

// --- 3D Buildings ---

function add3DBuildings() {
  const layers = map.getStyle().layers;
  let labelLayerId;
  for (const layer of layers) {
    if (layer.type === "symbol" && layer.layout && layer.layout["text-field"]) {
      labelLayerId = layer.id;
      break;
    }
  }

  map.addLayer(
    {
      id: "3d-buildings",
      source: "openmaptiles",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 13,
      paint: {
        // Height-based color: short=warm light gray, mid=cooler, tall=cool taupe
        "fill-extrusion-color": [
          "interpolate", ["linear"],
          ["coalesce", ["to-number", ["get", "render_height"]], 0],
          0,   "#d9d6cf",
          50,  "#cfcac0",
          200, "#bfb8ab"
        ],
        // Smooth fade-in: buildings grow over a wider zoom range
        "fill-extrusion-height": [
          "interpolate", ["linear"], ["zoom"],
          14, 0,
          16, ["coalesce", ["to-number", ["get", "render_height"]], 0]
        ],
        "fill-extrusion-base": [
          "interpolate", ["linear"], ["zoom"],
          14, 0,
          16, ["coalesce", ["to-number", ["get", "render_min_height"]], 0]
        ],
        "fill-extrusion-opacity": 0.9,
        "fill-extrusion-vertical-gradient": true
      }
    },
    labelLayerId
  );
}

// --- Sky, Lighting & Atmosphere ---

function initSkyAndLighting() {
  map.setSky({
    "sky-color": "#88C6FC",
    "horizon-color": "#f0e8d8",
    "fog-color": "#e8e0d8",
    "fog-ground-blend": 0.1,
    "horizon-fog-blend": 0.8,
    "sky-horizon-blend": 0.5
  });
  map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.4, position: [1.5, 210, 30] });
}

// --- Color Refinement (Mapbox Standard palette) ---

function applyStandardColors() {
  // Background — cooler gray-cream
  if (map.getLayer("background")) map.setPaintProperty("background", "background-color", "#f1f0ec");

  // Water — softer blue with subtle highlight outline
  if (map.getLayer("water")) {
    map.setPaintProperty("water", "fill-color", "#9cb8e8");
    map.setPaintProperty("water", "fill-outline-color", "#85a8d8");
  }

  // Parks — softer green
  if (map.getLayer("park")) map.setPaintProperty("park", "fill-color", "#c8e6c0");

  // Buildings 2D — cooler gray
  if (map.getLayer("building")) map.setPaintProperty("building", "fill-color", "#e0ddd8");

  // Roads — muted palette (iterate relevant road layers)
  var roadFills = map.getStyle().layers.filter(function(l) {
    return l.type === "line" && /^(road|highway)/.test(l.id) && !/_casing/.test(l.id) && !/bridge/.test(l.id) && !/tunnel/.test(l.id);
  });
  roadFills.forEach(function(l) {
    try { map.setPaintProperty(l.id, "line-color", "#f0e8d0"); } catch(e) {}
  });

  // Road casings — subtle gray
  var roadCasings = map.getStyle().layers.filter(function(l) {
    return l.type === "line" && /_casing/.test(l.id);
  });
  roadCasings.forEach(function(l) {
    try { map.setPaintProperty(l.id, "line-color", "#d8d0c4"); } catch(e) {}
  });

  // Label hierarchy — bold important labels, soften secondary ones
  ["label_city", "label_city_capital", "label_town"].forEach(function(id) {
    if (map.getLayer(id)) {
      try {
        map.setPaintProperty(id, "text-color", "#1a1a1a");
        map.setPaintProperty(id, "text-halo-color", "#ffffff");
        map.setPaintProperty(id, "text-halo-width", 1.5);
      } catch(e) {}
    }
  });
  ["label_village", "label_other"].forEach(function(id) {
    if (map.getLayer(id)) {
      try {
        map.setPaintProperty(id, "text-color", "#666666");
        map.setPaintProperty(id, "text-halo-width", 1);
      } catch(e) {}
    }
  });
}

// --- Places source + marker layers ---

function addPlacesLayers() {
  map.addSource("places", {
    type: "geojson",
    data: { type: "FeatureCollection", features: allFeatures }
  });

  // Load marker SVG as a map icon, then add the symbol layer
  const svgSrc = makeMarkerSvg(CONFIG.markerColor, CONFIG.markerIconStyle);
  const img = new Image(36, 48);
  img.onload = () => {
    if (!map.hasImage("marker-icon")) map.addImage("marker-icon", img);
    map.addLayer({
      id: "places-layer",
      type: "symbol",
      source: "places",
      layout: {
        "icon-image": "marker-icon",
        "icon-size": 0.75,
        "icon-anchor": "bottom",
        "icon-allow-overlap": true
      }
    });
    map.on("click", "places-layer", (e) => { showPopup(e.features[0]); });
    map.on("mouseenter", "places-layer", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "places-layer", () => { map.getCanvas().style.cursor = ""; });
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgSrc);
}

// --- Popup (shared between map click and table click) ---

function switchPopupTab(btn, paneId) {
  const content = btn.closest(".maplibregl-popup-content");
  content.querySelectorAll(".popup-tab-btn").forEach(b => b.classList.remove("active"));
  content.querySelectorAll(".popup-tab-pane").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  content.querySelector("#" + paneId).classList.add("active");
  // Lazy-load the Street View iframe on first click to avoid wasting API quota
  if (paneId === "popup-pane-sv") {
    const iframe = content.querySelector(".sv-iframe");
    if (iframe && !iframe.src) iframe.src = iframe.dataset.src;
  }
}

function renderValue(val, property) {
  if (property === "instagram" && val) {
    return `<a href="https://instagram.com/${val}" target="_blank" rel="noopener">@${val}</a>`;
  }
  if (typeof val === "string" && val.startsWith("http")) {
    return `<a href="${val}" target="_blank" rel="noopener">${val}</a>`;
  }
  return val;
}

function showPopup(feature) {
  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const name = props[CONFIG.nameField] || "";

  // --- Info tab ---
  const rows = CONFIG.popupFields
    .filter(f => props[f.property] !== null && props[f.property] !== undefined && props[f.property] !== "")
    .map(f => {
      let val = props[f.property];
      if (f.property === "inspection_score") {
        const n = Number(val);
        const cls = n >= 90 ? "score-badge-green" : n >= 70 ? "score-badge-yellow" : "score-badge-red";
        val = `<span class="score-badge ${cls}">${n}/100</span>`;
      } else {
        val = renderValue(val, f.property);
      }
      return `<div class="popup-row"><strong>${f.label}:</strong>&nbsp;${val}</div>`;
    })
    .join("");

  const navHtml = `
    <div class="popup-nav">
      <a class="popup-nav-google" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener">Google</a>
      <a class="popup-nav-apple" href="https://maps.apple.com/?q=${lat},${lng}" target="_blank" rel="noopener">Apple</a>
      <a class="popup-nav-waze" href="https://waze.com/ul?ll=${lat},${lng}&navigate=yes" target="_blank" rel="noopener">Waze</a>
      <a class="popup-nav-reddit" href="https://www.reddit.com/search/?q=${encodeURIComponent(name + (CONFIG.redditCity ? ' ' + CONFIG.redditCity : ''))}" target="_blank" rel="noopener">Reddit</a>
    </div>`;

  // --- Course App tab ---
  const svContent = ``;

  const html = `
    <div class="popup-title">${name}</div>
    <div class="popup-tab-bar">
      <button class="popup-tab-btn active" onclick="switchPopupTab(this,'popup-pane-info')">Info</button>
      <button class="popup-tab-btn" onclick="switchPopupTab(this,'popup-pane-sv')">Course App</button>
    </div>
    <div id="popup-pane-info" class="popup-tab-pane active">
      ${rows}${navHtml}
    </div>
    <div id="popup-pane-sv" class="popup-tab-pane">
      ${svContent}
    </div>`;

  if (currentPopup) currentPopup.remove();

  currentPopup = new maplibregl.Popup({ maxWidth: "300px" })
    .setLngLat([lng, lat])
    .setHTML(html)
    .addTo(map);
}

// --- Filters (built dynamically from CONFIG.filters) ---

function buildFilters() {
  // No filter UI on this page yet (owner, 2026-09-10: "once we have those done
  // we will consider how to filter it"). With nothing to build, every feature
  // stays visible — applyFilters() finds no selects and filters nothing.
  const container = document.getElementById("filters");
  if (!container) return;
  container.innerHTML = "";

  CONFIG.filters.forEach(f => {
    const group = document.createElement("div");
    group.className = "filter-group";

    const label = document.createElement("label");
    label.textContent = f.label;

    const select = document.createElement("select");
    select.dataset.property = f.property;

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";
    select.appendChild(allOption);

    getUniqueValues(f.property).forEach(val => {
      const option = document.createElement("option");
      option.value = val;
      option.textContent = val;
      select.appendChild(option);
    });

    select.addEventListener("change", applyFilters);

    group.appendChild(label);
    group.appendChild(select);
    container.appendChild(group);
  });
}

function getUniqueValues(property) {
  const values = allFeatures.map(f => f.properties[property]);
  return [...new Set(values)].sort();
}

// --- Filter logic ---

function applyFilters() {
  const selects = document.querySelectorAll("#filters select");
  const activeFilters = [];

  selects.forEach(select => {
    if (select.value !== "all") {
      activeFilters.push({ property: select.dataset.property, value: select.value });
    }
  });

  const filtered = allFeatures.filter(feature => {
    const p = feature.properties;
    return activeFilters.every(f => p[f.property] === f.value);
  });

  filteredFeatures = filtered;
  updateMap(filtered);
  updateTable(filtered);
  updateCount(filtered);
  fitMapToFeatures(filtered);
}

// --- Map update ---

function updateMap(features) {
  const source = map.getSource("places");
  if (!source) return;
  source.setData({ type: "FeatureCollection", features });
}

// --- Table (built dynamically from CONFIG.columns) ---

function buildTableHead() {
  const thead = document.getElementById("tableHead");
  if (!thead) return;   // no table on this page
  const tr = document.createElement("tr");

  CONFIG.columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col.header;
    tr.appendChild(th);
  });

  thead.innerHTML = "";
  thead.appendChild(tr);
}

function updateTable(features) {
  const tableBody = document.getElementById("tableBody");
  if (!tableBody) return;   // no table on this page
  tableBody.innerHTML = "";

  features.forEach(feature => {
    const p = feature.properties;
    const row = document.createElement("tr");

    CONFIG.columns.forEach(col => {
      const td = document.createElement("td");
      // The side panel is too narrow for a real table, so it stacks each row
      // into a labelled record (style.css). The label comes from here.
      td.dataset.label = col.header;
      const val = p[col.property] ?? "";
      if (col.property === "instagram" && val) {
        const a = document.createElement("a");
        a.href = `https://instagram.com/${val}`;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = `@${val}`;
        td.appendChild(a);
      } else if (typeof val === "string" && val.startsWith("http")) {
        const a = document.createElement("a");
        a.href = val;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = val;
        td.appendChild(a);
      } else {
        td.textContent = val;
      }
      row.appendChild(td);
    });

    row.addEventListener("click", () => {
      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 15.5,
        pitch: 50,
        bearing: -10,
        duration: 1500,
        essential: true
      });
      showPopup(feature);
    });

    tableBody.appendChild(row);
  });
}

// --- Count ---

function updateCount(features) {
  const el = document.getElementById("resultCount");
  if (!el) return;   // no count on this page
  el.textContent = `${features.length} results`;
}

// --- Fit bounds ---

function fitMapToFeatures(features) {
  if (features.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();
  features.forEach(f => bounds.extend(f.geometry.coordinates));

  map.fitBounds(bounds, {
    padding: 60,
    maxZoom: 15,
    pitch: CONFIG.pitch,
    bearing: CONFIG.bearing,
    duration: 800
  });
}

// --- Report modal ---

function initReportModal() {
  if (!document.getElementById("reportModal")) return;   // no report UI here
  var list = document.getElementById("reportFieldList");
  CONFIG.columns.forEach(function(col) {
    var label = document.createElement("label");
    label.className = "report-field-item";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = col.property;
    cb.dataset.header = col.header;
    cb.addEventListener("change", updateReportModalState);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + col.header));
    list.appendChild(label);
  });
  document.getElementById("reportCancelBtn").addEventListener("click", closeReportModal);
  document.getElementById("reportGenerateBtn").addEventListener("click", function() {
    var selected = [...document.querySelectorAll("#reportFieldList input:checked")]
      .map(function(cb) { return { property: cb.value, header: cb.dataset.header }; });
    closeReportModal();
    generateReport(selected);
  });
}

function openReportModal() {
  document.getElementById("reportModal").style.display = "flex";
}

function closeReportModal() {
  document.getElementById("reportModal").style.display = "none";
  document.querySelectorAll("#reportFieldList input").forEach(function(cb) {
    cb.checked = false;
    cb.disabled = false;
  });
  document.getElementById("reportGenerateBtn").disabled = true;
}

function updateReportModalState() {
  var checkboxes = [...document.querySelectorAll("#reportFieldList input")];
  var checked = checkboxes.filter(function(cb) { return cb.checked; });
  checkboxes.forEach(function(cb) {
    cb.disabled = checked.length >= 3 && !cb.checked;
  });
  document.getElementById("reportGenerateBtn").disabled = checked.length === 0;
}

function generateReport(selectedColumns) {
  if (!window.jspdf) {
    alert("PDF library not loaded. Please refresh the page and try again.");
    return;
  }
  map.once("render", function() {
    try {
      var canvas = map.getCanvas();
      var imgData = canvas.toDataURL("image/png");
      var { jsPDF } = window.jspdf;

      var pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      var margin = 12;
      var usableW = pageW - margin * 2;
      var MAX_CHARS = 150;

      // Title
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(CONFIG.title, margin, margin + 5);

      // Map image — fill ~52% of page height, maintain aspect ratio
      var mapY = margin + 12;
      var maxMapH = pageH * 0.52;
      var aspect = canvas.height / canvas.width;
      var mapH = Math.min(usableW * aspect, maxMapH);
      pdf.addImage(imgData, "PNG", margin, mapY, usableW, mapH);

      // Table
      var colW = usableW / selectedColumns.length;
      var y = mapY + mapH + 8;

      // Header row
      pdf.setFillColor(235, 235, 235);
      pdf.rect(margin, y - 4, usableW, 7, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(80);
      selectedColumns.forEach(function(col, i) {
        pdf.text(col.header.toUpperCase(), margin + i * colW + 2, y);
      });
      y += 6;

      // Data rows
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0);
      filteredFeatures.forEach(function(f) {
        if (y > pageH - margin) { pdf.addPage(); y = margin + 8; }
        var p = f.properties;
        selectedColumns.forEach(function(col, i) {
          var val = (p[col.property] ?? "").toString();
          if (val.length > MAX_CHARS) val = val.slice(0, MAX_CHARS - 1) + "\u2026";
          pdf.text(val, margin + i * colW + 2, y, { maxWidth: colW - 4 });
        });
        y += 6;
      });

      pdf.save(CONFIG.title.replace(/[^a-z0-9]/gi, "_") + "_report.pdf");
    } catch (e) {
      console.error("Report generation failed:", e);
      alert("Could not generate report: " + e.message);
    }
  });
  map.triggerRepaint();
}

// --- Export map as PNG ---

function exportMap() {
  map.once("render", function () {
    var canvas = map.getCanvas();
    var link = document.createElement("a");
    link.download = CONFIG.title.replace(/[^a-z0-9]/gi, "_") + "_map.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
  map.triggerRepaint();
}

// --- CSV export (filtered table) ---

function exportCSV() {
  const csvColumns = CONFIG.columns.filter(c => c.csv !== false);
  const headers = csvColumns.map(c => c.header);
  const rows = filteredFeatures.map(f => {
    const p = f.properties;
    return csvColumns.map(c => {
      let val = (p[c.property] ?? "").toString();
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${CONFIG.title.replace(/[^a-z0-9]/gi, "_")}_export.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

init();
