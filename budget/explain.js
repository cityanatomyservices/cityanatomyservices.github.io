// explain.js — GENERATED from projects/atxmapdata/Austin2026Budget/data/layer_explanations.json
// by scripts/94_web_explanations.py. Edit the JSON there, not this file.
window.BUDGET_EXPLAIN = {
  "general": {
    "title": "How these maps were made",
    "text": "Every map comes from the City of Austin's FY 2026-27 budget (the two proposed-budget volumes, scanned and OCR'd, plus the figures adopted by Council on August 12, 2026), the Travis Central Appraisal District's public appraisal rolls for 2025 and 2026, the City's open-data portal, and the GIS library kept for this work. Nothing here is audited: figures were read from scans and public rolls by scripts, and single numbers should be checked against the source before they are quoted. No property owner names are used anywhere. All dollar figures for tax bills are the City of Austin's share only, which is roughly a quarter of a homeowner's total property tax bill.",
    "sources": "City of Austin FY 2026-27 Proposed Budget, Volumes I and II; City adoption press release, August 12, 2026; Travis CAD 2026 Certified Appraisal Export (July 18, 2026) and 2025 Electronic Appraisal Roll Submission; data.austintexas.gov; Texas Comptroller sales tax allocations."
  },
  "themes": {
    "value": {
      "title": "Tax base: change in taxable value, 2025 to 2026",
      "what": "How much each property's taxable value changed between the 2025 roll and the 2026 certified roll, for the City of Austin taxing unit. Blue fell, red rose. Zoomed out, each neighborhood planning area shows the change in its total taxable value; zoomed in, each parcel shows its own.",
      "how": "Taxable value is the appraisal district's appraised value minus the exemptions the City grants (20% homestead, $204,000 over-65 or disabled, veterans, historic and others) and minus any homestead cap loss. Change = (taxable 2026 - taxable 2025) / taxable 2025. Taxable value is used rather than market value because the 2025 file reports market value only for property that pays tax, while the 2026 file includes fully exempt property, so market values are not comparable between the two years; taxable value is also the base the tax rate is actually applied to.",
      "sources": "Travis CAD 2025 EARS submission (per-property values as certified to the Texas Comptroller, September 2025) and 2026 Certified Appraisal Export (July 18, 2026), City of Austin taxing unit only. Parcel outlines: TxGIO StratMap 2025 parcels. Neighborhood planning areas: City of Austin.",
      "caveats": "Condo units that share one footprint are added together and shown once. The parcel layer attaches unrelated appraisal accounts to some small polygons; footprints carrying more than 20 accounts that are not mostly residential were dropped as artifacts (26 footprints, about 4,200 accounts). Business personal property is not mapped. About 87% of the City's real-property taxable value is on the map, so area totals run a little low; percentages are sound. Citywide the base fell 3.7%, from $219.8 billion to $211.6 billion."
    },
    "bill": {
      "title": "City tax bill: change from FY 2026 to FY 2027",
      "what": "How much each property's City of Austin property tax changed from last year to this year, using the rate Council adopted. Blue fell, red rose. Zoomed out, each neighborhood shows the median change for its homesteads; zoomed in, each parcel shows its own change. Click a parcel to see its taxable value for each year since 2021.",
      "how": "Bill = taxable value x tax rate / 100. The FY 2026 bill uses the 2025 roll and the 2025 rate ($0.524017 per $100); the FY 2027 bill uses the 2026 certified roll and the adopted 2026 rate ($0.579948 per $100). Where the roll records a tax ceiling for an over-65 or disabled homestead, the bill is capped at that ceiling. The rate rose 10.7% while most values fell, so a typical homestead's bill rises about 5.6%; homesteads with the over-65 or disabled exemption, which grew to $204,000, mostly fall; property with no homestead exemption takes the full rate increase on whatever its value did.",
      "sources": "Same rolls as the tax-base map. Rates: FY 2025-26 adopted budget and the FY 2026-27 budget adopted August 12, 2026. The parcel history in the popup is the appraisal history already kept in the City Anatomy parcel database (2021 to 2026).",
      "caveats": "City share only, about a quarter of the full bill; school district, county, Central Health and ACC are not included. Same footprint and coverage limits as the tax-base map. The taxpayer type comes from the roll's exemption flags and state property category: homestead, over-65 or disabled homestead, residential without a homestead exemption (rentals and second homes), apartments, commercial or industrial, vacant land."
    },
    "drainage": {
      "title": "Drainage charge: what each parcel pays per month at the FY 2027 rate",
      "what": "The City's monthly drainage charge modeled for every parcel with impervious cover, at the rate in the FY 2026-27 fee schedule. Darker is a higher charge. The charge funds the Watershed Protection Department; it rises 6.2% this year and about 30% by FY 2031.",
      "how": "Monthly charge = impervious cover (square feet) x base rate x adjustment factor, where the adjustment factor = 1.5425 x (impervious cover / lot area) + 0.1933. The FY 2027 base rate is $0.00630 per square foot (fee schedule, Vol. II p. 567); the FY 2026 rate of $0.00593 is back-calculated from the published 6.2% increase. Impervious cover comes from the City's 2023 impervious-cover planimetrics: every structure, paved driveway, patio, deck, pool, paved parking area and similar feature is assigned to the parcel its center falls in and its area summed. Street pavement and sidewalks are left out because they sit in the right of way, which is not billed; unpaved driveways are left out because they are pervious.",
      "sources": "FY 2026-27 fee schedule, Watershed Protection Drainage Utility Fund (Vol. II pp. 564-571); City of Austin impervious cover planimetrics 2023; TxGIO StratMap 2025 parcels.",
      "caveats": "This is a model of the charge, not the utility's bill: credits for on-site stormwater controls, the 50% credit program, and any parcel-level corrections are not applied. The modeled charges add up to about $124 million a year against a $134 million Drainage Utility Fund, so the model is in the right range. The parcel layer is county-wide, so parcels outside the City show a charge they do not actually pay."
    },
    "permits": {
      "title": "Building permits issued, by month, 2021 to mid-2026",
      "what": "How many building permits the City issued in each half-mile square in each month. Use the slider or press play to watch the development slowdown the budget describes: the City expects a 'continuing lull in development activity', a Development Services Fund in deficit, and $4 million less in right-of-way permit revenue.",
      "how": "Counts come from the City's issued construction permits dataset. Only permits of type 'Building Permit' are counted; the electrical, plumbing and mechanical permits that accompany the same jobs are excluded so each job counts once. Each permit is placed on its issue date and address point and counted in a half-mile (2,640 ft) grid square; 'new construction' is the subset whose work class is New.",
      "sources": "data.austintexas.gov, Issued Construction Permits, issue dates January 2021 to July 27, 2026.",
      "caveats": "A permit is a permit, whatever its size: a shed and a tower count the same. Permits with no mappable address are not shown. The last month is partial."
    },
    "cip": {
      "title": "Capital projects in the five-year plan, FY 2027 to FY 2031",
      "what": "Where the five-year capital spend plan for Transportation and Public Works, Watershed Protection, Parks, Housing and Planning goes. Lines are colored by how a project is paid for (bonds, current revenue, grants, other general-obligation debt, other debt); dots are sized by the five-year total. Click a project for its year-by-year amounts.",
      "how": "Every named subproject on the department spend-plan pages of Volume II (pp. 262-341) was read from the scanned tables: 696 subprojects, whose totals reconcile to the printed department totals. Each was then placed on the map by matching a place name in its title to a street, creek, urban trail or park in the GIS library. A match draws the whole named feature, so a project on one segment of a long street or creek is drawn along all of it.",
      "sources": "FY 2026-27 Proposed Budget Volume II, five-year CIP spend plan; City of Austin street centerlines, creeks, urban trails and parks.",
      "caveats": "452 of the 696 subprojects are on the map; the other 244 are citywide programs or could not be matched to a place and are listed separately. Locations are approximate: a whole street or creek, not the project's actual limits. The single-year amounts were reconstructed from the printed totals where the scan dropped empty cells, so the five-year total is more reliable than any one year. Parks' bond block is $615,178 short of its printed total."
    },
    "flood": {
      "title": "Atlas 14 flood remapping study areas, FY 2027",
      "what": "The watershed groups where Watershed Protection will update its floodplain maps to the Atlas 14 rainfall standard in FY 2027, over the current regulatory floodplain. Property inside these areas is where the mapped flood risk, and so the rules for building, may change.",
      "how": "The budget lists eight groups (Vol. II p. 338): Onion; Williamson, Slaughter and South Boggy; Walnut and Boggy; Urban West north and south of the river; Gilleland and NE Colorado; Dry East, Carson and SE Colorado. Each is drawn by joining the named watersheds from the City's watershed boundaries. The parcel count and market value for each group count the parcels whose center falls inside it.",
      "sources": "FY 2026-27 Proposed Budget Volume II, Watershed Protection CIP, floodplain mapping line items; City of Austin watershed boundaries; City of Austin fully developed floodplain (the regulatory floodplain).",
      "caveats": "The budget does not say which watersheds make up the two 'Urban West' groups; they are drawn here as a best guess from the small central watersheds and should be confirmed with Watershed Protection. Study area does not mean floodplain: it is where the maps are being redone."
    },
    "landmarks": {
      "title": "Historic landmarks receiving the City's partial tax exemption",
      "what": "The 678 historic landmarks on the FY 2026-27 budget's exemption list, with the result of their FY 2026 inspection. Grey passed; red failed. A landmark that fails inspection can lose its exemption.",
      "how": "The list is Exhibit B-1 (Recorded Texas Historic Landmarks and State Antiquities Landmarks) and Exhibit B-2 (local landmarks) of the budget's property tax exemption section, Vol. II pp. 635-646, read from the scan. Each landmark is placed at the center of the parcel whose TCAD parcel number the list prints.",
      "sources": "FY 2026-27 Proposed Budget Volume II, pp. 634-646; TxGIO StratMap 2025 parcels.",
      "caveats": "659 of the 678 are placed; 19 printed no parcel number or one that is not in the parcel layer. Names and addresses are as scanned, with only spacing repaired. Three Moonlight Towers are on the list without parcel numbers."
    }
  }
};
