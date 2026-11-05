export const COMPETITIONS = [
  { code: 'BSA', short: 'Brasileirão' },
  { code: 'PL', short: 'Premier League' },
  { code: 'PD', short: 'La Liga' },
  { code: 'SA', short: 'Serie A' },
  { code: 'BL1', short: 'Bundesliga' },
  { code: 'FL1', short: 'Ligue 1' },
];

export interface Team { id: number; name: string; shortName?: string }
export interface Match {
  id: number; status: string; utcDate: string; matchday?: number;
  competition?: { name: string }; homeTeam?: Team; awayTeam?: Team;
  score?: { fullTime?: { home: number | null; away: number | null } };
}
export interface StandingRow {
  position: number; team: Team; playedGames: number; won: number; draw: number; lost: number; points: number;
}
interface MatchesResponse { matches: Match[] }
interface StandingsResponse { standings: { type: string; table: StandingRow[] }[] }

async function request<T>(resource: string, signal?: AbortSignal): Promise<T> {
  const token = process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN?.trim();
  if (!token) throw new Error('Configure EXPO_PUBLIC_FOOTBALL_DATA_TOKEN no arquivo .env para carregar os dados.');
  const response = await fetch('https://api.football-data.org/v4/' + resource, {
    headers: { 'X-Auth-Token': token }, signal,
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Token da API inválido. Verifique a configuração.',
      403: 'Seu plano da API não permite acessar esta competição.',
      404: 'Dados indisponíveis para esta competição.',
      429: 'Limite de consultas atingido. Aguarde um minuto e tente novamente.',
    };
    throw new Error(messages[response.status] || 'Não foi possível consultar a API. Tente novamente.');
  }
  return response.json();
}

export async function getMatches(code: string, from: string, to: string, signal?: AbortSignal): Promise<MatchesResponse> {
  const data = await request<MatchesResponse>('competitions/' + encodeURIComponent(code) + '/matches?dateFrom=' + encodeURIComponent(from) + '&dateTo=' + encodeURIComponent(to), signal);
  if (!Array.isArray(data.matches)) throw new Error('A API retornou partidas em um formato inesperado.');
  return data;
}

export async function getStandings(code: string, signal?: AbortSignal): Promise<StandingsResponse> {
  const data = await request<StandingsResponse>('competitions/' + encodeURIComponent(code) + '/standings', signal);
  if (!Array.isArray(data.standings)) throw new Error('A API retornou a classificação em um formato inesperado.');
  return data;
}
