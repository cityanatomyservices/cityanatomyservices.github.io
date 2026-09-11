// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "E-Bike and Bicycle Shops in Greater Austin",
  eyebrow:  "Austin Shopping",
  subtitle: "Independent, chain, and e-bike specialist shops across the metro",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "Greater Austin bicycle and e-bike retailers — from downtown performance shops to brand stores, co-op chains, and dedicated e-bike specialists. Some rows are listed in the report but not yet mapped (missing geocoded coordinates).",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.742, 30.353],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#2f855a",
  // markerIconStyle: "golf" | "drop" (water) | "pin" (simple) — default: "golf"
  markerIconStyle: "pin",

  // ── Geographic bounds lock ────────────────────────────────
  maxBounds: [[-98.04, 29.97], [-97.47, 30.62]],

  // ── Theme overrides (leave undefined to use defaults) ────────
  // theme: {
  //   headerBg:    "#1a4d0e",   // header bar background
  //   pageBg:      "#e4ede0",   // page / table background
  //   fontHeading: "Oswald",    // heading font (Google Font name)
  //   fontBody:    "Barlow",    // body font (Google Font name)
  // },

  // ── Reddit search ─────────────────────────────────────────
  redditCity: "Austin",

  // ── Feature flags ─────────────────────────────────────────
  features: {
    drawTools:   true,
    measure:     true,
    exportPNG:   true,
    exportCSV:   true,
    reportPDF:   true,
    streetView:  true,
    satellite:   true,
    topo:        true,
    darkMode:    true,
    geolocation: true,
  },

  // ── Social footer links ───────────────────────────────────
  socialLinks: [
    { platform: "youtube",   url: "" },
    { platform: "x",         url: "" },
    { platform: "facebook",  url: "" },
    { platform: "instagram", url: "" },
    { platform: "reddit",    url: "" },
    { platform: "patreon",   url: "" },
    { platform: "discord",   url: "" },
  ],

  // ── Overlay layers ────────────────────────────────────────
  overlays: [
    { label: "Zip Codes",    file: "../../shared/SecondData.geojson",        colorProperty: "zipcode"       },
    { label: "Flood Zone",   file: "../../shared/floodzone.geojson",         colorProperty: "flood_zone"    },
    { label: "City Council", file: "../../shared/Council_Districts.geojson", colorProperty: "district_name" },
  ],

  // ── Data schema ───────────────────────────────────────────
  nameField: "shop_name",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "type",         label: "Type" },
    { property: "sells_ebikes", label: "Sells E-Bikes" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "shop_name",    header: "Shop"           },
    { property: "type",         header: "Type"           },
    { property: "city",         header: "City"           },
    { property: "sells_ebikes", header: "E-Bikes"        },
    { property: "address",      header: "Address"        },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "type",                         label: "Type"        },
    { property: "city",                         label: "City"        },
    { property: "sells_ebikes",                 label: "E-Bikes"     },
    { property: "offers_pro_fit",               label: "Pro Fit"     },
    { property: "austin_energy_e_ride_rebate",  label: "E-Ride"      },
    { property: "address",                      label: "Address"     },
    { property: "notes",                        label: "Notes"       },
  ]
};
