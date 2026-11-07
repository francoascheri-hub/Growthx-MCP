export type Attendee = {
  name: string;
  role: string; // e.g. "Founder", "Investor", "Engineer"
  company: string;
  interests: string[];
  looking_for?: string; // e.g. "seed investors", "design partners"
};

export type GxEvent = {
  id: string; // slug, e.g. "sf-ai-agents-night-2026-11-10"
  title: string;
  description: string;
  start: string; // ISO 8601 with offset, America/Los_Angeles (e.g. 2026-11-10T18:00:00-08:00)
  end: string;
  venue: string;
  neighborhood: string; // e.g. "SoMa", "Mission"
  city: string; // "San Francisco"
  url: string; // Luma registration link
  host: string;
  tags: string[]; // lowercase, e.g. ["ai", "agents", "devtools"]
  audience: string[]; // lowercase, e.g. ["founders", "engineers", "investors"]
  capacity: number;
  price: string; // "Free" or "$25"
  attendees: Attendee[]; // public/sample notable attendees (example data)
  sponsors_wanted: boolean;
  sponsor_tiers?: { name: string; price_usd: number; perks: string }[];
  sponsors?: string[]; // companies that sponsored this event (intel graph)
  community_sponsors?: string[]; // companies that sponsored the hosting communities (intel graph)
  communities?: string[]; // communities hosting/listing this event (intel graph)
  registered?: number;
  source: "growthx-intel" | "fixtures" | "luma";
};
