// PubchatEngine — drives the /pubchat/ geofence hotspot experience.
// Loads hotspots.json, watches the user's position (real GPS or SIM marker),
// and emits `pubchat:hotspot-changed` events when the user crosses into or
// out of a hotspot's radius. Unlike TourEngine, it has no popup behavior and
// emits both enter and leave events.

class PubchatEngine {
  constructor(map) {
    this.map = map;
    this.config = null;
    this.hotspots = [];
    this.currentHotspotId = null;

    this._watchId = null;
    this._lastCheck = null;
    this._hereMarker = null;
    this._simulate = false;
    this._simMarker = null;
  }

  // ── Public API ──────────────────────────────────────────────────

  async start(url) {
    const res = await fetch(url);
    this.config = await res.json();
    this.hotspots = this.config.hotspots ?? [];

    const ic = this.config.initialCamera;
    if (ic) {
      this.map.jumpTo({
        center: ic.center,
        zoom: ic.zoom ?? 13,
        pitch: ic.pitch ?? 0,
        bearing: ic.bearing ?? 0,
      });
    }

    this._initHotspotsSource();
    this._initHotspotsLayer();
    this._emit('loaded', { config: this.config });
  }

  requestGeolocation() {
    if (!('geolocation' in navigator)) {
      this._emit('geolocation-unavailable', {});
      return;
    }
    this._watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onPositionError(err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  stopGeolocation() {
    if (this._watchId != null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
  }

  enableSimulateMode(startLngLat) {
    if (this._simulate) return;
    this._simulate = true;
    this.stopGeolocation();

    const el = document.createElement('div');
    el.className = 'pc-simulate-marker';
    el.innerHTML = '<span class="pc-simulate-dot"></span><span class="pc-simulate-label">SIM</span>';

    const start = startLngLat ?? this.config?.initialCamera?.center ?? this.map.getCenter().toArray();
    this._simMarker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(start)
      .addTo(this.map);

    this._simMarker.on('drag', () => {
      const { lng, lat } = this._simMarker.getLngLat();
      this._setSimulatedPosition(lng, lat);
    });
    this._simMarker.on('dragend', () => {
      const { lng, lat } = this._simMarker.getLngLat();
      this._setSimulatedPosition(lng, lat);
    });

    this._setSimulatedPosition(start[0], start[1]);
    this._emit('simulate-enabled', {});
  }

  recenter() {
    const pos = this._lastCheck;
    if (!pos) return;
    this.map.easeTo({ center: [pos.lng, pos.lat], duration: 600 });
  }

  getHotspotById(id) {
    return this.hotspots.find(h => h.id === id) ?? null;
  }

  setPresenceCount(hotspotId, count) {
    if (!this.map.getSource('hotspots')) return;
    let bucket = 'empty';
    if (count >= 3) bucket = 'hot';
    else if (count >= 1) bucket = 'low';
    this.map.setFeatureState(
      { source: 'hotspots', id: hotspotId },
      { presence: bucket, count }
    );
  }

  // ── Geolocation handlers ────────────────────────────────────────

  _onPosition(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    this._updateHereMarker(lng, lat);
    if (!this._firstFix) {
      this._firstFix = true;
      this.map.flyTo({ center: [lng, lat], zoom: 15, pitch: 45, duration: 1200 });
    }
    this._lastCheck = { lng, lat };
    this._emit('position-update', { lng, lat, accuracy, source: 'gps' });
    this._checkHotspots(lng, lat, 'gps');
  }

  _onPositionError(err) {
    console.warn('PubchatEngine: geolocation error', err.message);
    this._emit('geolocation-denied', { error: err.message, code: err.code });
  }

  _setSimulatedPosition(lng, lat) {
    this._lastCheck = { lng, lat };
    this._emit('position-update', { lng, lat, accuracy: null, source: 'simulate' });
    this._checkHotspots(lng, lat, 'simulate');
  }

  _updateHereMarker(lng, lat) {
    if (this._simulate) return;
    if (!this._hereMarker) {
      const el = document.createElement('div');
      el.className = 'pc-here-marker';
      el.innerHTML = '<span class="pc-here-pulse"></span><span class="pc-here-dot"></span>';
      this._hereMarker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(this.map);
    } else {
      this._hereMarker.setLngLat([lng, lat]);
    }
  }

  _checkHotspots(lng, lat, source) {
    // Pick the closest hotspot whose geofence we're inside, if any.
    let best = null;
    for (const h of this.hotspots) {
      if (!h.geofence?.center) continue;
      const [hLng, hLat] = h.geofence.center;
      const d = haversineMeters(lng, lat, hLng, hLat);
      const r = h.geofence.radiusMeters ?? 80;
      if (d <= r) {
        if (!best || d < best.d) best = { hotspot: h, d };
      }
    }

    const nextId = best?.hotspot.id ?? null;
    if (nextId === this.currentHotspotId) return;

    const leftId = this.currentHotspotId;
    this.currentHotspotId = nextId;
    this._emit('hotspot-changed', {
      enteredId: nextId,
      leftId,
      hotspot: best?.hotspot ?? null,
      source,
    });
  }

  // ── Layers ──────────────────────────────────────────────────────

  _initHotspotsSource() {
    const features = this.hotspots
      .filter(h => h.geofence?.center)
      .map(h => ({
        type: 'Feature',
        id: h.id,
        properties: {
          id: h.id,
          title: h.title ?? h.id,
          subtitle: h.subtitle ?? '',
          radiusMeters: h.geofence.radiusMeters ?? 80,
        },
        geometry: { type: 'Point', coordinates: h.geofence.center },
      }));

    if (!this.map.getSource('hotspots')) {
      this.map.addSource('hotspots', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
        promoteId: 'id',
      });
    }
  }

  _initHotspotsLayer() {
    // Meters-accurate circle by converting radius to pixels at current zoom.
    // MapLibre's circle-radius is in px, so we use a style expression that
    // approximates real-world radius via 'circle-radius' interpolated by zoom.
    // For simplicity we set a fixed meter-ish appearance and rely on the zoom
    // level in initialCamera. Authors tune radiusMeters in hotspots.json.
    if (this.map.getLayer('hotspots-fill')) return;

    const presenceColor = [
      'match',
      ['feature-state', 'presence'],
      'hot',   '#e11d74',
      'low',   '#f48bbf',
      'empty', '#9aa3ad',
      /* default (no state yet) */ '#9aa3ad',
    ];

    this.map.addLayer({
      id: 'hotspots-fill',
      type: 'circle',
      source: 'hotspots',
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, 4,
          13, 12,
          15, 22,
          17, 38,
          19, 64,
        ],
        'circle-color': presenceColor,
        'circle-opacity': 0.35,
        'circle-stroke-color': '#1a202c',
        'circle-stroke-width': 4,
        'circle-stroke-opacity': 1,
      },
    });

    // Labels
    this.map.addLayer({
      id: 'hotspots-label',
      type: 'symbol',
      source: 'hotspots',
      layout: {
        'text-field': ['get', 'title'],
        'text-size': 12,
        'text-offset': [0, 1.6],
        'text-anchor': 'top',
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#1c1c28',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.2,
      },
    });

    // Clicking a hotspot zooms to it (helpful for preview mode).
    this.map.on('click', 'hotspots-fill', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const [lng, lat] = f.geometry.coordinates;
      this.map.easeTo({ center: [lng, lat], zoom: Math.max(this.map.getZoom(), 16), duration: 600 });
    });
    this.map.on('mouseenter', 'hotspots-fill', () => { this.map.getCanvas().style.cursor = 'pointer'; });
    this.map.on('mouseleave', 'hotspots-fill', () => { this.map.getCanvas().style.cursor = ''; });
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _emit(name, detail) {
    window.dispatchEvent(new CustomEvent(`pubchat:${name}`, { detail }));
  }
}

// Great-circle distance in metres between two lng/lat pairs.
function haversineMeters(aLng, aLat, bLng, bLat) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat))
          * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
