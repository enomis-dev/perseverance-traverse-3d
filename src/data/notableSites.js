// Hand-picked notable stops along the traverse. Coordinates are pulled
// directly from the real NASA waypoints feed (nearest available sol to
// each publicly reported milestone) -- see memory/project_data_sources.md
// for how these sol numbers were sourced and why this is a best-effort
// mapping rather than an official per-sample coordinate feed.
export const NOTABLE_SITES = [
  {
    "type": "landing",
    "name": "Landing Site",
    "sol": 13,
    "lat": 18.44462715,
    "lon": 77.45088572,
    "description": "Octavia E. Butler Landing \u2014 touchdown, Feb 18, 2021 (Sol 0). This is the first localized position, Sol 13."
  },
  {
    "type": "sample",
    "name": "Rochette \u2014 First Rock Core",
    "sol": 180,
    "lat": 18.4307394,
    "lon": 77.44436574,
    "description": "First successful rock core samples (Montdenier / Montagnac), Sol ~194, Sept 2021 -- the mission's first cached samples."
  },
  {
    "type": "sample",
    "name": "Issole \u2014 Malay Sample",
    "sol": 335,
    "lat": 18.43260907,
    "lon": 77.44131402,
    "description": "Rock core sample \"Malay\" from the Issole target, Sol ~337, Jan 2022."
  },
  {
    "type": "sample",
    "name": "Amalik \u2014 Delta Front Sample",
    "sol": 565,
    "lat": 18.45072631,
    "lon": 77.4014403,
    "description": "Sedimentary sample \"Mageik\" from the Amalik target on the Jezero delta front, Sol ~579, Oct 2022."
  },
  {
    "type": "milestone",
    "name": "Sol 1000 Milestone",
    "sol": 1000,
    "lat": 18.49539581,
    "lon": 77.34664678,
    "description": "Perseverance passes 1,000 Martian sols on Mars with its sample collection well underway."
  },
  {
    "type": "current",
    "name": "Most Recent Position",
    "sol": 1980,
    "lat": 18.43687407,
    "lon": 77.23205444,
    "description": "Latest tracked position in this dataset, Sol 1980."
  }
];
