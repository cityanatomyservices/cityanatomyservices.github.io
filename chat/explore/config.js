// Add future themes here. Each GeoJSON uses the same event/place property contract.
window.EXPLORE_LAYERS = [
  {
    id: 'free-cheap', title: 'Free & cheap', description: 'Events and activities for $20 or less',
    url: '/chat/data/explore/free-cheap.geojson', defaultOn: true
  },
  {
    id: 'movies', title: 'Movies', description: 'IMAX, Alamo Drafthouse & Violet Crown showtimes',
    url: '/chat/data/explore/movies.geojson', defaultOn: false, color: '#7844a8'
  },
  { id: 'live-music', title: 'Live Music', description: 'Concerts and live performances', color: '#b72e77', defaultOn: false, url: '/chat/data/explore/live-music.geojson' },
  { id: 'live-comedy', title: 'Live Comedy', description: 'Stand-up, improv and comedy shows', color: '#6b53a1', defaultOn: false, url: '/chat/data/explore/live-comedy.geojson' },
  { id: 'pop-up-markets', title: 'Pop up markets', description: 'Artisan, vintage and farmers’ markets around Austin', color: '#a95e13', defaultOn: false, url: '/chat/data/explore/pop-up-markets.geojson' },
  { id: 'events', title: 'Events & Festivals', description: 'Community celebrations, arts, talks, tours and activities', color: '#007f91', defaultOn: false, url: '/chat/data/explore/events-festivals.geojson' }
];
