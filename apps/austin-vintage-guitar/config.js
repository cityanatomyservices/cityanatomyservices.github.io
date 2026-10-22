// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "Vintage and Used Guitar Shops in Greater Austin",
  subtitle: "Vintage specialists, boutiques, independents, and chains across the metro",
  data: './data.geojson?v=20261023f',
  nameField: "name",            // the property shown as each place's name
  categoryField: "shop_type",     // the property that colours the pins and groups the list
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "address", label: "Address" },
    { property: "phone", label: "Phone" },
    { property: "website", label: "Website" },
    { property: "notes", label: "Notes" },
    { property: "source", label: "Source" }
  ],
  credit: "Owner research 2026-10-22 \u00b7 \u00a9 OpenStreetMap contributors"
};
