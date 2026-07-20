import type { EventItem, Member, Post, Section, Thread, View } from "./types";

export const VIEW_META: Record<
  View,
  { label: string; short: string; rail: string; chip: string; dot: string; blurb: string }
> = {
  us: {
    label: "US View",
    short: "US",
    rail: "bg-denim",
    chip: "bg-denim-soft text-denim",
    dot: "bg-denim",
    blurb: "Diaspora community, US-side business, and outbound plans.",
  },
  nepal: {
    label: "Nepal View",
    short: "Nepal",
    rail: "bg-rhodo",
    chip: "bg-rhodo-soft text-rhodo",
    dot: "bg-rhodo",
    blurb: "Local operators, vendors, and on-the-ground opportunities.",
  },
  bridge: {
    label: "Bridge View",
    short: "Bridge",
    rail: "bg-pine",
    chip: "bg-pine-soft text-pine",
    dot: "bg-pine",
    blurb: "Cross-border deals, joint events, and corridor-wide threads.",
  },
};

export const SECTIONS: Section[] = [
  { slug: "welcome", name: "Welcome", description: "New members introduce themselves to the network." },
  { slug: "business-opportunities", name: "Business Opportunities", description: "Deals, partnerships, sourcing, and cross-border openings." },
  { slug: "travel-plans", name: "Travel Plans", description: "Upcoming trips, meetup windows, and travel logistics." },
  { slug: "vendor-showcase", name: "Vendor Showcase", description: "Members present their products, services, and capabilities." },
  { slug: "events", name: "Events", description: "Gatherings, mixers, and conference plans across the corridor." },
  { slug: "ask-the-network", name: "Ask the Network", description: "Questions answered by people who have done it before." },
  { slug: "resources", name: "Resources", description: "Guides, contacts, and documents worth keeping." },
];

export const CURRENT_USER: Member = {
  id: "me",
  name: "Prabhat",
  role: "Entrepreneur",
  location: "US",
  country: "us",
  bio: "Founder, BridgeLink. Building the US–Nepal corridor.",
};

export const MEMBERS: Member[] = [
  { id: "m1", name: "Sabina Gurung", role: "Business Owner", location: "Boston, MA", country: "us", bio: "Owner of two Himalayan restaurants; sourcing spices and staff pipelines from Nepal." },
  { id: "m2", name: "Prakash Shrestha", role: "Business Owner", location: "Kathmandu", country: "nepal", bio: "Runs a licensed tour operation; 14 years of trekking and cultural itineraries." },
  { id: "m3", name: "Deepak Adhikari", role: "Investor", location: "Dallas, TX", country: "us", bio: "Angel investor in diaspora-led businesses; interested in logistics and fintech." },
  { id: "m4", name: "Maya Tamang", role: "Business Owner", location: "Pokhara", country: "nepal", bio: "Handicraft exporter working with 40+ artisan families; ships to US retailers." },
  { id: "m5", name: "Anil KC", role: "Entrepreneur", location: "Queens, NY", country: "us", bio: "Building a freight-forwarding service for small US–Nepal shipments." },
  { id: "m6", name: "Rojina Maharjan", role: "Creator", location: "Lalitpur", country: "nepal", bio: "Documents Newari food and craft; 120k followers across platforms." },
  { id: "m7", name: "Bishal Thapa", role: "Entrepreneur", location: "Boston, MA", country: "us", bio: "Fintech founder exploring remittance rails; ex-payments engineer." },
  { id: "m8", name: "Tenzing Lama", role: "Business Owner", location: "Kathmandu", country: "nepal", bio: "Operates high-altitude expedition logistics; hiring US-market sales help." },
  { id: "m9", name: "Priya Sharma", role: "Professional", location: "San Francisco, CA", country: "us", bio: "Product manager; volunteers with diaspora business associations." },
];

