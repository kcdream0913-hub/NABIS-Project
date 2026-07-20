export type View = "us" | "nepal" | "bridge";

export type Role =
  | "Business Owner"
  | "Entrepreneur"
  | "Investor"
  | "Creator"
  | "Professional";

export interface Member {
  id: string;
  name: string;
  role: Role;
  location: string;
  country: "us" | "nepal";
  bio: string;
}

export interface Post {
  id: string;
  authorId: string;
  section: string; // section slug
  view: View;
  body: string;
  createdAt: string; // display string for mock data
  likes: number;
  replies: number;
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // ISO date
  time: string;
  mode: "In person" | "Online";
  location: string;
  view: View;
  description: string;
}

export interface Section {
  slug: string;
  name: string;
  description: string;
}

export interface Thread {
  id: string;
  withId: string;
  snippet: string;
  messages: { from: "me" | "them"; text: string }[];
}
