// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Vintage and Used Guitar Shops in Greater Austin",
  eyebrow:  "Austin Shopping",
  subtitle: "Vintage specialists, boutiques, independents, and chains across the metro",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "Greater Austin's vintage and used guitar market — from dedicated vintage specialists and boutique showrooms to acoustic-focused destinations and big-box chains with deep used sections. Covers 27 shops across the metro, from Georgetown and Taylor to Lockhart and San Marcos (researched 2026-10-22).",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.729, 30.296],
  zoom:            9.3,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#7D4F00",
  // markerIconStyle: "golf" | "drop" (water) | "pin" (simple) — default: "golf"
  markerIconStyle: "pin",

  // ── Geographic bounds lock ────────────────────────────────
  maxBounds: [[-98.15, 29.75], [-97.15, 30.80]],

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
    { property: "shop_type", label: "Shop Type" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "name",      header: "Shop"    },
    { property: "shop_type", header: "Type"    },
    { property: "city",      header: "City"    },
    { property: "address",   header: "Address" },
    { property: "phone",     header: "Phone"   },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "shop_type",   label: "Type"        },
    { property: "address",     label: "Address"     },
    { property: "phone",       label: "Phone"       },
    { property: "website",     label: "Website"     },
    { property: "notes",       label: "Notes"       },
    { property: "source",      label: "Source"      },
  ]
};
