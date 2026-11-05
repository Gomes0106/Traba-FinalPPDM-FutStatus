const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');

global.IS_REACT_ACT_ENVIRONMENT = true;

function loadTs(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = function (id) {
    return Object.hasOwn(mocks, id) ? mocks[id] : Module.prototype.require.call(this, id);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  mod._compile(compiled.outputText, filename);
  return mod.exports;
}

const utils = loadTs('src/utils/matches.ts');

test('datas usam o dia local e atravessam meses e anos corretamente', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/Sao_Paulo';
  try {
    const late = new Date('2026-12-31T23:30:00-03:00');
    assert.equal(utils.localDateString(late), '2026-12-31');
    assert.deepEqual(utils.matchDateRange(late), { from: '2026-12-28', to: '2027-01-10' });
    assert.deepEqual(utils.matchDateRange(new Date('2027-01-01T00:30:00-03:00')), { from: '2026-12-29', to: '2027-01-11' });
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('filtros excluem cancelados dos próximos e incluem prorrogação ao vivo', () => {
  const now = Date.parse('2026-11-04T15:00:00Z');
  const match = { utcDate: '2026-11-04T16:00:00Z', status: 'TIMED' };
  assert.equal(utils.matchesPeriod(match, 'Próximos', now), true);
  assert.equal(utils.matchesPeriod({ ...match, status: 'CANCELLED' }, 'Próximos', now), false);
  assert.equal(utils.matchesPeriod(match, 'Próximos', now + 7200000), false);
  assert.equal(utils.matchesPeriod({ ...match, status: 'EXTRA_TIME' }, 'Ao vivo', now), true);
  assert.equal(utils.matchesPeriod({ ...match, status: 'FINISHED' }, 'Finalizados', now), true);
});

test('API informa token ausente, envia autenticação e trata limite de consultas', async () => {
  const oldToken = process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN;
  const oldFetch = global.fetch;
  const api = loadTs('src/api.ts');
  try {
    delete process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN;
    await assert.rejects(api.getStandings('BSA'), /EXPO_PUBLIC_FOOTBALL_DATA_TOKEN/);
    process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN = 'test-token';
    let requested;
    global.fetch = async (url, options) => { requested = { url, options }; return { ok: true, json: async () => ({ matches: [] }) }; };
    await api.getMatches('BSA', '2026-11-01', '2026-11-14');
    assert.match(requested.url, /competitions\/BSA\/matches\?dateFrom=2026-11-01&dateTo=2026-11-14$/);
    assert.equal(requested.options.headers['X-Auth-Token'], 'test-token');
    global.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(api.getStandings('BSA'), /Limite de consultas/);
  } finally {
    global.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN;
    else process.env.EXPO_PUBLIC_FOOTBALL_DATA_TOKEN = oldToken;
  }
});

function harness() {
  const matches = []; const tables = [];
  let onAppState; let result; let root;
  const deferred = (list, args) => new Promise((resolve, reject) => list.push({ args, resolve, reject }));
  const { useCompetitionData } = loadTs('src/hooks/useCompetitionData.ts', {
    '../api': { getMatches: (...args) => deferred(matches, args), getStandings: (...args) => deferred(tables, args) },
    '../utils/matches': utils,
    'react-native': { AppState: { addEventListener: (_name, callback) => { onAppState = callback; return { remove() { onAppState = undefined; } }; } } },
  });
  function Probe({ code }) { result = useCompetitionData(code); return null; }
  return {
    matches, tables, get result() { return result; },
    mount: async (code) => { await act(async () => { root = create(React.createElement(Probe, { code })); }); },
    select: async (code) => { await act(async () => root.update(React.createElement(Probe, { code }))); },
    close: async () => { if (root) await act(async () => root.unmount()); },
    activate: async () => { await act(async () => onAppState('active')); },
  };
}

test('respostas atrasadas não substituem partidas ou tabela da competição atual', async (t) => {
  const h = harness(); t.after(() => h.close());
  await h.mount('BSA');
  await h.select('PL');
  assert.equal(h.matches[0].args[3].aborted, true);
  assert.equal(h.tables[0].args[1].aborted, true);
  await act(async () => {
    h.matches[1].resolve({ matches: [{ id: 2 }] });
    h.tables[1].resolve({ standings: [{ type: 'TOTAL', table: [{ position: 1, team: { id: 2 } }] }] });
  });
  await act(async () => {
    h.matches[0].resolve({ matches: [{ id: 1 }] });
    h.tables[0].reject(new Error('Erro antigo'));
  });
  assert.equal(h.result.matches[0].id, 2);
  assert.equal(h.result.table[0].team.id, 2);
  assert.equal(h.result.matchStatus, 'success');
  assert.equal(h.result.tableStatus, 'success');
});

test('trocar campeonato durante atualização não deixa o indicador preso ao retornar', async (t) => {
  const h = harness(); t.after(() => h.close());
  await h.mount('BSA');
  let refresh;
  await act(async () => { refresh = h.result.refresh(); });
  assert.equal(h.result.refreshing, true);
  await h.select('PL');
  await h.select('BSA');
  assert.equal(h.result.refreshing, false);
  await act(async () => { h.matches[1].resolve({ matches: [] }); h.tables[1].resolve({ standings: [] }); await refresh; });
  assert.equal(h.result.refreshing, false);
});

test('retomar após a meia-noite recalcula o intervalo das partidas', async (t) => {
  const OriginalDate = global.Date;
  let instant = new OriginalDate(2026, 10, 4, 23, 59).getTime();
  global.Date = class extends OriginalDate {
    constructor(...args) { if (args.length) super(...args); else super(instant); }
    static now() { return instant; }
  };
  const h = harness();
  try {
    await h.mount('BSA');
    const from = h.matches[0].args[1];
    instant = new OriginalDate(2026, 10, 5, 0, 1).getTime();
    await h.activate();
    assert.equal(h.matches.length, 2);
    assert.notEqual(h.matches[1].args[1], from);
    assert.equal(h.matches[0].args[3].aborted, true);
  } finally { await h.close(); global.Date = OriginalDate; }
});
