// story.js — the beats of this app's video, WRITTEN BY tools/make-story.py
// from story.json and data.geojson. Do not edit: change story.json or the
// data and run the script again. Played by /shopmap/play.js with ?play.
window.SHOP_STORY = {
  "playDelay": 1500,
  "beats": [
    {
      "type": "all",
      "hold": 8.0,
      "count": 194,
      "label": "places serving pizza in Austin"
    },
    {
      "type": "breakdown",
      "hold": 10.0,
      "property": "kind",
      "title": "By type",
      "rows": [
        {
          "value": "Chain",
          "count": 93,
          "color": "#4e79a7"
        },
        {
          "value": "Pizzeria",
          "count": 68,
          "color": "#f28e2b"
        },
        {
          "value": "Bar, brewery or restaurant",
          "count": 25,
          "color": "#59a14f"
        },
        {
          "value": "Counter or trailer",
          "count": 8,
          "color": "#e15759"
        }
      ]
    },
    {
      "type": "breakdown",
      "hold": 10.0,
      "property": "style",
      "title": "Style named on the website",
      "rows": [
        {
          "value": "New York",
          "count": 13,
          "color": "#4e79a7"
        },
        {
          "value": "Detroit",
          "count": 10,
          "color": "#f28e2b"
        },
        {
          "value": "Other",
          "count": 9,
          "color": "#59a14f"
        },
        {
          "value": "Neapolitan or wood-fired",
          "count": 9,
          "color": "#e15759"
        },
        {
          "value": "Sicilian or deep pan",
          "count": 6,
          "color": "#76b7b2"
        },
        {
          "value": "Thin crust",
          "count": 2,
          "color": "#edc948"
        },
        {
          "value": "Sourdough",
          "count": 1,
          "color": "#b07aa1"
        }
      ],
      "note": "144 of 194: not stated"
    },
    {
      "type": "breakdown",
      "hold": 10.0,
      "property": "score",
      "title": "Austin Public Health inspection score",
      "rows": [
        {
          "value": "90 to 100",
          "count": 100,
          "color": "#4e79a7"
        },
        {
          "value": "80 to 89",
          "count": 43,
          "color": "#f28e2b"
        },
        {
          "value": "Below 80",
          "count": 10,
          "color": "#59a14f"
        },
        {
          "value": "No score matched",
          "count": 41,
          "color": "#e15759"
        }
      ]
    },
    {
      "type": "top",
      "hold": 12.0,
      "title": "Talked about on Reddit and in Austin Monthly",
      "rows": [
        {
          "name": "DeSano Pizzeria Napoletana",
          "detail": "3 locations"
        },
        {
          "name": "Allday Pizza",
          "detail": "2 locations"
        },
        {
          "name": "Bufalina",
          "detail": "2 locations"
        },
        {
          "name": "Home Slice Pizza",
          "detail": "2 locations"
        },
        {
          "name": "Little Deli & Pizzeria",
          "detail": "2 locations"
        },
        {
          "name": "Pedroso's Pizza",
          "detail": "2 locations"
        },
        {
          "name": "Pinthouse Pizza",
          "detail": "2 locations"
        },
        {
          "name": "Sammataro",
          "detail": "2 locations"
        }
      ],
      "names": [
        "DeSano Pizzeria Napoletana",
        "DeSano Pizzeria Napoletana",
        "DeSano Pizzeria Napoletana - Slaughter",
        "Allday Pizza",
        "Allday Pizza - Tarrytown",
        "Bufalina",
        "Bufalina Due LLC",
        "Home Slice Pizza",
        "Home Slice Pizza",
        "Little Deli & Pizzeria",
        "Little Deli & Pizzeria",
        "Pedroso's Pizza",
        "Pedroso's Pizza - Airport",
        "Pinthouse Pizza",
        "Pinthouse Pizza - South Lamar",
        "Sammataro - East Austin",
        "Sammataro - Slice Shop"
      ],
      "note": "11 brands appear in both; the 8 with the most locations are shown"
    },
    {
      "type": "end",
      "hold": 8.0,
      "lines": [
        "Navigate the map at",
        "austin.chat/apps/austin-pizza"
      ]
    }
  ]
};
