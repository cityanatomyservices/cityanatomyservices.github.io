// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "Austin Pool Openings",
  subtitle: "City pools, splash pads & wading pools",
  data: './data.geojson?v=20261023g',
  nameField: "Pool Name",            // the property shown as each place's name
  categoryField: "Pool Type",     // the property that colours the pins and groups the list
  // the dropdowns in the side panel (owner: at least three), each narrowing
  // the pins and the table; a dropdown whose property has no values in the
  // data is left out until the data has it
  filters: [
    { property: "Pool Type", label: "Type" },
    { property: "Status", label: "Status" },
    { property: "Closure Days", label: "Closed on" }
  ],
  // the table's columns, in this order (the first carries the pin's colour)
  columns: [
    { property: "Pool Name", header: "Pool" },
    { property: "Pool Type", header: "Type" },
    { property: "Status", header: "Status" }
  ],
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "Status", label: "Status" },
    { property: "Open Date", label: "Opens" },
    { property: "Weekday", label: "Weekdays" },
    { property: "Weekend", label: "Weekends" },
    { property: "Closure Days", label: "Closed" },
    { property: "Phone", label: "Phone" },
    { property: "Website", label: "Website" },
    { property: "address", label: "Address" }
  ],
  credit: "City of Austin \u00b7 \u00a9 OpenStreetMap contributors"
};
