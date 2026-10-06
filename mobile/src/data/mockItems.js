// Placeholder data used until the FastAPI backend is running.
// NOTE: list items carry ONLY public info. Private questions and answers
// are never sent to the list screen. IDs, cards and phones never appear
// here either; they are routed to Campus Security on the server.
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

export const mockItems = [
  { id: 417, title: 'Black water bottle', category: 'Bottles', location: 'Library, 2nd floor', foundAt: hoursAgo(2), status: 'open' },
  { id: 416, title: 'Grey hoodie, size M', category: 'Clothing', location: 'SE12 lobby', foundAt: hoursAgo(5), status: 'open' },
  { id: 415, title: 'Wired earbuds in a case', category: 'Electronics', location: 'Cafeteria', foundAt: hoursAgo(9), status: 'open' },
  { id: 414, title: 'Set of keys on a lanyard', category: 'Keys', location: 'Gym entrance', foundAt: hoursAgo(26), status: 'open' },
  { id: 413, title: 'Blue backpack', category: 'Bags', location: 'Bus loop bench', foundAt: hoursAgo(30), status: 'claim pending' },
  { id: 412, title: 'Scientific calculator', category: 'Electronics', location: 'SW1 room 2310', foundAt: hoursAgo(52), status: 'open' },
];

export const categories = ['All', 'Bags', 'Bottles', 'Clothing', 'Electronics', 'Keys', 'Other'];
