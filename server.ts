import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as xlsx from "xlsx";
import chokidar from "chokidar";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));

// Initialize Firebase Client (Server-side)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EXCEL_FILE = "schedule.xlsx";
const CSV_FILE = "schedule.csv";

/**
 * Normalizes Excel dates which can come as numbers or strings
 */
function normalizeDate(val: any): string {
  if (!val) return "";
  // Check if it's an Excel serial number
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  // Try to parse raw string (often YYYY-MM-DD or MM/DD/YYYY)
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return String(val);
}

function calculateEarlyRelease(timeStr: string) {
  if (!timeStr || timeStr === "TBA") return "";
  const [time, modifier] = timeStr.split(' ');
  if (!time || !modifier) return "";
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  
  // 1h 30m before
  date.setMinutes(date.getMinutes() - 90);
  
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const mod = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  
  return `${h}:${m} ${mod}`;
}

async function syncFileToFirestore(filePath: string) {
  console.log(`[Sync] Change detected in ${filePath}. Starting sync...`);

  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // We'll use raw mode to handle the matrix layout better
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (rows.length < 2) {
      console.log(`[Sync] ${filePath} is too small to be a schedule matrix.`);
      return;
    }

    const headers = rows[0]; // First row is sports
    const gameList: any[] = [];

    // Start from row 1 (the first date row)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dateVal = row[0]; // First column is the date
      if (!dateVal) continue;

      const dateStr = normalizeDate(dateVal);

      // Check each sport column (starting from index 1)
      for (let j = 1; j < headers.length; j++) {
        const sportHeader = String(headers[j] || "").trim();
        const cellContent = String(row[j] || "").trim();

        if (!sportHeader || !cellContent) continue;

        // Extract metadata from header (e.g., "Mens Varsity Soccer")
        let gender: any = "Co-Ed";
        if (sportHeader.toLowerCase().includes("mens")) gender = "Mens";
        if (sportHeader.toLowerCase().includes("womens")) gender = "Womens";

        let level: any = "Varsity";
        if (sportHeader.toLowerCase().includes("jv")) level = "JV";
        if (sportHeader.toLowerCase().includes("middle school") || sportHeader.toLowerCase().includes("ms")) level = "Middle School";

        const sport = sportHeader.replace(/(mens|womens|varsity|jv|middle school|ms)/gi, "").trim();

        // Parse cell content (e.g., "Ravenscroft (H) 4:30 PM")
        const isHome = cellContent.includes("(H)") || cellContent.toLowerCase().includes("home");
        const opponent = cellContent.replace(/\((H|A|Home|Away)\)/gi, "").replace(/\d+:\d+\s*(AM|PM)/gi, "").trim();
        
        const timeMatch = cellContent.match(/\d+:\d+\s*(AM|PM)/i);
        const time = timeMatch ? timeMatch[0].toUpperCase() : "TBA";

        gameList.push({
          id: `sync_${i}_${j}_${Date.now()}`,
          date: dateStr,
          time: time,
          opponent: opponent || "TBA",
          location: isHome ? "Cary Academy" : (opponent || "TBA"),
          gameType: isHome ? "Home" : "Away",
          sport: sport as any,
          gender: gender,
          season: "Fall", // Default or could be inferred from date
          level: level,
          notes: "",
          earlyReleaseTime: calculateEarlyRelease(time) // Calculate based on extracted time
        });
      }
    }

    console.log(`[Sync] Parsed ${gameList.length} games from matrix. Refreshing database...`);

    const snapshot = await getDocs(collection(db, 'games'));
    const batch = writeBatch(db);
    
    snapshot.forEach((gameDoc) => {
      batch.delete(gameDoc.ref);
    });

    gameList.forEach((game) => {
      batch.set(doc(db, 'games', game.id), game);
    });

    await batch.commit();
    console.log(`[Sync] Firestore successfully synced with ${filePath}!`);
  } catch (err) {
    console.error(`[Sync] Error during sync of ${filePath}:`, err);
  }
}

async function startServer() {
  const expressApp = express();
  const PORT = 3000;

  // Watch for both file types
  const watcher = chokidar.watch([EXCEL_FILE, CSV_FILE], {
    persistent: true
  });

  watcher.on('all', (event, filePath) => {
    if (event === 'add' || event === 'change') {
      syncFileToFirestore(filePath);
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  expressApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
