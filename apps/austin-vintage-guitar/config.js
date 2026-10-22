// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "Vintage and Used Guitar Shops in Greater Austin",
  subtitle: "Vintage specialists, boutiques, independents, and chains across the metro",
  data: './data.geojson?v=20261023g',
  nameField: "name",            // the property shown as each place's name
  categoryField: "shop_type",     // the property that colours the pins and groups the list
  // the dropdowns in the side panel (owner: at least three), each narrowing
  // the pins and the table; a dropdown whose property has no values in the
  // data is left out until the data has it
  filters: [
    { property: "shop_type", label: "Type" },
    { property: "sells", label: "New or used" },
    { property: "city", label: "Area" }
  ],
  // the table's columns, in this order (the first carries the pin's colour)
  columns: [
    { property: "name", header: "Shop" },
    { property: "shop_type", header: "Type" },
    { property: "city", header: "Area" }
  ],
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
