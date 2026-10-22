// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "E-Bike and Bicycle Shops in Greater Austin",
  subtitle: "Independent, chain, and e-bike specialist shops across the metro",
  data: './data.geojson?v=20261023j',
  nameField: "name",            // the property shown as each place's name
  categoryField: "kind",     // the property that colours the pins and groups the list
  // the dropdowns in the side panel (owner: at least three), each narrowing
  // the pins and the table; a dropdown whose property has no values in the
  // data is left out until the data has it
  filters: [
    { property: "kind", label: "Type" },
    { property: "ebikes", label: "E-bikes" },
    { property: "service", label: "Service" },
    { property: "city", label: "Area" }
  ],
  // the table's columns, in this order (the first carries the pin's colour)
  columns: [
    { property: "name", header: "Shop" },
    { property: "kind", header: "Type" },
    { property: "city", header: "Area" }
  ],
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "type", label: "Type" },
    { property: "specialties", label: "Specialties" },
    { property: "general_area", label: "Area" },
    { property: "address", label: "Address" },
    { property: "phone", label: "Phone" },
    { property: "website", label: "Website" },
    { property: "status", label: "Verified" },
    { property: "notes", label: "Notes" },
    { property: "source", label: "Source" }
  ],
  credit: "\u00a9 OpenStreetMap contributors"
};
