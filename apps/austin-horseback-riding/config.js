// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "Recreational Horseback Riding in Greater Austin",
  subtitle: "Trail rides, lesson barns, and equine experiences across the region",
  data: './data.geojson?v=20261023h',
  nameField: "name",            // the property shown as each place's name
  categoryField: "riding",      // the property that colours the pins and groups the list
  // the dropdowns in the side panel (owner: at least three), each narrowing
  // the pins and the table; a dropdown whose property has no values in the
  // data is left out until the data has it
  filters: [
    { property: "riding", label: "Type" },
    { property: "style", label: "Discipline" },
    { property: "camps", label: "Camps" },
    { property: "city", label: "Area" }
  ],
  // the table's columns, in this order (the first carries the pin's colour)
  columns: [
    { property: "name", header: "Name" },
    { property: "riding", header: "Type" },
    { property: "city", header: "Area" }
  ],
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "types", label: "Riding" },
    { property: "general_area", label: "Area" },
    { property: "address", label: "Address" },
    { property: "phone", label: "Phone" },
    { property: "website", label: "Website" },
    { property: "notes", label: "Notes" },
    { property: "source", label: "Source" }
  ],
  credit: "\u00a9 OpenStreetMap contributors"
};
