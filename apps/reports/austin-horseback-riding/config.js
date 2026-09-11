// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Recreational Horseback Riding in Greater Austin",
  eyebrow:  "Austin Metro",
  subtitle: "Trail rides, lesson barns, and equine experiences across the region",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "A map of horseback riding opportunities in greater Austin — from guided ranch trail rides minutes from downtown to hunter/jumper lesson barns, Pony Club programs, and a luxury wellness resort with an equine center. Geocoded markers will appear here once coordinates are added.",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.795, 30.251],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#8B4513",
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
  filters: [],   // nothing in this data set groups: every field has one
                 // distinct value per row, so a dropdown would just list them all

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "name",     header: "Operator"  },
    { property: "category", header: "Type"      },
    { property: "area",     header: "Area"      },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "category",          label: "Type"        },
    { property: "area",              label: "Area"        },
    { property: "phone",             label: "Phone"       },
    { property: "website",           label: "Website"     },
    { property: "primary_activities", label: "Activities" },
    { property: "notes",             label: "Notes"       },
  ]
};
