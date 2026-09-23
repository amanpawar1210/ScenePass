export const seedEvents = [
  { seq: 1, type: "LIVE MUSIC", title: "Afterlight", sub: "A one-night audiovisual arena experience", date: "SAT · 28 SEP", venue: "Nova Arena", city: "Bengaluru", price: 1499, color: "coral" },
  { seq: 2, type: "THEATRE", title: "The Last Monsoon", sub: "An immersive story staged in the round", date: "FRI · 04 OCT", venue: "Ranga Shankara", city: "Bengaluru", price: 899, color: "wine" },
  { seq: 3, type: "COMEDY", title: "Mostly Honest", sub: "A sharp new hour by four breakout comics", date: "SUN · 06 OCT", venue: "Good Shepherd Auditorium", city: "Bengaluru", price: 699, color: "copper" },
  { seq: 4, type: "SPORT", title: "City Derby", sub: "The loudest football night of the season", date: "SAT · 12 OCT", venue: "Kanteerava Stadium", city: "Bengaluru", price: 1099, color: "wine" },
  { seq: 5, type: "MOVIE", title: "Astra: First Signal", sub: "Premiere screening and cast conversation", date: "FRI · 18 OCT", venue: "PVR Director's Cut", city: "Mumbai", price: 549, color: "coral" },
  { seq: 6, type: "LIVE MUSIC", title: "Indigo Rooms", sub: "An intimate jazz and soul residency", date: "SAT · 19 OCT", venue: "The Lalit Lawns", city: "Delhi", price: 1299, color: "copper" },
  { seq: 7, type: "FOOD", title: "The Night Market", sub: "Thirty chefs, one open-air feast", date: "SUN · 20 OCT", venue: "Jayamahal Palace", city: "Bengaluru", price: 399, color: "copper" },
  { seq: 8, type: "WORKSHOP", title: "Frame by Frame", sub: "A hands-on filmmaking lab", date: "SAT · 26 OCT", venue: "BIC, Domlur", city: "Bengaluru", price: 799, color: "wine" },
  { seq: 9, type: "DANCE", title: "Rhythm & Ritual", sub: "Classical dance in a new light", date: "SUN · 27 OCT", venue: "NCPA Experimental Theatre", city: "Mumbai", price: 1199, color: "coral" },
  { seq: 10, type: "LIVE MUSIC", title: "Rooftop Sessions", sub: "Indie favourites above the city", date: "FRI · 01 NOV", venue: "Skyline Social", city: "Hyderabad", price: 999, color: "copper" },
  { seq: 11, type: "ART", title: "New Perspectives", sub: "An after-hours gallery opening", date: "SAT · 02 NOV", venue: "Kiran Nadar Museum", city: "Delhi", price: 499, color: "wine" },
  { seq: 12, type: "EXHIBITION", title: "The Wonder Lab", sub: "A science museum night for everyone", date: "SUN · 03 NOV", venue: "Visvesvaraya Museum", city: "Bengaluru", price: 349, color: "coral" },
];

export const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad"];

const BLOCKED = [4, 10, 17, 24, 31, 42, 55, 63];
const TIERS = [
  { name: "Platinum", price: 2499 },
  { name: "Gold", price: 1899 },
  { name: "Silver", price: 1499 },
];

// 6 rows (A–F) × 12 seats; two rows per price tier.
export const seatLayout = Array.from({ length: 72 }, (_, i) => {
  const tier = TIERS[Math.floor(i / 24)];
  return {
    id: `${String.fromCharCode(65 + Math.floor(i / 12))}${(i % 12) + 1}`,
    price: tier.price,
    tier: tier.name,
    blocked: BLOCKED.includes(i),
  };
});
