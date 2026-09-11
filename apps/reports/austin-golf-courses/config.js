// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Golf in the Austin Region",
  eyebrow:  "Austin Metro",
  subtitle: "Courses, climate, history, and trends",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "A map of 20 golf facilities across the Austin metro — municipal, public, daily-fee, and resort — showing holes, price tier, and designer notes. Filter by category or hole count to explore options across the region.",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.733, 30.327],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#2d7a1a",
  // markerIconStyle: "golf" | "drop" (water) | "pin" (simple) — default: "golf"
  markerIconStyle: "golf",

  // ── Geographic bounds lock ────────────────────────────────
  maxBounds: [[-98.3, 29.8], [-97.3, 30.8]],

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
  nameField: "Course",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "Holes", label: "Holes" },
    { property: "Type",  label: "Type" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "Course",              header: "Course"   },
    { property: "Type",                header: "Type"     },
    { property: "Holes",               header: "Holes"    },
    { property: "Area",                header: "Area"     },
    { property: "Approx. price tier",  header: "Price"    },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "Type",               label: "Type"     },
    { property: "Holes",              label: "Holes"    },
    { property: "Area",               label: "Area"     },
    { property: "Approx. price tier", label: "Price"    },
    { property: "Designer / notes",   label: "Designer" },
  ]
};
