// Add future themes here. Each GeoJSON uses the same event/place property contract.
window.EXPLORE_LAYERS = [
  {
    id: 'free-cheap', title: 'Free & cheap', description: 'Events and activities for $20 or less',
    url: '/chat/data/explore/free-cheap.geojson', defaultOn: true
  },
  {
    id: 'movies', title: 'Movies', description: 'IMAX, Alamo Drafthouse & Violet Crown showtimes',
    url: '/chat/data/explore/movies.geojson', defaultOn: false, color: '#7844a8'
  }
];
