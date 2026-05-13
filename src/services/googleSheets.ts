/**
 * This service handles interactions with the Google Sheets API.
 * It follows the GIS pattern for client-side OAuth.
 */

declare const google: any;

const CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID; // User will need to provide this
const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
].join(' ');

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

export const getAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Check if we have a valid cached token
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return resolve(accessToken);
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.access_token) {
            accessToken = response.access_token;
            // GIS tokens usually last 1 hour (3600 seconds)
            tokenExpiry = Date.now() + (response.expires_in * 1000);
            resolve(response.access_token);
          } else {
            console.error('GIS Error Response:', response);
            reject(new Error('Failed to get access token: ' + (response.error || 'Unknown error')));
          }
        },
      });
      client.requestAccessToken();
    } catch (error) {
      console.error('GIS Initialization Error:', error);
      reject(error);
    }
  });
};

export async function fetchSheetData(spreadsheetId: string, range: string) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Failed to fetch sheet data: ${response.statusText}`);
  }

  const data = await response.json();
  return data.values; // Returns rows as arrays
}

/**
 * Expected Sheet Format:
 * | Date | Time | Opponent | Location | Type (Home/Away) | Sport | Gender | Level |
 */
export function mapRowsToGames(rows: any[][]): any[] {
  if (!rows || rows.length <= 1) return []; // Skip header if it exists
  
  // Assuming first row is header
  const dataRows = rows.slice(1);
  
  return dataRows.map((row, index) => ({
    id: `game-${index}`,
    date: row[0] || '',
    time: row[1] || 'TBD',
    opponent: row[2] || 'Unknown Opponent',
    location: row[3] || 'TBD',
    gameType: (row[4] || 'Home') as any,
    sport: (row[5] || 'Football') as any,
    gender: (row[6] || 'Boys') as any,
    level: (row[7] || 'Varsity') as any,
  }));
}
