/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Calendar, 
  ChevronRight, 
  Filter, 
  AlertCircle,
  ShieldAlert,
  Wind,
  ArrowLeft,
  Clock,
  MapPin,
  School,
  Info,
  Maximize2,
  Minimize2,
  LogIn,
  LogOut,
  User as UserIcon,
  Save,
  Edit3,
  X
} from 'lucide-react';
import { cn } from './lib/utils';
import { Sport, Gender, Game, Season, UserRole } from './types';
import { 
  auth, 
  loginWithGoogle, 
  loginWithEmail,
  logout, 
  db, 
  handleFirestoreError, 
  OperationType,
  resetPassword
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc, 
  getDoc,
  writeBatch,
  getDocs
} from 'firebase/firestore';

// New Sports Organization
const SPORTS_BY_SEASON: Record<Season, { mens: string[], womens: string[], coed: string[] }> = {
  Fall: {
    mens: ["Soccer", "Golf", "Ultimate Frisbee"],
    womens: ["Field Hockey", "Tennis", "Volleyball"],
    coed: ["Cross Country"]
  },
  Winter: {
    mens: ["Basketball", "Wrestling"],
    womens: ["Basketball", "Cheer"],
    coed: ["Indoor Track & Field", "Swimming"]
  },
  Spring: {
    mens: ["Baseball", "Golf", "Lacrosse", "Tennis", "Volleyball"],
    womens: ["Lacrosse", "Soccer", "Softball"],
    coed: ["Track & Field"]
  }
};

const SEASONS: Season[] = ["Fall", "Winter", "Spring"];
const GENDERS: Gender[] = ["Mens", "Womens", "Co-Ed"];

const calculateEarlyRelease = (timeStr: string) => {
  const [time, modifier] = timeStr.split(' ');
  if (!time || !modifier) return "N/A";
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  
  // Randomly choose between 1h and 1h 30m
  const offsetMinutes = Math.random() > 0.5 ? 60 : 90;
  date.setMinutes(date.getMinutes() - offsetMinutes);
  
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const mod = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  
  return `${h}:${m} ${mod}`;
};

