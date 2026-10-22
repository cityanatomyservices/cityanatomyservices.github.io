// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "Recreational Horseback Riding in Greater Austin",
  subtitle: "Trail rides, lesson barns, and equine experiences across the region",
  data: './data.geojson?v=20261023f',
  nameField: "name",            // the property shown as each place's name
  categoryField: "category",     // the property that colours the pins and groups the list
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "area", label: "Area" },
    { property: "phone", label: "Phone" },
    { property: "website", label: "Website" },
    { property: "primary_activities", label: "Activities" },
    { property: "notes", label: "Notes" }
  ],
  credit: "\u00a9 OpenStreetMap contributors"
};
