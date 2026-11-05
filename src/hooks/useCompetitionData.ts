import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getMatches, getStandings, type Match, type StandingRow } from '../api';
import { localDateString, matchDateRange } from '../utils/matches';

interface Result<T> { code: string; data: T[]; status: string }

export function useCompetitionData(code: string) {
  const [matches, setMatches] = useState<Result<Match>>({ code: '', data: [], status: 'loading' });
  const [table, setTable] = useState<Result<StandingRow>>({ code: '', data: [], status: 'loading' });
  const [refreshState, setRefreshState] = useState({ code, active: false });
  if (refreshState.code !== code) setRefreshState({ code, active: false });
  const matchRequest = useRef<AbortController | null>(null);
  const tableRequest = useRef<AbortController | null>(null);
  const refreshId = useRef(0);

  const fetchMatches = useCallback(() => {
    matchRequest.current?.abort();
    const controller = new AbortController();
    matchRequest.current = controller;
    const { from, to } = matchDateRange();
    return getMatches(code, from, to, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted && matchRequest.current === controller) setMatches({ code, data: data.matches, status: 'success' });
      },
      (error: unknown) => {
        if (!controller.signal.aborted && matchRequest.current === controller) setMatches({ code, data: [], status: error instanceof Error ? error.message : 'Não foi possível carregar as partidas.' });
      },
    );
  }, [code]);

  const fetchTable = useCallback(() => {
    tableRequest.current?.abort();
    const controller = new AbortController();
    tableRequest.current = controller;
    return getStandings(code, controller.signal).then(
      (data) => {
        const rows = data.standings.find((s) => s.type === 'TOTAL')?.table || data.standings[0]?.table || [];
        if (!controller.signal.aborted && tableRequest.current === controller) setTable({ code, data: rows, status: 'success' });
      },
      (error: unknown) => {
        if (!controller.signal.aborted && tableRequest.current === controller) setTable({ code, data: [], status: error instanceof Error ? error.message : 'Não foi possível carregar a classificação.' });
      },
    );
  }, [code]);
  const loadMatches = useCallback(() => {
    setMatches({ code, data: [], status: 'loading' });
    return fetchMatches();
  }, [code, fetchMatches]);
  const loadTable = useCallback(() => {
    setTable({ code, data: [], status: 'loading' });
    return fetchTable();
  }, [code, fetchTable]);

  useEffect(() => {
    void fetchMatches();
    void fetchTable();
    let day = localDateString(new Date());
    const checkDay = () => {
      const nextDay = localDateString(new Date());
      if (nextDay !== day) { day = nextDay; void loadMatches(); void loadTable(); }
    };
    const timer = setInterval(checkDay, 30000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') checkDay(); });
    return () => {
      clearInterval(timer); subscription.remove();
      matchRequest.current?.abort(); tableRequest.current?.abort();
      refreshId.current += 1;
    };
  }, [fetchMatches, fetchTable, loadMatches, loadTable]);

  const refresh = useCallback(async () => {
    const id = ++refreshId.current;
    setRefreshState({ code, active: true });
    try { await Promise.all([loadMatches(), loadTable()]); }
    finally { if (refreshId.current === id) setRefreshState({ code, active: false }); }
  }, [code, loadMatches, loadTable]);

  return {
    matches: matches.code === code ? matches.data : [],
    table: table.code === code ? table.data : [],
    matchStatus: matches.code === code ? matches.status : 'loading',
    tableStatus: table.code === code ? table.status : 'loading',
    refreshing: refreshState.code === code && refreshState.active, loadMatches, loadTable, refresh,
  };
}
