import { Game, Season, Sport, Gender } from './types';

const OPPONENTS = [
  "Durham Academy", 
  "Ravenscroft", 
  "Cary Christian", 
  "Grace Christian", 
  "NRCA", 
  "St Davids", 
  "St Marys", 
  "Franklin Academy", 
  "Wake Christian", 
  "St Timothys", 
  "Magellan", 
  "Chapel Hill", 
  "Trinity Academy", 
  "Felton Grove", 
  "St. Michaels", 
  "Raleigh Hawks"
];

const TIMES = ["4:00 PM", "4:30 PM", "5:00 PM"];

function getRandom(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateAllMockGames(): Game[] {
  const games: Game[] = [];
  let idCounter = 1;

  const seasons: { name: Season; months: number[] }[] = [
    { name: "Fall", months: [8, 9, 10] },    // Aug, Sept, Oct
    { name: "Winter", months: [11, 0, 1] },   // Nov, Dec, Jan
    { name: "Spring", months: [2, 3, 4] }     // Mar, Apr, May
  ];

  const sportsMap: Record<Season, Array<{ sport: Sport; gender: Gender; levels: string[] }>> = {
    Fall: [
      { sport: "Soccer", gender: "Mens", levels: ["JV", "MS Blue", "MS Gold"] },
      { sport: "Golf", gender: "Mens", levels: ["Varsity"] },
      { sport: "Field Hockey", gender: "Womens", levels: ["Varsity", "Middle School"] },
      { sport: "Tennis", gender: "Womens", levels: ["Varsity", "Middle School"] },
      { sport: "Volleyball", gender: "Womens", levels: ["Varsity", "JV", "MS Blue", "MS Gold"] },
      { sport: "Ultimate Frisbee", gender: "Mens", levels: ["Varsity"] },
      { sport: "Cross Country", gender: "Co-Ed", levels: ["Varsity", "Middle School"] }
    ],
    Winter: [
      { sport: "Basketball", gender: "Mens", levels: ["Varsity", "JV", "MS Blue", "MS Gold", "MS Chargers"] },
      { sport: "Basketball", gender: "Womens", levels: ["Varsity", "MS Blue", "MS Gold"] },
      { sport: "Cheer", gender: "Womens", levels: ["Varsity", "MS"] },
      { sport: "Wrestling", gender: "Mens", levels: ["Varsity"] },
      { sport: "Swimming", gender: "Co-Ed", levels: ["Varsity"] },
      { sport: "Indoor Track & Field", gender: "Co-Ed", levels: ["Varsity"] }
    ],
    Spring: [
      { sport: "Baseball", gender: "Mens", levels: ["Varsity", "MS"] },
      { sport: "Golf", gender: "Mens", levels: ["Varsity"] },
      { sport: "Lacrosse", gender: "Mens", levels: ["Varsity", "MS"] },
      { sport: "Lacrosse", gender: "Womens", levels: ["Varsity"] },
      { sport: "Soccer", gender: "Womens", levels: ["Varsity", "MS"] },
      { sport: "Softball", gender: "Womens", levels: ["Varsity", "MS"] },
      { sport: "Tennis", gender: "Mens", levels: ["Varsity", "JV", "MS"] },
      { sport: "Volleyball", gender: "Mens", levels: ["Varsity"] },
      { sport: "Track & Field", gender: "Co-Ed", levels: ["Varsity", "MS"] }
    ]
  };

  seasons.forEach(season => {
    const sports = sportsMap[season.name];
    
    sports.forEach(sConfig => {
      sConfig.levels.forEach(level => {
        // Generate 10-15 games per specific team
        const gameCount = 10 + Math.floor(Math.random() * 6);
        
        for (let i = 0; i < gameCount; i++) {
          let opponent = getRandom(OPPONENTS);
          
          // Special cases
          if (opponent === "St Marys" && sConfig.gender !== "Womens") {
            opponent = "Ravenscroft"; // Swap if mens sport
          }
          if (opponent === "St Timothys" && !level.includes("MS") && !level.includes("Middle")) {
            opponent = "Durham Academy"; // Swap if varsity
          }

          const isHome = Math.random() > 0.5;
          const month = getRandom(season.months);
          const day = 1 + Math.floor(Math.random() * 28);
          const year = month < 6 ? 2026 : 2025; // 2025-26 Season
          
          const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

          games.push({
            id: `game-${idCounter++}`,
            date: dateStr,
            time: getRandom(TIMES),
            opponent: opponent,
            location: isHome ? "Cary Academy" : opponent,
            gameType: isHome ? "Home" : "Away",
            sport: sConfig.sport,
            gender: sConfig.gender,
            season: season.name,
            academicYear: "2025-26",
            level: level as any,
            field: isHome ? (sConfig.sport === "Soccer" || sConfig.sport === "Lacrosse" ? "Stadium Field" : "Main Gym") : "Main Field",
            earlyReleaseTime: level.includes("MS") ? "2:45 PM" : "3:15 PM",
            busDepartureTime: isHome ? undefined : "3:30 PM",
            notes: "Please arrive 45 minutes prior to game time."
          });
        }
      });
    });
  });

  // Inject multiple games for "Today" (2026-04-30)
  const todayStr = "2026-04-30";
  const todayGames: Game[] = [
    {
      id: `game-today-1`,
      date: todayStr,
      time: "4:30 PM",
      opponent: "Durham Academy",
      location: "Cary Academy",
      gameType: "Home",
      sport: "Soccer",
      gender: "Womens",
      season: "Spring",
      academicYear: "2025-26",
      level: "Varsity",
      field: "Stadium Field",
      earlyReleaseTime: "3:15 PM",
      notes: "Pack both uniforms."
    },
    {
      id: `game-today-2`,
      date: todayStr,
      time: "5:00 PM",
      opponent: "Ravenscroft",
      location: "Ravenscroft",
      gameType: "Away",
      sport: "Baseball",
      gender: "Mens",
      season: "Spring",
      academicYear: "2025-26",
      level: "Varsity",
      field: "Main Field",
      earlyReleaseTime: "3:00 PM",
      busDepartureTime: "3:15 PM",
      notes: "Full grays."
    },
    {
      id: `game-today-3`,
      date: todayStr,
      time: "4:15 PM",
      opponent: "NRCA",
      location: "Cary Academy",
      gameType: "Home",
      sport: "Tennis",
      gender: "Mens",
      season: "Spring",
      academicYear: "2025-26",
      level: "JV",
      field: "Upper Courts",
      earlyReleaseTime: "3:15 PM",
      notes: "Warm up starts at 3:45."
    }
  ];
  
  return [...games, ...todayGames];
}
