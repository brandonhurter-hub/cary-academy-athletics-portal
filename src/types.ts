export type Season = "Fall" | "Winter" | "Spring";

export type Sport = 
  | "Football" 
  | "Basketball" 
  | "Soccer" 
  | "Volleyball" 
  | "Cross Country" 
  | "Track & Field" 
  | "Swimming" 
  | "Tennis" 
  | "Golf" 
  | "Lacrosse" 
  | "Baseball" 
  | "Softball"
  | "Field Hockey"
  | "Ultimate Frisbee"
  | "Cheer"
  | "Indoor Track & Field"
  | "Wrestling";

export type Gender = "Mens" | "Womens" | "Co-Ed";

export type GameType = "Home" | "Away" | "Neutral";

export type UserRole = "admin" | "coach";

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
}

export interface Game {
  id: string;
  date: string;
  time: string;
  opponent: string;
  location: string;
  gameType: GameType;
  result?: string;
  sport: Sport;
  gender: Gender;
  season: Season;
  academicYear: "2025-26" | "2026-27";
  level: "Varsity" | "JV" | "Middle School" | "MS Blue" | "MS Gold";
  field?: string;
  earlyReleaseTime?: string;
  busDepartureTime?: string;
  notes?: string;
}

export interface SheetConfig {
  spreadsheetId: string;
  range: string;
}
