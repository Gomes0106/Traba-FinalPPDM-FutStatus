import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from './src/components/SafeArea';
import { COMPETITIONS } from './src/api';
import { useCompetitionData } from './src/hooks/useCompetitionData';
import { isLiveMatch, matchesPeriod } from './src/utils/matches';

const C = { bg: '#07110c', panel: '#101b14', panel2: '#16231a', green: '#7dfc7a', muted: '#91a095', white: '#f4f8f4', line: '#26352a', red: '#ff7777' };
const shortDate = (date) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function Pill({ children, active = false, onPress = undefined }) {
  return <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}><Text style={[styles.pillText, active && styles.pillTextActive]}>{children}</Text></Pressable>;
}
function Header({ title, subtitle = '' }) {
  return <View style={styles.header}><View><Text style={styles.brand}>CAMPO<Text style={{ color: C.white }}>·</Text>VERDE</Text><Text style={styles.heading}>{title}</Text>{subtitle ? <Text style={styles.subheading}>{subtitle}</Text> : null}</View><View style={styles.liveDot}><View style={styles.dot} /><Text style={styles.liveText}>AO VIVO</Text></View></View>;
}
function Empty({ title, hint, onRetry = undefined }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>◌</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyHint}>{hint}</Text>{onRetry && <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable>}</View>;
}
function MatchCard({ match, onPress }) {
  const score = match.score?.fullTime || {};
  const isDone = match.status === 'FINISHED';
  const isLive = isLiveMatch(match.status);
  const status = isDone ? 'ENCERRADO' : isLive ? 'EM JOGO' : shortDate(match.utcDate);
  return <Pressable onPress={onPress} style={styles.matchCard}>
    <View style={styles.matchTop}><Text style={styles.matchComp}>{match.competition?.name || 'PARTIDA'}</Text><Text style={[styles.matchStatus, isLive && { color: C.green }]}>{isLive ? '● ' : ''}{status}</Text></View>
    <View style={styles.teams}><View style={styles.team}><Text style={styles.teamInitial}>{(match.homeTeam?.shortName || match.homeTeam?.name || '?').slice(0, 1)}</Text><Text numberOfLines={1} style={styles.teamName}>{match.homeTeam?.shortName || match.homeTeam?.name || 'Mandante'}</Text></View><Text style={styles.score}>{score.home ?? '–'} <Text style={styles.scoreDash}>:</Text> {score.away ?? '–'}</Text><View style={[styles.team, styles.teamRight]}><Text numberOfLines={1} style={styles.teamName}>{match.awayTeam?.shortName || match.awayTeam?.name || 'Visitante'}</Text><Text style={styles.teamInitial}>{(match.awayTeam?.shortName || match.awayTeam?.name || '?').slice(0, 1)}</Text></View></View>
    <Text style={styles.matchFooter}>Jornada {match.matchday || '—'} <Text style={styles.footerArrow}>›</Text></Text>
  </Pressable>;
}
function Standings({ table, query }) {
  const rows = (table || []).filter((r) => `${r.team?.name} ${r.team?.shortName}`.toLowerCase().includes(query.toLowerCase()));
  if (!rows.length) return <Empty title="Nenhum time encontrado" hint="Tente mudar o termo da busca." />;
  return <View style={styles.tableBox}><View style={styles.tableHead}><Text style={[styles.th, { flex: 1 }]}>CLUBE</Text><Text style={styles.th}>J</Text><Text style={styles.th}>V</Text><Text style={styles.th}>E</Text><Text style={styles.th}>D</Text><Text style={[styles.th, styles.pointsCol]}>PTS</Text></View>{rows.map((row) => <View key={row.team.id} style={styles.tableRow}><Text style={styles.position}>{String(row.position).padStart(2, '0')}</Text><Text numberOfLines={1} style={styles.club}>{row.team.shortName || row.team.name}</Text><Text style={styles.td}>{row.playedGames}</Text><Text style={styles.td}>{row.won}</Text><Text style={styles.td}>{row.draw}</Text><Text style={styles.td}>{row.lost}</Text><Text style={[styles.td, styles.points]}>{row.points}</Text></View>)}</View>;
}
function MatchDetail({ match, onClose }) {
  const score = match.score?.fullTime || {};
  return <View style={styles.modalShade}><View style={styles.modal}><Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable><Text style={styles.modalTag}>{match.competition?.name || 'PARTIDA'} · JORNADA {match.matchday || '—'}</Text><Text style={styles.modalDate}>{shortDate(match.utcDate)}</Text><View style={styles.detailTeams}><Text style={styles.detailTeam}>{match.homeTeam?.name}</Text><Text style={styles.detailScore}>{score.home ?? '–'} : {score.away ?? '–'}</Text><Text style={styles.detailTeam}>{match.awayTeam?.name}</Text></View><Text style={styles.modalStatus}>Status: {match.status || 'indisponível'}</Text><Pressable onPress={onClose} style={styles.retry}><Text style={styles.retryText}>Voltar</Text></Pressable></View></View>;
}

