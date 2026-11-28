// drawer.js — controller for the right-hand parcel report drawer.
// No-ops gracefully when there is no #drawer in the DOM (e.g. on the
// /parcels/embed.html hero embed), so app.js can fall back to its
// click-popup path without branching.
//
// Public surface:
//   ParcelDrawer.mount()                       // idempotent
//   ParcelDrawer.isMounted                     // boolean
//   ParcelDrawer.openForParcel(parcelId)       // selects Constraints by default
//   ParcelDrawer.close()
//   ParcelDrawer.setActiveTab('constraints'|'cases'|'ask')

(function () {
  let mounted = false;
  let elDrawer  = null;
  let elClose   = null;
  let elTabs    = [];
  let elPanels  = [];
  let elParcelId = null;
  let activeTab = 'constraints';
  let currentParcelId = null;
  // Cache last response per parcel so re-opening the same parcel feels instant.
  const cache = { constraints: new Map() };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmtNumber(n) {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('en-US');
  }

  function fmtPct(n) {
    if (n == null) return '—';
    return Number(n) + '%';
  }

  function fmtFt(n) {
    if (n == null) return '—';
    return Number(n) + ' ft';
  }

  function setActiveTab(name) {
    if (!mounted) return;
    activeTab = name;
    elTabs.forEach(t => {
      const isActive = t.dataset.tab === name;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', String(isActive));
    });
    elPanels.forEach(p => {
      const isActive = p.dataset.panel === name;
      p.classList.toggle('is-active', isActive);
      p.hidden = !isActive;
    });
  }

  function open() {
    if (!mounted) return;
    document.body.classList.add('drawer-open');
    elDrawer.inert = false;
    elDrawer.setAttribute('aria-hidden', 'false');
    elDrawer.classList.add('is-open');
  }

  function close() {
    if (!mounted) return;
    document.body.classList.remove('drawer-open');
    elDrawer.classList.remove('is-open');
    elDrawer.inert = true;
    elDrawer.setAttribute('aria-hidden', 'true');
    elDrawer.style.transform = '';
  }

  // ----- panel renderers --------------------------------------------------

  function renderConstraintsPanel(panel, data) {
    const body  = $('.panel-body', panel);
    const err   = $('.panel-error', panel);
    err.hidden  = true;
    err.textContent = '';

    if (!data || data.error === 'parcel_not_found') {
      body.innerHTML = `<p class="tab-empty">No record for parcel <code>${escapeHtml(currentParcelId)}</code> in the database.</p>`;
      return;
    }

    const parts = [];

    // Header summary
    const lotAcres = data.lot_area_acres != null ? Number(data.lot_area_acres).toFixed(3) : '—';
    parts.push(
      `<dl class="constraints-grid">
         <dt>Zoning</dt><dd>${data.zoning ? escapeHtml(data.zoning) : '<em>unknown</em>'}${
            data.rules && data.rules.display_name
              ? ` <span class="muted">— ${escapeHtml(data.rules.display_name)}</span>` : ''
         }</dd>
         <dt>Lot area</dt><dd>${fmtNumber(data.lot_area_sqft)} sq ft <span class="muted">(${lotAcres} ac)</span></dd>`
       + (data.zoning_overlay ? `<dt>Overlay</dt><dd>${escapeHtml(data.zoning_overlay)}</dd>` : '')
       + `</dl>`
    );

    if (data.rules && data.computed) {
      const r = data.rules, c = data.computed;
      parts.push(
        `<h3 class="panel-section-title">Computed envelope</h3>
         <dl class="constraints-grid">
           ${c.max_floor_area_sqft != null
              ? `<dt>Max floor area</dt><dd>${fmtNumber(c.max_floor_area_sqft)} sq ft <span class="muted">(FAR ${r.far})</span></dd>` : ''}
           ${c.max_impervious_sqft != null
              ? `<dt>Max impervious</dt><dd>${fmtNumber(c.max_impervious_sqft)} sq ft <span class="muted">(${fmtPct(r.impervious_pct)})</span></dd>` : ''}
           ${c.max_building_sqft != null
              ? `<dt>Max building cover</dt><dd>${fmtNumber(c.max_building_sqft)} sq ft <span class="muted">(${fmtPct(r.building_pct)})</span></dd>` : ''}
           ${c.max_height_ft != null
              ? `<dt>Max height</dt><dd>${fmtFt(c.max_height_ft)}</dd>` : ''}
           ${c.max_units != null
              ? `<dt>Max dwelling units</dt><dd>${fmtNumber(c.max_units)} <span class="muted">(${r.max_units_per_acre}/ac)</span></dd>` : ''}
         </dl>`
      );

      parts.push(
        `<h3 class="panel-section-title">Setbacks</h3>
         <dl class="constraints-grid">
           <dt>Front</dt><dd>${fmtFt(r.front_setback_ft)}</dd>
           <dt>Side</dt><dd>${fmtFt(r.side_setback_ft)}</dd>
           <dt>Rear</dt><dd>${fmtFt(r.rear_setback_ft)}</dd>
           ${r.min_lot_sqft != null ? `<dt>Minimum lot</dt><dd>${fmtNumber(r.min_lot_sqft)} sq ft</dd>` : ''}
         </dl>`
      );

      if (r.notes) {
        parts.push(`<p class="panel-note"><strong>Note:</strong> ${escapeHtml(r.notes)}</p>`);
      }
      parts.push(`<p class="panel-source">Source: ${escapeHtml(r.source_citation)}.</p>`);
    } else if (data.zoning) {
      parts.push(`<p class="panel-warning">No development-standards row for zoning code <code>${escapeHtml(data.zoning)}</code> in the LDC seed table. Add a row to <code>austin_zoning_rules</code> to surface FAR/setbacks here.</p>`);
    } else {
      parts.push(`<p class="panel-warning">Zoning is unknown for this parcel — typically because the centroid lands in a right-of-way or annexation gap.</p>`);
    }

    if (Array.isArray(data.warnings) && data.warnings.length) {
      const items = data.warnings
        .filter(w => !/^overlay_present:/.test(w)) // already shown
        .map(w => `<li>${escapeHtml(w)}</li>`)
        .join('');
      if (items) parts.push(`<ul class="panel-warnings">${items}</ul>`);
    }

    body.innerHTML = parts.join('');
  }

  // ----- per-tab loaders --------------------------------------------------

  async function loadConstraints(parcelId) {
    const panel = elPanels.find(p => p.dataset.panel === 'constraints');
    if (!panel) return;
    const loading = $('.panel-loading', panel);
    const err     = $('.panel-error', panel);
    const body    = $('.panel-body', panel);

    if (cache.constraints.has(parcelId)) {
      loading.hidden = true;
      renderConstraintsPanel(panel, cache.constraints.get(parcelId));
      return;
    }

    body.innerHTML = '';
    err.hidden = true;
    loading.hidden = false;

    try {
      const data = await window.ParcelAPI.getConstraints(parcelId);
      cache.constraints.set(parcelId, data);
      // Only render if the user hasn't switched parcels in the meantime.
      if (parcelId === currentParcelId) renderConstraintsPanel(panel, data);
    } catch (e) {
      if (parcelId !== currentParcelId) return;
      err.textContent = (e && e.message) ? e.message : 'Lookup failed';
      err.hidden = false;
    } finally {
      if (parcelId === currentParcelId) loading.hidden = true;
    }
  }

  // ----- public API -------------------------------------------------------

  function openForParcel(parcelId) {
    if (!mounted) return false;
    currentParcelId = String(parcelId);
    elParcelId.textContent = currentParcelId;
    open();
    setActiveTab(activeTab || 'constraints');
    if (activeTab === 'constraints') loadConstraints(currentParcelId);
    return true;
  }

  function mount() {
    if (mounted) return true;
    elDrawer = document.getElementById('drawer');
    if (!elDrawer) return false;
    elClose    = document.getElementById('drawer-close');
    elTabs     = $$('.tab', elDrawer);
    elPanels   = $$('.tab-panel', elDrawer);
    elParcelId = document.getElementById('drawer-parcel-id');

    elClose && elClose.addEventListener('click', close);

    elTabs.forEach(t => {
      t.addEventListener('click', () => {
        const name = t.dataset.tab;
        setActiveTab(name);
        if (name === 'constraints' && currentParcelId) loadConstraints(currentParcelId);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elDrawer.classList.contains('is-open')) close();
    });

    // Swipe-to-close gesture.
    // Desktop: drag the handle rightward. Mobile: swipe anywhere on the drawer.
    // Distinguishes horizontal swipe from vertical scroll by checking which
    // axis moves first.
    (function wireSwipe() {
      let startX = null, startY = null, dragging = false;

      function onDown(clientX, clientY) {
        startX = clientX; startY = clientY; dragging = false;
      }
      function onMove(clientX, clientY, preventDefault) {
        if (startX === null) return;
        const dx = clientX - startX;
        const dy = Math.abs(clientY - startY);
        if (!dragging) {
          if (dy > 8)  { startX = null; return; }   // vertical scroll wins
          if (dx > 8)  dragging = true;
        }
        if (dragging && dx > 0) {
          preventDefault();
          elDrawer.style.transform = `translateX(${dx}px)`;
        }
      }
      function onUp(clientX) {
        if (!dragging) { startX = null; return; }
        const dx = clientX - startX;
        startX = null; dragging = false;
        elDrawer.style.transform = '';
        if (dx > 80) close();
      }
      function onCancel() {
        startX = null; dragging = false;
        elDrawer.style.transform = '';
      }

      // Handle (desktop pointer events)
      const handle = elDrawer.querySelector('.drawer-handle');
      if (handle) {
        handle.addEventListener('pointerdown', e => {
          onDown(e.clientX, e.clientY);
          handle.setPointerCapture(e.pointerId);
        });
        handle.addEventListener('pointermove', e => onMove(e.clientX, e.clientY, () => e.preventDefault()));
        handle.addEventListener('pointerup',   e => onUp(e.clientX));
        handle.addEventListener('pointercancel', onCancel);
      }

      // Full drawer (touch events on mobile)
      elDrawer.addEventListener('touchstart', e => {
        const t = e.touches[0];
        onDown(t.clientX, t.clientY);
      }, { passive: true });
      elDrawer.addEventListener('touchmove', e => {
        const t = e.touches[0];
        onMove(t.clientX, t.clientY, () => e.preventDefault());
      }, { passive: false });
      elDrawer.addEventListener('touchend', e => {
        onUp(e.changedTouches[0].clientX);
      });
      elDrawer.addEventListener('touchcancel', onCancel);
    }());

    mounted = true;
    return true;
  }

  window.ParcelDrawer = {
    mount,
    get isMounted() { return mounted; },
    openForParcel,
    setActiveTab,
    close
  };
}());