function GameRow({ game, onClick, isSmall = false }: { game: Game; onClick: () => void; isSmall?: boolean; key?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className={cn(
        "bg-white border border-slate-100 rounded-2xl p-6 flex items-center justify-between hover:border-ca-gold hover:shadow-lg transition-all cursor-pointer group active:scale-[0.99]",
        isSmall ? "p-4" : "p-6"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-6">
        <div className="text-center min-w-[60px]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
            {new Date(game.date).toLocaleDateString('en-US', { month: 'short' })}
          </p>
          <p className="text-2xl font-black text-ca-blue leading-none italic uppercase">
            {new Date(game.date).toLocaleDateString('en-US', { day: '2-digit' })}
          </p>
        </div>
        
        <div className="w-[2px] h-10 bg-slate-100" />
        
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-white bg-ca-navy px-1.5 py-0.5 rounded leading-none uppercase tracking-tighter">
              {game.level}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{game.gender} {game.sport}</span>
          </div>
          <h4 className={cn("font-black italic uppercase text-ca-blue tracking-tight leading-none", isSmall ? "text-lg" : "text-2xl")}>
            vs {game.opponent}
          </h4>
        </div>
      </div>

      <div className="flex items-center gap-8 text-right">
        {game.earlyReleaseTime && !isSmall && (
          <div className="hidden lg:block border-r border-slate-100 pr-8 mr-2">
            <p className="text-[9px] font-black text-ca-gold uppercase tracking-widest mb-1">Release</p>
            <p className="font-black text-ca-navy text-lg">{game.earlyReleaseTime}</p>
          </div>
        )}
        <div className="hidden md:block">
          <p className={cn(
            "text-[9px] font-black uppercase tracking-widest mb-1 flex items-center justify-end gap-1",
            game.gameType === 'Home' ? "text-ca-blue" : "text-ca-gold"
          )}>
            <MapPin size={10} />
            {game.gameType} Venue
          </p>
          <p className={cn(
            "font-bold text-xs px-2 py-0.5 rounded",
            game.gameType === 'Home' ? "bg-ca-blue/5 text-ca-blue" : "bg-ca-gold/10 text-ca-navy"
          )}>{game.location}</p>
        </div>
        <div>
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Kickoff</p>
          <p className={cn("font-black text-ca-blue", isSmall ? "text-lg" : "text-2xl")}>{game.time}</p>
        </div>
        <ChevronRight size={20} className="text-slate-200 group-hover:text-ca-gold group-hover:translate-x-1 transition-all" />
      </div>
    </motion.div>
  );
}

function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'google' | 'email'>('google');

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-ca-navy/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white w-full max-w-md rounded-3xl p-10 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-6">
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-ca-navy flex items-center justify-center rounded-2xl mx-auto mb-4 text-ca-gold shadow-lg">
            <LogIn size={32} />
          </div>
          <h2 className="text-3xl font-black italic uppercase text-ca-blue tracking-tight leading-none mb-2">Staff Portal</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Athletic Dept & Coaches Access</p>
        </div>

        <div className="flex gap-1 bg-slate-50 p-1 rounded-xl mb-8">
          <button 
            onClick={() => setMethod('google')}
            className={cn(
              "flex-1 py-3 px-4 rounded-lg text-[10px] font-black uppercase transition-all",
              method === 'google' ? "bg-white text-ca-blue shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Google
          </button>
          <button 
            onClick={() => setMethod('email')}
            className={cn(
              "flex-1 py-3 px-4 rounded-lg text-[10px] font-black uppercase transition-all",
              method === 'email' ? "bg-white text-ca-blue shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Email Login
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {method === 'google' ? (
            <motion.div
              key="google"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <button 
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-white border-2 border-slate-100 py-4 rounded-2xl flex items-center justify-center gap-3 hover:border-ca-gold transition-all group overflow-hidden relative"
              >
                <div className="flex items-center gap-3 relative z-10">
                   <svg className="w-5 h-5" viewBox="0 0 24 24">
                     <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                     <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                     <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                     <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                   </svg>
                   <span className="font-black text-[11px] uppercase tracking-widest text-slate-600">Sign in with Google</span>
                </div>
                {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center"><div className="w-5 h-5 border-2 border-ca-navy border-t-transparent rounded-full animate-spin" /></div>}
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleEmailLogin}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 font-bold text-ca-blue focus:border-ca-gold focus:ring-4 focus:ring-ca-gold/5 outline-none transition-all placeholder:text-slate-300"
                  placeholder="name@school.edu"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-5 font-bold text-ca-blue focus:border-ca-gold focus:ring-4 focus:ring-ca-gold/5 outline-none transition-all placeholder:text-slate-300"
                  placeholder="••••••••"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-ca-navy text-ca-gold rounded-2xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden"
              >
                {loading ? <div className="w-5 h-5 border-2 border-ca-gold border-t-transparent rounded-full animate-spin mx-auto" /> : 'Sign In'}
              </button>
              <button 
                type="button"
                onClick={() => email && resetPassword(email)}
                className="w-full text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-ca-blue transition-colors mt-2"
              >
                Forgot Password?
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="mt-8 text-[9px] font-black text-slate-300 uppercase tracking-tighter text-center max-w-[200px] mx-auto leading-relaxed">
          Authorized personnel only. Access is monitored by the Athletics Department.
        </p>
      </motion.div>
    </div>
  );
}


export default function App() {

  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoaded, setGamesLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedGame, setEditedGame] = useState<Game | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const [selectedSeason, setSelectedSeason] = useState<Season>('Spring');
  const [selectedYear, setSelectedYear] = useState<"2025-26" | "2026-27">("2025-26");
  const [selectedGender, setSelectedGender] = useState<Gender>('Mens');
  const [selectedSport, setSelectedSport] = useState<string | 'All'>('All');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  // Sync with Firebase
  useEffect(() => {
    // 1. Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch role
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role as UserRole);
          } else {
            // Default to coach for testers or use email for admin bootstrap
            const admins = ['bhurter24@gmail.com', 'ohurter28@gmail.com', 'qais.nasim@gmail.com'];
            if (u.email && admins.includes(u.email)) {
              setUserRole('admin');
              // Ensure admin profile exists in Firestore for RBAC rules
              await setDoc(doc(db, 'users', u.uid), {
                uid: u.uid,
                email: u.email,
                role: 'admin',
                displayName: u.displayName || 'Admin'
              }, { merge: true });
            } else {
              setUserRole(null); 
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }
    });

    // 2. Games Listener
    const unsubscribeGames = onSnapshot(collection(db, 'games'), (snapshot) => {
      const gList: Game[] = [];
      snapshot.forEach(doc => {
        gList.push({ ...doc.data(), id: doc.id } as Game);
      });
      setGames(gList);
      setGamesLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'games');
    });

    return () => {
      unsubscribeAuth();
      unsubscribeGames();
    };
  }, []);

  const handleSaveGame = async () => {
    if (!editedGame) return;
    try {
      await updateDoc(doc(db, 'games', editedGame.id), { ...editedGame });
      setSelectedGame(editedGame);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `games/${editedGame.id}`);
    }
  };

  const isUserAdmin = userRole === 'admin' || 
    ['bhurter24@gmail.com', 'ohurter28@gmail.com', 'qais.nasim@gmail.com'].includes(user?.email || '');

  const TODAY_STR = new Date().toISOString().split('T')[0];

  // Local Mock Generation for fallback
  const LOCAL_MOCK_GAMES = useMemo(() => {
    if (!gamesLoaded || (games.length > 0 && games.some(g => g.season === 'Winter') && games.some(g => g.season === 'Spring'))) return [];
    
    const TEAMS = [
      { name: "Durham Academy" },
      { name: "Ravenscroft" },
      { name: "Cary Christian" },
      { name: "Grace Christian" },
      { name: "NRCA" },
      { name: "St Davids" },
      { name: "St Marys", womensOnly: true },
      { name: "Franklin Academy" },
      { name: "Wake Christian" },
      { name: "St Timothys", msOnly: true },
      { name: "Magellan" },
      { name: "Chapel Hill" },
      { name: "Trinity Academy" },
      { name: "Felton Grove" },
      { name: "St. Michaels" },
      { name: "Raleigh Hawks" }
    ];

    const TIMES = ["4:00 PM", "4:30 PM", "5:00 PM"];
    const generated: Game[] = [];

    const YEARS: ("2025-26" | "2026-27")[] = ["2025-26", "2026-27"];

    const getSeasonDate = (season: Season, index: number, teamIndex: number, academicYear: string) => {
      const year = academicYear === "2025-26" ? 2026 : 2027;
      
      // Force the first two games to be TODAY for demo purposes in current academic year
      if (academicYear === "2025-26" && index === 0 && (teamIndex === 0 || teamIndex === 1)) {
        return TODAY_STR;
      }
      
      let startMonth = 0;
      if (season === 'Fall') {
        startMonth = 7; // August
      } else if (season === 'Winter') {
        startMonth = 10; // November
      } else if (season === 'Spring') {
        startMonth = 2; // March
      }
      
      const date = new Date(year, startMonth, 1);
      // Stagger games across 3 months of the season, avoiding direct overlapping with forced today games
      date.setDate(date.getDate() + (index * 8) + (teamIndex % 5) + 5);
      return date.toISOString().split('T')[0];
    };

    TEAMS.forEach((team, teamIndex) => {
      YEARS.forEach(year => {
        SEASONS.forEach(season => {
          const seasonSports = SPORTS_BY_SEASON[season];
          
          // Iterate through each category to ensure correct gender assignment
          (['mens', 'womens', 'coed'] as const).forEach(genderKey => {
            const sports = seasonSports[genderKey];
            const gender: Gender = genderKey === 'mens' ? 'Mens' : genderKey === 'womens' ? 'Womens' : 'Co-Ed';
            
            sports.forEach((sport, sportIndex) => {
              // Skip if team constraints don't match
              if (team.womensOnly && gender !== 'Womens') return;

              // Generate games for each year
              // For 2026-27, generate fewer games for demo
              const gamesPerSport = year === "2025-26" ? 2 : 1;

              for (let i = 0; i < gamesPerSport; i++) {
                const level: any = i === 0 ? "Varsity" : "JV";
                const finalLevel = team.msOnly ? "Middle School" : level;
                const isHome = (teamIndex + sportIndex + i + (genderKey === 'womens' ? 1 : 0)) % 2 === 0;
                const gameTime = TIMES[(teamIndex + i) % TIMES.length];
                
                generated.push({
                  id: `local_${year}_${season}_${gender}_${sport.replace(/\s+/g, '')}_${team.name.replace(/\s+/g, '')}_${i}`,
                  date: getSeasonDate(season, i + (sportIndex * 2), teamIndex, year),
                  time: gameTime,
                  earlyReleaseTime: calculateEarlyRelease(gameTime),
                  opponent: team.name,
                  location: isHome ? "Cary Academy" : team.name,
                  gameType: isHome ? "Home" : "Away",
                  sport: sport as Sport,
                  gender: gender,
                  season: season,
                  academicYear: year,
                  level: finalLevel,
                  notes: year === "2026-27" 
                    ? "Preliminary Schedule - Subject to Final Confirmation" 
                    : `${season} ${sport} match.`
                });
              }
            });
          });
        });
      });
    });
    return generated;
  }, [gamesLoaded, games]);

  const displayGames = games.length > 0 ? games : LOCAL_MOCK_GAMES;

  const isUserCoach = userRole === 'coach';
  const canEditAny = isUserAdmin;
  const canEditCoachFields = isUserAdmin || isUserCoach;

  const availableSports = useMemo(() => {
    const seasonData = SPORTS_BY_SEASON[selectedSeason];
    if (selectedGender === 'Mens') return seasonData.mens;
    if (selectedGender === 'Womens') return seasonData.womens;
    return seasonData.coed;
  }, [selectedSeason, selectedGender]);

  const { todayGames, upcomingGames } = useMemo(() => {
    const today = displayGames.filter(g => g.date === TODAY_STR).sort((a, b) => a.time.localeCompare(b.time));
    const upcoming = displayGames.filter(g => g.date > TODAY_STR && g.academicYear === "2025-26").sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { todayGames: today, upcomingGames: upcoming };
  }, [displayGames, TODAY_STR]);

  const filteredGames = useMemo(() => {
    return displayGames.filter(game => {
      const yearMatch = game.academicYear === selectedYear;
      const seasonMatch = game.season === selectedSeason;
      const genderMatch = selectedGender === 'Co-Ed' || game.gender === selectedGender;
      const sportMatch = selectedSport === 'All' || game.sport === selectedSport;
      return yearMatch && seasonMatch && genderMatch && sportMatch;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [displayGames, selectedYear, selectedSeason, selectedGender, selectedSport]);

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc]">
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      {/* Enhanced Disclaimer Bar */}
      <div className="bg-ca-gold text-ca-navy px-4 py-3 flex flex-col items-center justify-center gap-1.5 leading-tight z-50 shadow-md border-b-2 border-ca-blue/10">
        <div className="flex items-center gap-2 font-black text-[11px] uppercase tracking-[0.2em] animate-pulse">
          <ShieldAlert size={14} />
          <span>Important Schedule Notice</span>
        </div>
        <p className="text-[10px] font-black text-ca-navy/80 text-center max-w-3xl uppercase tracking-[0.05em] leading-relaxed">
          Schedules are subject to weather cancellations and mid-season adjustments. 
          Once the competitive season begins, this portal will serve as the <span className="text-ca-blue underline decoration-2 underline-offset-2">master live accurate schedule</span>.
        </p>
      </div>

      {/* Header */}
      <header className="bg-ca-blue text-white px-8 py-5 flex items-center justify-between border-b border-white/10 shadow-lg shrink-0">
        <div 
          className="flex items-center gap-5 cursor-pointer"
          onClick={() => { setShowDashboard(true); setSelectedGame(null); setIsEditing(false); }}
        >
          <div className="relative">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center border-4 border-ca-gold shadow-inner">
               <Trophy size={30} className="text-ca-blue" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-ca-gold rounded-full border-2 border-ca-blue flex items-center justify-center">
              <span className="text-[8px] font-black text-ca-blue">⚡</span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none mb-1">
              Cary Academy
            </h1>
            <p className="text-ca-gold text-[10px] font-bold tracking-[0.3em] uppercase">
              Home of the Chargers
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <nav className="hidden md:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-white/50">
            <button 
              onClick={() => { setShowDashboard(true); setSelectedGame(null); }}
              className={cn("flex items-center gap-1.5 transition-colors", showDashboard ? "text-ca-gold" : "hover:text-white")}
            >
              <Calendar size={12} />
              Today's Games
            </button>
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            <button 
               onClick={() => { setShowDashboard(false); setIsEditing(false); }}
               className={cn("transition-colors", !showDashboard ? "text-ca-gold" : "hover:text-white")}
            >
              Schedules
            </button>
          </nav>

          <div className="h-8 w-[1px] bg-white/10 hidden md:block" />

          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40 leading-none mb-1">Signed in as</p>
                <p className="text-[10px] font-bold text-ca-gold">{user.displayName || user.email}</p>
                <p className="text-[8px] font-black uppercase tracking-widest text-white/20">{userRole || 'Member'}</p>
              </div>
              <button 
                onClick={logout}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-2 bg-ca-gold text-ca-navy px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
            >
              <LogIn size={14} />
              Staff Login
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Hierarchical Sidebar */}
        {!isFullScreen && (
          <aside className="w-80 bg-ca-navy p-8 border-r border-white/5 overflow-y-auto shrink-0 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <Filter size={14} className="text-ca-gold" />
            <h3 className="text-ca-gold text-[10px] font-black uppercase tracking-[0.25em]">
              Schedule Filter
            </h3>
          </div>
          
          <div className="space-y-10 flex-1">
            {/* 0. Home Button */}
            <button 
              onClick={() => {
                setShowDashboard(true);
                setSelectedYear('2025-26');
                setSelectedGame(null);
                setSelectedSport('All');
                setIsEditing(false);
              }}
              className={cn(
                "w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border-2 outline-none",
                showDashboard 
                  ? "bg-ca-gold text-ca-navy border-ca-gold shadow-[0_0_20px_rgba(255,209,0,0.2)]" 
                  : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
              Today's Games
            </button>

            {!showDashboard && (
              <>
                {/* 1. Year Toggle */}
                <div className="transition-opacity opacity-100">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-4">1. Academic Year</label>
                  <div className="grid grid-cols-2 gap-1 bg-white/5 p-1 rounded-xl">
                    {(["2025-26", "2026-27"] as const).map(y => (
                      <button 
                        key={y}
                        onClick={() => {
                          setSelectedYear(y);
                          setSelectedSport('All');
                        }}
                        className={cn(
                          "py-2.5 rounded-lg text-[9px] font-black uppercase transition-all",
                          selectedYear === y
                            ? "bg-ca-gold text-ca-navy shadow-lg" 
                            : "text-white/40 hover:text-white/60"
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Gender Toggle */}
                <div className="transition-opacity opacity-100">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-4">2. Choose Program</label>
                  <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-xl">
                    {GENDERS.map(g => (
                      <button 
                        key={g}
                        onClick={() => {
                          setSelectedGender(g);
                          setSelectedSport('All');
                        }}
                        className={cn(
                          "py-2.5 rounded-lg text-[9px] font-black uppercase transition-all",
                          selectedGender === g
                            ? "bg-ca-gold text-ca-navy shadow-lg" 
                            : "text-white/40 hover:text-white/60"
                        )}
                      >
                        {g.replace('-Ed', '')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Season Toggle */}
                <div className="transition-opacity opacity-100">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-4">3. Select Season</label>
                  <div className="grid grid-cols-1 gap-1 bg-white/5 p-1 rounded-xl">
                    {SEASONS.map(s => (
                      <button 
                        key={s}
                        onClick={() => {
                          setSelectedSeason(s);
                          setSelectedSport('All');
                        }}
                        className={cn(
                          "py-3 px-4 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-between",
                          selectedSeason === s
                            ? "bg-ca-blue text-white border border-white/10 shadow-md" 
                            : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        )}
                      >
                        {s}
                        {selectedSeason === s && <div className="w-1.5 h-1.5 rounded-full bg-ca-gold shadow-[0_0_8px_#FFD100]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Sport List */}
                <div className="flex-1 transition-opacity opacity-100">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-4">4. Select Sport</label>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <button 
                      onClick={() => { setSelectedSport('All'); }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between group",
                        selectedSport === 'All' ? "bg-white/10 text-ca-gold border-l-4 border-ca-gold" : "text-white/50 hover:text-white"
                      )}
                    >
                      All {selectedSeason} Sports
                      {selectedSport === 'All' && <ChevronRight size={14} />}
                    </button>
                    {availableSports.map(s => (
                      <button 
                        key={s}
                        onClick={() => { setSelectedSport(s); }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between group",
                          selectedSport === s ? "bg-white/20 text-ca-gold border-r-4 border-ca-gold" : "text-white/50 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <span className="truncate">{s}</span>
                        {selectedSport === s && <ChevronRight size={14} className="shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-auto pt-8 border-t border-white/5">
            <div className="flex items-center gap-3 text-white/30">
              <Wind size={16} />
              <p className="text-[8px] leading-relaxed uppercase font-black tracking-widest">
                Weather updates handled by CA Coaches
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Schedule Display */}
        <section className={cn(
          "flex-1 p-10 flex flex-col overflow-hidden transition-all duration-300",
          isFullScreen ? "fixed inset-0 z-[100] bg-[#f8fafc]" : ""
        )}>
          <AnimatePresence mode="wait">
            {!selectedGame ? (
              <motion.div 
                key={showDashboard ? "dashboard" : "list"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                {showDashboard ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-end justify-between mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-white font-black text-[10px] uppercase tracking-[0.3em] bg-red-600 px-2 py-0.5 rounded leading-none shadow-sm animate-pulse">
                            Live Today
                          </span>
                        </div>
                        <h2 className="text-7xl font-black italic uppercase leading-none text-ca-blue tracking-tighter">
                          Gameday Center
                        </h2>
                        <p className="text-slate-400 text-xs mt-2 uppercase font-black tracking-[0.2em]">
                          All Cary Academy Athletic Competitions • {new Date(TODAY_STR).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <button 
                          onClick={() => setIsFullScreen(!isFullScreen)}
                          className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-ca-blue font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                          {isFullScreen ? 'Exit Focus' : 'Full Screen'}
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-12 pr-4 custom-scrollbar pb-10">
                      {/* Today's Section */}
                      <section>
                        <div className="flex items-center gap-4 mb-4">
                          <h3 className="text-ca-blue font-black uppercase text-xl tracking-tighter italic">Today's Games</h3>
                          <div className="h-[2px] flex-1 bg-slate-100" />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                          {todayGames.length > 0 ? (
                            todayGames.map((game) => (
                              <GameRow key={game.id} game={game} onClick={() => setSelectedGame(game)} />
                            ))
                          ) : (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                              <p className="text-slate-400 font-black uppercase text-xs tracking-widest italic">No competitive events scheduled for today</p>
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Upcoming Section */}
                      <section>
                        <div className="flex items-center gap-4 mb-4">
                          <h3 className="text-slate-400 font-black uppercase text-xl tracking-tighter italic">Coming Up Next</h3>
                          <div className="h-[2px] flex-1 bg-slate-100" />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                          {upcomingGames.slice(0, 15).map((game) => (
                            <GameRow key={game.id} game={game} onClick={() => setSelectedGame(game)} isSmall />
                          ))}
                        </div>
                        
                        <div className="mt-8 text-center">
                          <button 
                            onClick={() => {
                              setShowDashboard(false);
                              setSelectedSeason('Spring');
                              setSelectedSport('All');
                            }}
                            className="text-ca-blue font-black uppercase text-[10px] tracking-widest border-2 border-ca-blue/20 px-8 py-3 rounded-full hover:bg-ca-blue hover:text-white transition-all shadow-lg"
                          >
                            Browse Full Season Schedules
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end justify-between mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-ca-gold font-black text-[10px] uppercase tracking-[0.3em] bg-ca-navy px-2 py-0.5 rounded leading-none shadow-sm">
                            {selectedYear} | {selectedSeason} Season
                          </span>
                        </div>
                        <h2 className={cn(
                          "font-black italic uppercase leading-none text-ca-blue tracking-tighter",
                          isFullScreen ? "text-7xl" : "text-6xl"
                        )}>
                          {selectedSport === 'All' ? 'Schedule' : selectedSport.split(' (')[0]}
                        </h2>
                        <p className="text-slate-400 text-xs mt-2 uppercase font-black tracking-[0.2em]">
                          {selectedGender}'s Athletic Program • {selectedSport === 'All' ? 'Complete Listing' : selectedSport}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <button 
                          onClick={() => setIsFullScreen(!isFullScreen)}
                          className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-ca-blue font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
                        >
                          {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                          {isFullScreen ? 'Exit Focus' : 'Full Screen'}
                        </button>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          Live Sync Active
                        </span>
                      </div>
                    </div>

                    {/* Table Container */}
                    <div className="flex-1 flex flex-col glass-card bg-white shadow-2xl relative">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 bg-slate-50 py-4 px-8 text-[11px] font-black uppercase tracking-[0.2em] text-ca-blue border-b border-slate-200 sticky top-0 z-10">
                        <div className="col-span-2">Date</div>
                        <div className="col-span-2">Program</div>
                        <div className="col-span-3">Opponent</div>
                        <div className="col-span-2">Location</div>
                        <div className="col-span-1 text-center">Release</div>
                        <div className="col-span-2 text-right">Time</div>
                      </div>

                      {/* Scrollable list */}
                      <div className="flex-1 overflow-y-auto">
                        <AnimatePresence mode="popLayout">
                          {filteredGames.length > 0 ? (
                            filteredGames.map((game, index) => (
                              <motion.div
                                key={game.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ delay: index * 0.03 }}
                                className="schedule-grid group"
                                onClick={() => setSelectedGame(game)}
                              >
                                <div className="col-span-2 font-mono text-[13px] font-bold text-slate-400 group-hover:text-ca-blue transition-colors uppercase">
                                  {new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                                  <span className="block text-[10px] opacity-60">{new Date(game.date).getFullYear()}</span>
                                </div>
                                <div className="col-span-2">
                                  <div className="flex flex-col">
                                    <span className="font-black text-sm text-ca-blue uppercase tracking-tight">{game.gender} {game.sport}</span>
                                    <span className="text-[9px] font-black text-ca-gold bg-ca-navy px-1.5 py-0.5 rounded self-start mt-1 uppercase">{game.level}</span>
                                  </div>
                                </div>
                                <div className="col-span-3 italic text-lg font-black text-slate-700 tracking-tight">
                                  {game.opponent}
                                  {game.academicYear === "2026-27" && (
                                    <span className="block text-[8px] font-black uppercase text-red-500 tracking-tighter not-italic mt-1">
                                      Tentative Selection
                                    </span>
                                  )}
                                </div>
                                <div className="col-span-2">
                                  <div className={cn(
                                    "flex items-center gap-2 text-xs font-black px-3 py-1 rounded-full w-fit",
                                    game.gameType === 'Home' 
                                      ? "bg-ca-blue/10 text-ca-blue" 
                                      : "bg-ca-gold/20 text-ca-navy"
                                  )}>
                                     <div className={cn(
                                       "w-2 h-2 rounded-full",
                                       game.gameType === 'Home' ? "bg-ca-blue animate-pulse" : "bg-ca-gold"
                                     )} />
                                     <span className="uppercase tracking-tighter truncate max-w-[80px]">
                                       {game.location}
                                     </span>
                                  </div>
                                </div>
                                <div className="col-span-1 text-center font-bold text-ca-gold text-xs">
                                  {game.earlyReleaseTime || '--'}
                                </div>
                                <div className="col-span-2 text-right">
                                  <span className="font-black text-ca-blue text-xl">
                                    {game.time}
                                  </span>
                                </div>
                              </motion.div>
                            ))
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30 h-full">
                              <div className="w-24 h-24 border-4 border-dashed border-slate-300 rounded-full mb-6 flex items-center justify-center">
                                <Calendar size={40} className="text-slate-400" />
                              </div>
                              <p className="text-2xl font-black italic uppercase tracking-tighter text-slate-500">Season Schedule Pending</p>
                              <p className="text-xs font-bold uppercase tracking-widest mt-2 text-slate-400">Data will be imported for the {selectedSeason} season shortly</p>
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 bg-white glass-card shadow-2xl p-12 relative overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-10">
                  <button 
                    onClick={() => { setSelectedGame(null); setIsEditing(false); }}
                    className="flex items-center gap-2 text-ca-blue font-black uppercase text-[10px] tracking-widest hover:gap-4 transition-all group"
                  >
                    <ArrowLeft size={16} />
                    Back to {selectedSeason} Schedule
                  </button>
                  <div className="flex items-center gap-3">
                    {(isUserAdmin || isUserCoach) && (
                      isEditing ? (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleSaveGame}
                            className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-colors shadow-lg"
                          >
                            <Save size={14} />
                            Save Changes
                          </button>
                          <button 
                            onClick={() => { setIsEditing(false); setEditedGame(null); }}
                            className="flex items-center gap-2 bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-colors"
                          >
                            <X size={14} />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setIsEditing(true); setEditedGame(selectedGame); }}
                          className="flex items-center gap-2 bg-ca-blue text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-ca-navy transition-colors shadow-lg"
                        >
                          <Edit3 size={14} />
                          Edit Game
                        </button>
                      )
                    )}
                    <button 
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors shadow-sm"
                    >
                      {isFullScreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                      {isFullScreen ? 'Exit Focus' : 'Full Screen'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-ca-gold text-ca-navy px-3 py-1 rounded font-black text-[10px] uppercase tracking-widest">
                        {selectedGame.gameType} Event
                      </span>
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded font-black text-[10px] uppercase tracking-widest">
                        {selectedGame.level}
                      </span>
                    </div>
                    
                    {isEditing && isUserAdmin ? (
                      <div className="mb-4 space-y-4">
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Opponent Name</label>
                         <input 
                           type="text" 
                           value={editedGame?.opponent} 
                           onChange={(e) => setEditedGame(prev => prev ? { ...prev, opponent: e.target.value } : null)}
                           className="w-full text-4xl font-black italic uppercase text-ca-blue bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 focus:border-ca-gold outline-none"
                         />
                      </div>
                    ) : (
                      <h2 className="text-7xl font-black italic uppercase text-ca-blue tracking-tighter leading-tight mb-4">
                        vs {selectedGame.opponent}
                      </h2>
                    )}
                    
                    <div className="flex items-center gap-4 text-slate-400 mb-12">
                      <div className="flex items-center gap-2">
                        <Trophy size={18} className="text-ca-gold" />
                        <span className="font-black uppercase tracking-widest text-xs">{selectedGame.gender} {selectedGame.sport}</span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                      <div className="font-bold text-sm">
                        {isEditing && isUserAdmin ? (
                          <input 
                            type="date"
                            value={editedGame?.date}
                            onChange={(e) => setEditedGame(prev => prev ? { ...prev, date: e.target.value } : null)}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-ca-gold"
                          />
                        ) : (
                          new Date(selectedGame.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-center gap-6">
                        <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-ca-blue">
                          <Clock size={32} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gate / Game Time</p>
                          {isEditing && isUserAdmin ? (
                            <input 
                              type="text"
                              value={editedGame?.time}
                              onChange={(e) => setEditedGame(prev => prev ? { ...prev, time: e.target.value } : null)}
                              className="text-3xl font-black text-ca-blue bg-white border border-slate-200 rounded px-3 py-1 w-full"
                            />
                          ) : (
                            <p className="text-3xl font-black text-ca-blue">{selectedGame.time}</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-center gap-6">
                        <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-ca-blue">
                          <MapPin size={32} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Venue Location</p>
                          {isEditing && isUserAdmin ? (
                            <input 
                              type="text"
                              value={editedGame?.location}
                              onChange={(e) => setEditedGame(prev => prev ? { ...prev, location: e.target.value } : null)}
                              className="text-2xl font-black text-slate-700 bg-white border border-slate-200 rounded px-3 py-1 w-full"
                            />
                          ) : (
                            <p className="text-2xl font-black text-slate-700">{selectedGame.location}</p>
                          )}
                          <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-2">
                            <Info size={12} />
                            {isEditing && (isUserAdmin || isUserCoach) ? (
                              <input 
                                type="text"
                                placeholder="Specific Field/Court"
                                value={editedGame?.field}
                                onChange={(e) => setEditedGame(prev => prev ? { ...prev, field: e.target.value } : null)}
                                className="bg-white border border-slate-200 rounded px-2 py-0.5 w-full text-ca-blue"
                              />
                            ) : (
                              selectedGame.field || 'Field TBD'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-8">
                    <div className={cn(
                      "rounded-3xl p-10 text-white shadow-xl relative overflow-hidden group transition-colors",
                      isEditing ? "bg-ca-blue" : "bg-ca-navy"
                    )}>
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <Calendar size={180} />
                      </div>
                      
                      <h3 className="text-ca-gold font-black uppercase text-xs tracking-[0.3em] mb-8 flex items-center gap-2">
                        <School size={16} />
                        Game Logistics {isEditing && <span className="text-green-400 animate-pulse ml-2 font-black">— Editing Mode —</span>}
                      </h3>

                      <div className="space-y-8 relative z-10">
                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Early Release</p>
                            {isEditing && (isUserAdmin || isUserCoach) ? (
                              <input 
                                type="text"
                                placeholder="e.g. 2:45 PM"
                                value={editedGame?.earlyReleaseTime || ''}
                                onChange={(e) => setEditedGame(prev => prev ? { ...prev, earlyReleaseTime: e.target.value } : null)}
                                className="w-full bg-white/10 border border-white/20 rounded px-3 py-1.5 focus:border-ca-gold outline-none text-white text-xl font-black"
                              />
                            ) : (
                              <p className="text-2xl font-black text-white">{selectedGame.earlyReleaseTime || 'N/A'}</p>
                            )}
                          </div>
                          {!isEditing && <Clock size={20} className="text-white/20 mb-1" />}
                        </div>

                        <div className="flex justify-between items-end border-b border-white/10 pb-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Bus Departure</p>
                            {isEditing && (isUserAdmin || isUserCoach) ? (
                              <input 
                                type="text"
                                placeholder="e.g. 3:15 PM"
                                value={editedGame?.busDepartureTime || ''}
                                onChange={(e) => setEditedGame(prev => prev ? { ...prev, busDepartureTime: e.target.value } : null)}
                                className="w-full bg-white/10 border border-white/20 rounded px-3 py-1.5 focus:border-ca-gold outline-none text-white text-xl font-black"
                              />
                            ) : (
                              <p className="text-2xl font-black text-white">{selectedGame.busDepartureTime || 'Own Transportation'}</p>
                            )}
                          </div>
                          {!isEditing && <Clock size={20} className="text-white/20 mb-1" />}
                        </div>

                        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                          <p className="text-[10px] font-black text-ca-gold uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Info size={12} />
                            Coach Notes
                          </p>
                          {isEditing && (isUserAdmin || isUserCoach) ? (
                            <textarea 
                              rows={3}
                              value={editedGame?.notes || ''}
                              onChange={(e) => setEditedGame(prev => prev ? { ...prev, notes: e.target.value } : null)}
                              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:border-ca-gold outline-none text-white text-sm font-medium"
                              placeholder="Add game-specific instructions for players..."
                            />
                          ) : (
                            <p className="text-sm font-medium text-white/80 leading-relaxed italic">
                              "{selectedGame.notes || 'Full uniform required. Be ready to warm-up on arrival.'}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 border-4 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center p-10 text-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={32} className="text-slate-300" />
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[200px]">
                        Last updated by Athletic Office on {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <footer className="bg-ca-blue text-white/40 px-8 py-4 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em] border-t border-white/5 shrink-0">
        <span>© 2026 Cary Academy Athletics</span>
        <div className="flex gap-8">
          <a href="#" className="hover:text-ca-gold transition-colors">Privacy</a>
          <a href="#" className="hover:text-ca-gold transition-colors">Terms</a>
          <span className="text-ca-gold shadow-ca-gold">Go Chargers!</span>
        </div>
      </footer>
    </div>
  );
}
