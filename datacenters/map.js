// map.js — what is particular to the data centers map. The engine is
// ../topicmap/app.js and ../topicmap/player.js (shared with every topic map
// since 2026-09-14); this file gives it the popup, the size key under the
// legend, the timeline steps and the corridor camera move.
window.MAP_PAGE = {
  // the first column of the timeline's site list: the city, or the county
  // when the site is outside any city
  column(properties) {
    const city = String(properties.city || '').trim();
    const county = String(properties.county || '').trim();
    // Cedar Creek is unincorporated: tshaonline.org/handbook/entries/cedar-creek-tx-bastrop-county
    if (city && !/unincorporated|\bETJ\b|^unknown$|^n\/?a$/i.test(city)
      && !(city === 'Cedar Creek' && county === 'Bastrop')) return city;
    return county ? (/\bcounty\b/i.test(county) ? county : `${county} County`) : window.MAP_COPY.player.unknownCity;
  },

  // the popup for a site: the facts and the source links from the research
  popupHtml(p, { CFG, COPY, esc, num, rowsHtml }) {
    const P = COPY.popup;
    const mw = Number(p.size_mw) > 0 ? num(p.size_mw) + ' ' + P.mw : COPY.mwUnknown;
    const size = [Number(p.size_sqft) > 0 ? num(p.size_sqft) + ' ' + P.sqft : '', Number(p.acres) > 0 ? num(p.acres) + ' ' + P.acres.toLowerCase() : '']
      .filter(Boolean).join(', ');
    let html = `<h3>${esc(p.id)}. ${esc(p.name)}</h3>`;
    html += rowsHtml([
      [P.operator, esc(p.operator)],
      [P.status, `<span class="swatch" style="display:inline-block;vertical-align:-2px;background:${CFG.categories[p.status]}"></span> ${esc(COPY.category[p.status] || p.status_label)}`],
      [P.address, esc(p.address)],
      [P.place, esc(p.city) + ', ' + esc(p.county)],
      [P.power, mw],
      [P.size, size],
      [P.year, esc(p.year)],
      [P.precision, esc(P.precisionWords[p.coord_precision] || p.coord_precision)]
    ]);
    if (p.notes) html += `<p class="notes"><strong>${esc(P.notes)}.</strong> ${esc(p.notes)}</p>`;
    if (p.power_water_notes) html += `<p class="notes"><strong>${esc(P.utility)}.</strong> ${esc(p.power_water_notes)}</p>`;
    if (p.sources) {
      const links = String(p.sources).split(' | ').filter(Boolean).map((u) => {
        let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep the raw text */ }
        return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host)}</a>`;
      });
      html += `<div class="sources"><strong>${esc(P.sources)}</strong>${links.join('')}</div>`;
    }
    return html;
  },

  // under the legend rows: three dots showing how size follows MW
  legendExtra({ CFG, COPY, radiusPx }) {
    const size = document.getElementById('legendSize');
    size.textContent = COPY.sizeLegend;
    const dots = document.createElement('div'); dots.className = 'dots';
    CFG.sizeLegendMw.forEach((mw) => {
      const d = radiusPx(mw) * 2;
      const span = document.createElement('span');
      const i = document.createElement('i'); i.style.width = d + 'px'; i.style.height = d + 'px';
      span.append(i, document.createTextNode(mw + ' ' + COPY.popup.mw));
      dots.appendChild(span);
    });
    size.appendChild(dots);
  },

  // The sequence (owner 2026-09-13/14): reveal the sites by status over the
  // city limits, zoom to the Round Rock-Taylor corridor and say why it
  // attracts data centers, fold the legend away for room, swap the city
  // limits for the Austin Energy area and zoom back out, then the
  // transmission lines and substations, then the water layers.
  // (step keys are explained at the top of ../topicmap/player.js; `camera`
  // is this map's own key, read by frame() below)
  steps({ categories, COPY }) {
    const words = COPY.player;
    return [
      { title: words.ready },
      // the data centers card folds as soon as the first site list appears (owner 2026-09-14)
      ...categories.map((category, i) => ({ title: COPY.category[category], category,
        ...(i === 0 ? { show: ['city'], cards: { legend: false } } : {}) })),
      { title: words.corridor, camera: 'round-rock-taylor', text: words.corridorText },
      // the Layers box opens with this text card and folds again 2 s later (owner 2026-09-14)
      { title: words.serviceArea, camera: 'overview', cards: { layers: true }, cardsAfter: { delay: 2000, cards: { layers: false } }, hide: ['city'], show: ['service'], text: words.serviceAreaText },
      { title: words.electric, show: ['transmission', 'substations'], text: words.electricText },
      { title: words.water, hide: ['transmission', 'substations'], show: ['aquifers', 'gcd', 'intakes'], text: words.waterText },
      { title: words.done, done: true }
    ];
  },

  // ?play starts the sequence 3 s after load (the intro is already gone)
  playDelay: 3000,

  // the camera: the corridor step zooms to the Round Rock / Hutto / Taylor
  // sites, leaving room for the text card; the next step eases back to where
  // the map was before
  overviewCamera: null,
  frame(step, map, { boundsOf, points, layout }) {
    const corridor = { features: points.features.filter(f => /Round Rock|Hutto|Taylor/i.test(f.properties.city || '')) };
    if (step.camera === 'round-rock-taylor' && corridor.features.length) {
      if (!this.overviewCamera) this.overviewCamera = { center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
      const { narrow, wide, portrait } = layout();
      map.fitBounds(boundsOf(corridor), {
        padding: narrow ? { left: 20, right: 20, top: 80, bottom: 310 }      // phone: the text card sits at the bottom
          : portrait ? { left: 40, right: 40, top: 420, bottom: 120 }        // tall desktop-size viewport: the card sits lower
          : wide ? { left: 310, right: 40, top: 240, bottom: 70 } : { left: 20, right: 20, top: 220, bottom: 60 },   // the story card sits centred at the top
        bearing: 0, pitch: 0, duration: 1000
      });
    } else if (!step.done && this.overviewCamera) {
      map.easeTo({ ...this.overviewCamera, duration: 700 });
      this.overviewCamera = null;
    }
  }
};