export const SEED_POSTS: Post[] = [
  { id: "p1", authorId: "m2", section: "vendor-showcase", view: "nepal", createdAt: "2h ago", likes: 12, replies: 4, body: "Namaste all — we just finalized our fall trekking calendar. If any US members are planning group trips for clients or family, we can hold blocks on Annapurna and Langtang departures through September. Licensed guides, insurance included." },
  { id: "p2", authorId: "m5", section: "business-opportunities", view: "bridge", createdAt: "5h ago", likes: 18, replies: 9, body: "I have 60% of a container booked KTM → Newark for late August. Room for roughly 8 more pallets. If you import handicrafts, textiles, or packaged foods and want to split freight, reply here — consolidating saves everyone about a third on cost." },
  { id: "p3", authorId: "m1", section: "ask-the-network", view: "us", createdAt: "8h ago", likes: 7, replies: 11, body: "For restaurant owners here: who are you using for bulk spice imports with reliable FDA paperwork? Our current supplier keeps missing documentation and shipments sit in customs for weeks." },
  { id: "p4", authorId: "m4", section: "vendor-showcase", view: "nepal", createdAt: "1d ago", likes: 21, replies: 6, body: "New lot of hand-loomed dhaka and felt products ready for wholesale. We handle export paperwork ourselves and have shipped to retailers in Texas and California. Happy to send the catalog to any member — small trial orders welcome." },
  { id: "p5", authorId: "m3", section: "business-opportunities", view: "us", createdAt: "1d ago", likes: 15, replies: 8, body: "I'm setting aside capital this year specifically for diaspora-led businesses in food, logistics, and travel. If you run one and are past the idea stage, introduce yourself in Welcome and tag me — I read every intro in this network." },
  { id: "p6", authorId: "m7", section: "ask-the-network", view: "bridge", createdAt: "2d ago", likes: 9, replies: 14, body: "Question for both sides of the corridor: what is your current cost per $1,000 sent US → Nepal, all fees included? Building a comparison sheet for the Resources section and want real numbers, not advertised rates." },
  { id: "p7", authorId: "m6", section: "travel-plans", view: "nepal", createdAt: "2d ago", likes: 11, replies: 3, body: "Filming a series on Newari craftsmanship in Bhaktapur next month. If any member businesses want their workshop featured — woodcarving, pottery, metalwork — I have two open slots. Great exposure to a US audience." },
  { id: "p8", authorId: "m9", section: "events", view: "us", createdAt: "3d ago", likes: 6, replies: 2, body: "Bay Area members: the diaspora business association is hosting a small-business legal clinic next month. Free 30-minute consults on entity setup and import compliance. I can share registration with anyone interested." },
  { id: "p9", authorId: "m8", section: "welcome", view: "bridge", createdAt: "3d ago", likes: 14, replies: 5, body: "Hello from Kathmandu. I run expedition logistics for high-altitude climbs and I'm looking for a US-based partner to handle sales for the 2027 season. Twenty years in the mountains; new to selling in America. Glad this room exists." },
];

export const EVENTS: EventItem[] = [
  { id: "e1", title: "NABIS 2026 — BridgeLink Meetup", date: "2026-09-18", time: "6:00 PM CT", mode: "In person", location: "Dallas, TX", view: "us", description: "Informal meetup for members attending NABIS. Meet the founding cohort in person." },
  { id: "e2", title: "Greater NY Nepali Chamber Mixer", date: "2026-08-06", time: "6:30 PM ET", mode: "In person", location: "Queens, NY", view: "us", description: "Monthly Chamber networking night. BridgeLink members get introduced as a group." },
  { id: "e3", title: "Vendor Onboarding Workshop", date: "2026-08-12", time: "7:00 PM NPT", mode: "Online", location: "Zoom", view: "nepal", description: "How to present your business in the Vendor Showcase and prepare for the marketplace phase." },
  { id: "e4", title: "Boston Corridor Founders Dinner", date: "2026-08-28", time: "7:00 PM ET", mode: "In person", location: "Boston, MA", view: "bridge", description: "Small dinner for founders working across both markets. Limited to 12 seats." },
];

export const THREADS: Thread[] = [
  { id: "t1", withId: "m5", snippet: "The container split — I can hold 2 pallets for you…", messages: [
    { from: "them", text: "Saw you might have inventory coming from Pokhara. The container split — I can hold 2 pallets for you until Friday." },
    { from: "me", text: "That timing works. What are the dimensions per pallet and the drop point in Newark?" },
    { from: "them", text: "Standard 48x40, max 1,500 lbs each. Drop is a bonded warehouse in Elizabeth, NJ — I'll send the sheet here." },
  ]},
  { id: "t2", withId: "m1", snippet: "Would love an intro to your spice supplier if…", messages: [
    { from: "them", text: "Would love an intro to your spice supplier if the paperwork issue gets sorted. Same pain on my side." },
  ]},
  { id: "t3", withId: "m3", snippet: "Read your intro — let's talk when you're ready.", messages: [
    { from: "them", text: "Read your intro — let's talk when you're ready. I like what this network is becoming." },
  ]},
];

export function memberById(id: string): Member {
  if (id === "me") return CURRENT_USER;
  return MEMBERS.find((m) => m.id === id) ?? CURRENT_USER;
}

export function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function formatEventDate(iso: string): { month: string; day: string } {
  const d = new Date(iso + "T00:00:00");
  return {
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()),
  };
}
