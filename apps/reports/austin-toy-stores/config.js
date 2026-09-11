// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Toy Stores & Children's Specialty Retailers in Greater Austin",
  eyebrow:  "Austin Shopping",
  subtitle: "Independent shops, educational toy specialists, and family-favorite destinations",

  infoPanelText: "Austin-area toy stores — independents, educational specialists, collectible shops, and notable closures. Filter by store type, age range, or specialty. Click any pin for details.",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.745, 30.310],
  zoom:            11,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#d4380d",
  markerIconStyle: "pin",

  // ── Geographic bounds lock ────────────────────────────────
  maxBounds: [[-98.04, 29.97], [-97.47, 30.62]],

  // ── Theme ─────────────────────────────────────────────────
  theme: {
    headerBg:    "#b32d0a",
    pageBg:      "#fff8f6",
    fontHeading: "Fredoka",
    fontBody:    "Nunito",
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
  nameField: "name",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "type",      label: "Type" },
    { property: "age_range", label: "Age Range" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "name",      header: "Store"     },
    { property: "type",      header: "Type"      },
    { property: "age_range", header: "Ages"      },
    { property: "specialty", header: "Specialty" },
    { property: "address",   header: "Address"   },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "type",      label: "Type"      },
    { property: "age_range", label: "Ages"      },
    { property: "specialty", label: "Specialty" },
    { property: "address",   label: "Address"   },
    { property: "website",   label: "Website"   },
    { property: "notes",     label: "Notes"     },
  ]
};