const FootballContext = createContext(null);
const TAB_ROUTES = { 'Início': '/', Partidas: '/partidas', Tabela: '/tabela' };

export function FootballProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const tab = pathname === '/tabela' ? 'Tabela' : pathname === '/partidas' ? 'Partidas' : 'Início';
  const [selectedCompetition, setCompetition] = useState(COMPETITIONS[0]);
  const competition = tab === 'Início' ? COMPETITIONS[0] : selectedCompetition;
  const { matches, table, matchStatus, tableStatus, refreshing, loadMatches, loadTable, refresh } = useCompetitionData(competition.code);
  const [query, setQuery] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [period, setPeriod] = useState('Todos');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const setTab = (label) => {
    setQuery('');
    setSelectedMatch(null);
    if (tab === 'Início' && label !== 'Início') setCompetition(COMPETITIONS[0]);
    router.navigate(TAB_ROUTES[label]);
  };
  const filteredMatches = useMemo(() => matches.filter((m) => {
    const q = query.trim().toLowerCase();
    const textMatch = [m.homeTeam?.name, m.homeTeam?.shortName, m.awayTeam?.name, m.awayTeam?.shortName, m.competition?.name].join(' ').toLowerCase().includes(q);
    return textMatch && matchesPeriod(m, period, now);
  }), [matches, query, period, now]);

  return <FootballContext.Provider value={{ tab, setTab, competition, setCompetition, matches, table, matchStatus, tableStatus, refreshing, query, setQuery, selectedMatch, setSelectedMatch, period, setPeriod, loadMatches, loadTable, refresh, filteredMatches }}>{children}</FootballContext.Provider>;
}

