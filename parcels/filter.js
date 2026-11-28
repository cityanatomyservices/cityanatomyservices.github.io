// filter.js — controller for the parcel search/filter panel.
//
// Owns the filter panel UI only. The user sets criteria, then presses
// Search (or Enter in a number field) to run the query — nothing fires
// automatically on input. Search emits a `parcelfilterchange` event;
// app.js turns that into a search_parcels query and de-emphasises
// non-matching parcels on the map, reporting back via `parcelfilterresult`.
//
// No-ops gracefully when #filter-panel is absent (e.g. /parcels/embed.html).

(function () {
  const panel = document.getElementById('filter-panel');
  if (!panel) return;

  const elCategories = panel.querySelectorAll('#filter-categories input[type="checkbox"]');
  const elFarMin    = panel.querySelector('#far-min');
  const elFarMax    = panel.querySelector('#far-max');
  const elHeightMin = panel.querySelector('#height-min');
  const elHeightMax = panel.querySelector('#height-max');
  const elSearch    = panel.querySelector('#filter-search');
  const elClear     = panel.querySelector('#filter-clear');
  const elToggle    = panel.querySelector('#filter-toggle');
  const elResult    = panel.querySelector('#filter-result');

  function num(input) {
    const v = parseFloat(input.value);
    return Number.isFinite(v) ? v : null;
  }

  function collect() {
    return {
      categories: Array.from(elCategories)
        .filter(c => c.checked).map(c => c.value),
      farMin:    num(elFarMin),
      farMax:    num(elFarMax),
      heightMin: num(elHeightMin),
      heightMax: num(elHeightMax)
    };
  }

  // Run the search with whatever is currently in the form.
  function runSearch() {
    const s = collect();
    const active =
      s.categories.length > 0 ||
      s.farMin != null || s.farMax != null ||
      s.heightMin != null || s.heightMax != null;
    document.dispatchEvent(new CustomEvent('parcelfilterchange', {
      detail: Object.assign({ active }, s)
    }));
  }

  elSearch.addEventListener('click', runSearch);

  // Enter inside any number field runs the search too.
  [elFarMin, elFarMax, elHeightMin, elHeightMax].forEach(i => {
    i.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  });

  elClear.addEventListener('click', () => {
    elCategories.forEach(c => { c.checked = false; });
    elFarMin.value = elFarMax.value = '';
    elHeightMin.value = elHeightMax.value = '';
    runSearch();   // empty form -> active:false -> app.js clears the highlight
  });

  elToggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    panel.querySelector('.filter-inner').inert = collapsed;
    elToggle.setAttribute('aria-expanded', String(!collapsed));
    elToggle.setAttribute('aria-label', collapsed ? 'Show filters' : 'Hide filters');
  });

  if (matchMedia('(max-width: 600px)').matches) elToggle.click();

  // Result badge — driven by app.js after each search.
  document.addEventListener('parcelfilterresult', (e) => {
    const d = e.detail || {};
    if (d.loading) {
      elResult.dataset.state = 'loading';
      elResult.textContent = 'Searching…';
      return;
    }
    if (d.error) {
      elResult.dataset.state = 'error';
      elResult.textContent = d.error;
      return;
    }
    if (d.count == null) {
      elResult.dataset.state = 'idle';
      elResult.textContent = 'Set filters and press Search';
      return;
    }
    elResult.dataset.state = 'done';
    if (d.count === 0) {
      elResult.textContent = 'No parcels match in this view';
    } else if (d.count === 1) {
      elResult.textContent = '1 parcel matches in this view';
    } else {
      elResult.textContent =
        d.count.toLocaleString('en-US') + ' parcels match in this view';
    }
  });
}());
