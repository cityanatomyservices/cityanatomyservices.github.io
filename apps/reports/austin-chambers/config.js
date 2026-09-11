// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Austin-Area Chambers of Commerce",
  eyebrow:  "Austin Metro",
  subtitle: "Regional and affinity chambers across Greater Austin",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "A map of Austin-area chambers of commerce — regional, affinity (Asian, Hispanic, Black, LGBT, Young Professionals), and geographic corridors. Filter by focus type to see how the region's business advocacy is organized.",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.727, 30.379],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#6f4e37",
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
  nameField: "name",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "focus_type",     label: "Focus" },
    { property: "city_state_zip", label: "City" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "name",           header: "Chamber"  },
    { property: "focus_type",     header: "Focus"    },
    { property: "street_address", header: "Address"  },
    { property: "city_state_zip", header: "City"     },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "focus_type",     label: "Focus"    },
    { property: "street_address", label: "Address"  },
    { property: "city_state_zip", label: "City"     },
    { property: "website",        label: "Website"  },
    { property: "map_location",   label: "Location" },
    { property: "notes",          label: "About"    },
  ]
};