export default function App() {
  const { tab, setTab, competition, setCompetition, matches, table, matchStatus, tableStatus, refreshing, query, setQuery, selectedMatch, setSelectedMatch, period, setPeriod, loadMatches, loadTable, refresh, filteredMatches } = useContext(FootballContext);
  const content = () => {
    if (tab === 'Tabela') return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.green} />}>
      <Header title="Classificação" subtitle="Acompanhe a disputa ponto a ponto." />
      <CompetitionPicker selected={competition} onSelect={setCompetition} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Buscar time..." placeholderTextColor={C.muted} style={styles.search} />
      {tableStatus === 'loading' ? <ActivityIndicator color={C.green} style={styles.loader} /> : tableStatus !== 'success' ? <Empty title="Não foi possível carregar" hint={tableStatus} onRetry={loadTable} /> : <Standings table={table} query={query} />}
      <Text style={styles.footnote}>Dados fornecidos por football-data.org</Text>
    </ScrollView>;
    if (tab === 'Partidas') return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.green} />}>
      <Header title="Partidas" subtitle="Jogos recentes e próximos confrontos." />
      <CompetitionPicker selected={competition} onSelect={setCompetition} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Buscar por time..." placeholderTextColor={C.muted} style={styles.search} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>{['Todos', 'Ao vivo', 'Próximos', 'Finalizados'].map((x) => <Pill key={x} active={period === x} onPress={() => setPeriod(x)}>{x}</Pill>)}</ScrollView>
      {matchStatus === 'loading' ? <ActivityIndicator color={C.green} style={styles.loader} /> : matchStatus !== 'success' ? <Empty title="Não foi possível carregar" hint={matchStatus} onRetry={loadMatches} /> : filteredMatches.length ? filteredMatches.map((m) => <MatchCard key={m.id} match={m} onPress={() => setSelectedMatch(m)} />) : <Empty title="Nenhuma partida encontrada" hint="Altere o filtro ou o período selecionado." />}
      <Text style={styles.footnote}>Dados fornecidos por football-data.org</Text>
    </ScrollView>;
    return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.green} />}>
      <Header title="O jogo começa aqui." subtitle="Seu futebol, acompanhado de perto." />
      <View style={styles.hero}><Text style={styles.eyebrow}>DESTAQUE · BRASIL</Text><Text style={styles.heroTitle}>Brasileirão{ '\n' }Série A</Text><Text style={styles.heroCopy}>Tabela e partidas atualizadas direto da API.</Text><Pressable onPress={() => { setCompetition(COMPETITIONS[0]); setTab('Tabela'); }} style={styles.heroButton}><Text style={styles.heroButtonText}>Ver classificação  ↗</Text></Pressable><Text style={styles.heroMark}>⚽</Text></View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Partidas</Text><Pressable onPress={() => setTab('Partidas')}><Text style={styles.seeAll}>Ver todas  ›</Text></Pressable></View>
      {matchStatus === 'loading' ? <ActivityIndicator color={C.green} style={styles.loader} /> : matchStatus !== 'success' ? <Empty title="API aguardando configuração" hint={matchStatus} onRetry={loadMatches} /> : matches.slice(0, 3).map((m) => <MatchCard key={m.id} match={m} onPress={() => setSelectedMatch(m)} />)}
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>No topo</Text><Pressable onPress={() => setTab('Tabela')}><Text style={styles.seeAll}>Classificação  ›</Text></Pressable></View>
      {tableStatus === 'loading' ? <ActivityIndicator color={C.green} style={styles.loader} /> : tableStatus !== 'success' ? null : <Standings table={table.slice(0, 5)} query="" />}
      <Text style={styles.footnote}>Dados fornecidos por football-data.org</Text>
    </ScrollView>;
  };

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" />{content()}<View style={styles.nav}>{[['Início','⌂'],['Partidas','◷'],['Tabela','▤']].map(([label, icon]) => <Pressable key={label} onPress={() => { setTab(label); setQuery(''); }} style={styles.navItem}><Text style={[styles.navIcon, tab === label && styles.navSelected]}>{icon}</Text><Text style={[styles.navLabel, tab === label && styles.navSelected]}>{label}</Text>{tab === label && <View style={styles.navBar} />}</Pressable>)}</View>{selectedMatch && <MatchDetail match={selectedMatch} onClose={() => setSelectedMatch(null)} />}</SafeAreaView>;
}

