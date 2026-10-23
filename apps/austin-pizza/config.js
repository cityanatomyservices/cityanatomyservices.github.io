// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file and is
// built from the owner's CSV by build.py. TITLE AND SUBTITLE ARE DRAFTS by
// Claude (2026-10-22) — the owner writes the copy.
window.SHOP_CONFIG = {
  title: "Pizza in Austin",
  subtitle: "Pizzerias, chains, bars and counters serving pizza, with the city's health inspection scores",
  data: './data.geojson?v=20261023l',
  nameField: "name",            // the property shown as each place's name
  categoryField: "kind",        // the property that colours the pins and groups the list
  // the dropdowns in the side panel (owner: at least three), each narrowing
  // the pins and the table; a dropdown whose property has no values in the
  // data is left out until the data has it
  filters: [
    { property: "kind", label: "Type" },
    { property: "style", label: "Style" },
    { property: "score", label: "Health score" },
    { property: "area", label: "Area" }
  ],
  // the table's columns, in this order (the first carries the pin's colour)
  columns: [
    { property: "name", header: "Place" },
    { property: "style", header: "Style" },
    { property: "area", header: "Area" }
  ],
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "type", label: "Type" },
    { property: "pizza_style", label: "Style" },
    { property: "website_says", label: "Website says" },
    { property: "address", label: "Address" },
    { property: "phone", label: "Phone" },
    { property: "website", label: "Website" },
    { property: "health", label: "Health score" },
    { property: "health_url", label: "Inspection" },
    { property: "reddit", label: "Reddit" },
    { property: "reddit_url", label: "Thread" },
    { property: "magazine", label: "Austin Monthly" },
    { property: "magazine_url", label: "Article" },
    { property: "status", label: "Verified" },
    { property: "notes", label: "Notes" }
  ],
  credit: "Owner research 2026-10-22 · Austin Public Health inspection scores (data.austintexas.gov) · © OpenStreetMap contributors"
};
