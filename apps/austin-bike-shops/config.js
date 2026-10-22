// config.js — this shopping app's own settings; the engine is /shopmap/app.js.
// The data (data.geojson, one Point per place) sits beside this file; the
// title and subtitle are the owner's words (from the earlier report).
window.SHOP_CONFIG = {
  title: "E-Bike and Bicycle Shops in Greater Austin",
  subtitle: "Independent, chain, and e-bike specialist shops across the metro",
  data: './data.geojson?v=20261023f',
  nameField: "shop_name",            // the property shown as each place's name
  categoryField: "type",     // the property that colours the pins and groups the list
  // the rows in a place's popup, in this order (a value that is a web
  // address becomes a link); empty values are skipped
  popupFields: [
    { property: "city", label: "City" },
    { property: "address", label: "Address" },
    { property: "sells_ebikes", label: "Sells e-bikes" },
    { property: "offers_pro_fit", label: "Pro fitting" },
    { property: "austin_energy_e_ride_rebate", label: "Austin Energy e-ride rebate" },
    { property: "notes", label: "Notes" }
  ],
  credit: "\u00a9 OpenStreetMap contributors"
};