function CompetitionPicker({ selected, onSelect }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.competitions}>{COMPETITIONS.map((c) => <Pill key={c.code} active={selected.code === c.code} onPress={() => onSelect(c)}>{c.short}</Pill>)}</ScrollView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }, brand: { fontSize: 11, letterSpacing: 2.2, fontWeight: '900', color: C.green }, heading: { color: C.white, fontSize: 30, fontWeight: '800', marginTop: 10, letterSpacing: -0.8 }, subheading: { color: C.muted, fontSize: 13, marginTop: 5 }, liveDot: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12251a', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, marginTop: 3 }, dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: C.green, marginRight: 6 }, liveText: { color: C.green, fontWeight: '800', fontSize: 9, letterSpacing: 1 },
  hero: { backgroundColor: '#142d1b', borderRadius: 24, padding: 22, minHeight: 202, overflow: 'hidden', marginBottom: 26, borderWidth: 1, borderColor: '#24462b' }, eyebrow: { color: C.green, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, heroTitle: { color: C.white, fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 10 }, heroCopy: { color: '#b6c6b8', fontSize: 12, marginTop: 8 }, heroButton: { alignSelf: 'flex-start', backgroundColor: C.green, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, marginTop: 16 }, heroButtonText: { color: '#07110c', fontSize: 12, fontWeight: '900' }, heroMark: { position: 'absolute', right: -4, top: 30, fontSize: 92, opacity: 0.13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 3 }, sectionTitle: { color: C.white, fontSize: 18, fontWeight: '800' }, seeAll: { color: C.green, fontSize: 12, fontWeight: '700' },
  competitions: { marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 14 }, pill: { borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 9, marginRight: 8, backgroundColor: C.panel }, pillActive: { borderColor: C.green, backgroundColor: '#183020' }, pillText: { color: C.muted, fontWeight: '700', fontSize: 12 }, pillTextActive: { color: C.green },
  search: { color: C.white, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, marginBottom: 12 }, filters: { marginBottom: 13, flexGrow: 0 },
  matchCard: { backgroundColor: C.panel, borderRadius: 18, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: '#1b2a20' }, matchTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, matchComp: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, matchStatus: { color: '#9ba99d', fontSize: 9, fontWeight: '800' }, teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, team: { flex: 1, flexDirection: 'row', alignItems: 'center' }, teamRight: { justifyContent: 'flex-end' }, teamInitial: { height: 30, width: 30, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 15, color: C.green, backgroundColor: '#203327', fontWeight: '900', marginRight: 8, paddingTop: 7, fontSize: 12 }, teamName: { color: C.white, fontSize: 12, fontWeight: '700', flexShrink: 1 }, score: { color: C.white, fontWeight: '900', fontSize: 18, marginHorizontal: 9 }, scoreDash: { color: C.muted }, matchFooter: { borderTopWidth: 1, borderColor: C.line, marginTop: 14, paddingTop: 10, color: C.muted, fontSize: 10 }, footerArrow: { color: C.green, fontSize: 16, position: 'absolute' },
  tableBox: { backgroundColor: C.panel, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#1b2a20', marginTop: 4 }, tableHead: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }, th: { width: 28, textAlign: 'center', color: C.muted, fontSize: 9, fontWeight: '800' }, pointsCol: { width: 34 }, tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderColor: '#1b2a20' }, position: { color: C.green, width: 27, fontSize: 11, fontWeight: '900' }, club: { color: C.white, flex: 1, fontWeight: '700', fontSize: 12 }, td: { color: '#b9c3bb', width: 28, textAlign: 'center', fontSize: 11 }, points: { color: C.green, fontWeight: '900', width: 34 },
  loader: { marginVertical: 26 }, empty: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 22, backgroundColor: C.panel, borderRadius: 18, marginBottom: 12 }, emptyIcon: { color: C.green, fontSize: 30, marginBottom: 8 }, emptyTitle: { color: C.white, fontWeight: '800', fontSize: 15, textAlign: 'center' }, emptyHint: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }, retry: { backgroundColor: C.green, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 15, marginTop: 14 }, retryText: { color: '#07110c', fontWeight: '900', fontSize: 12 }, footnote: { color: '#607064', textAlign: 'center', fontSize: 10, marginTop: 18 },
  nav: { height: 67, flexDirection: 'row', backgroundColor: '#0b1510', borderTopWidth: 1, borderColor: C.line, justifyContent: 'space-around' }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIcon: { color: C.muted, fontSize: 19, fontWeight: '700' }, navLabel: { color: C.muted, fontSize: 9, marginTop: 3, fontWeight: '700' }, navSelected: { color: C.green }, navBar: { position: 'absolute', bottom: 0, height: 2, width: 30, backgroundColor: C.green, borderRadius: 2 },
  modalShade: { ...StyleSheet.absoluteFill, backgroundColor: '#000b', justifyContent: 'center', padding: 22 }, modal: { backgroundColor: C.panel2, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: '#304635' }, close: { position: 'absolute', right: 14, top: 8, padding: 5, zIndex: 2 }, closeText: { color: C.muted, fontSize: 28 }, modalTag: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, modalDate: { color: C.muted, fontSize: 12, marginTop: 8 }, detailTeams: { alignItems: 'center', paddingVertical: 24 }, detailTeam: { color: C.white, fontSize: 15, fontWeight: '800', textAlign: 'center', marginVertical: 5 }, detailScore: { color: C.green, fontSize: 36, fontWeight: '900', marginVertical: 8 }, modalStatus: { color: C.muted, textAlign: 'center', fontSize: 12 },
});
