// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Austin Pool Openings",
  eyebrow:  "Austin Metro",
  subtitle: "City pools, splash pads & wading pools",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "Austin public pools and splash pads. Filter by open/closed status, pool size, and opening date.",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.737, 30.286],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#0077bb",
  markerIconStyle: "drop",

  // ── Geographic bounds lock ────────────────────────────────
  maxBounds: [[-98.04, 29.97], [-97.47, 30.62]],

  // ── Theme ─────────────────────────────────────────────────
  theme: {
    headerBg:    "#005f8e",   // ocean blue header
    pageBg:      "#e8f4fd",   // light sky-blue page background
    fontHeading: "Fredoka",   // rounded, fun, summer-y
    fontBody:    "Nunito",    // friendly and readable
  },

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
  nameField: "Pool Name",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "Status",    label: "Status" },
    { property: "Pool Type", label: "Pool Type" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "Pool Name", header: "Pool"    },
    { property: "Status",    header: "Status"  },
    { property: "Pool Type", header: "Type"    },
    { property: "Open Date", header: "Opens"   },
    { property: "address",   header: "Address" },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "Status",       label: "Status"  },
    { property: "Pool Type",    label: "Type"    },
    { property: "Open Date",    label: "Opens"   },
    { property: "Weekday",      label: "Weekday" },
    { property: "Weekend",      label: "Weekend" },
    { property: "Closure Days", label: "Closed"  },
    { property: "Phone",        label: "Phone"   },
    { property: "Website",      label: "Website" },
    { property: "address",      label: "Address" },
  ]
};
