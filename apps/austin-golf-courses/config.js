// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "Golf in the Austin Region",
  subtitle: "Courses, climate, history, and trends",
  data: './data.geojson?v=20261023f',
  nameField: "Course",            // the property shown as each place's name
  categoryField: "Type",     // the property that colours the pins and groups the list
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "Holes", label: "Holes" },
    { property: "Area", label: "Area" },
    { property: "Approx. price tier", label: "Price tier" },
    { property: "Designer / notes", label: "Designer / notes" }
  ],
  credit: "\u00a9 OpenStreetMap contributors"
};
