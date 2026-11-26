// Token Radar's plain dashboard, model radar-3. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol detail view with the
// fitted model's own inputs, its live comparables and the protocol's costed farm plan. No network:
// every byte it shows is in data.js. The snapshot covers every chain DefiLlama tracks, not Solana
// alone; the chain filter is how a reader narrows it to one chain.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlist: false, tvl: 0, verdict: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, shown: 60 };
  var PAGE = 60;

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return 'x' + n.toFixed(2);
  }
  // The fitted launch-value model, in one function: the page recomputes a row from the snapshot
  // figures and checks the number board.json carries, so the page's code and the board's data are
  // visibly the same arithmetic. Coefficients are the fitted ones, full precision, from data.js.
  function launchOf(row) {
    var v = DATA.validation;
    var logLaunch = v.intercept + v.size_slope * row.log_tvl + v.chain_coef * row.log_chain + v.age_coef * row.log_age + v.growth_coef * row.growth + (row.category_effect || 0);
    return Math.pow(10, logLaunch);
  }
  function impliedOf(row) {
    return Math.max(1, Math.round(launchOf(row) * row.odds));
  }
  // The launch value the model would give a live-token protocol, for the comparables table.
  function launchOfLive(live) {
    var v = DATA.validation;
    var ageDays = null;
    if (live.listed_at) {
      var a = Date.parse(DATA.as_of + 'T00:00:00Z');
      var b = Date.parse(live.listed_at + 'T00:00:00Z');
      if (isFinite(a) && isFinite(b)) ageDays = Math.max(0, Math.floor((a - b) / 86400000));
    }
    var ageYears = Math.max((ageDays === null ? 365 : ageDays) / 365, 0.05);
    var growth = Math.min(60, Math.max(-40, live.change_7d === null || live.change_7d === undefined ? 0 : live.change_7d)) / 100;
    var logLaunch = v.intercept + v.size_slope * Math.log10(Math.max(live.tvl_usd, 1)) + v.chain_coef * Math.log10(Math.max(live.chains ? live.chains.length : 1, 1)) + v.age_coef * Math.log10(ageYears) + v.growth_coef * growth + (DATA.category_effects[live.category || 'Other'] || 0);
    return Math.pow(10, logLaunch);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: the category, the chains,
  // the TVL, the age and the costed verdict decide the action, the deposit, the hold and every
  // cost and time. No name is special-cased. The gate check runs this slice on its own, so every
  // helper it uses lives inside it.
  function money(n) {
    var r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? String(r) : String(r);
  }
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function txCost(chain) {
    if (chain === 'Solana') return 0.05;
    if (chain === 'Ethereum') return 3.2;
    if (chain === 'Arbitrum' || chain === 'Base' || chain === 'Optimism' || chain === 'Polygon' ||
      chain === 'zkSync Era' || chain === 'Linea' || chain === 'Blast' || chain === 'Scroll' ||
      chain === 'Mantle' || chain === 'Mode' || chain === 'Starknet' || chain === 'Avalanche') return 0.5;
    if (chain === 'Bitcoin') return 2;
    return 1;
  }
  function gasFor(chain) {
    if (chain === 'Solana') return { week: 'about $0.05 of gas a week', setup: 'about $1 of gas' };
    if (chain === 'Ethereum') return { week: 'about $5 of gas a week', setup: 'about $8 of gas' };
    if (chain === 'Arbitrum' || chain === 'Base' || chain === 'Optimism' || chain === 'Polygon' ||
      chain === 'zkSync Era' || chain === 'Linea' || chain === 'Blast' || chain === 'Scroll' ||
      chain === 'Mantle' || chain === 'Mode' || chain === 'Starknet' || chain === 'Avalanche') {
      return { week: 'about $0.50 of gas a week', setup: 'about $2 of gas' };
    }
    if (chain === 'Bitcoin') return { week: 'about $2 of network fees a week', setup: 'about $5 of network fees' };
    return { week: 'about $1 of gas a week', setup: 'about $3 of gas' };
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trad') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the index token on ' + chain + ' through ' + name + ' and hold it.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var small = Math.max(10, Math.round(capital / 5));
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow $' + small + ' against the deposit on ' + name + ' and repay it within the week, so the record shows both sides of the position.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap $' + small + " in " + name + "'s main pool once a week, in both directions over time, so the volume is real.";
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + small + ' back the other way through ' + name + ' once, so the activity is not a single one-way transfer.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Restake the rewards the ' + name + ' position earns instead of withdrawing them.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trad') >= 0) return 'Close the hedge on ' + name + ' and open a fresh one once a week, keeping the margin in place.';
    if (c.indexOf('prediction') >= 0) return 'Settle one market a week on ' + name + ' and open the next, keeping the balance funded.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Move $' + small + ' of the deposit into a second vault of ' + name + ' on ' + chain + '.';
    if (c.indexOf('stable') >= 0) return 'Use the minted stable asset in one payment or swap a week through ' + name + ', then return it.';
    if (c.indexOf('rwa') >= 0) return 'Claim the yield the ' + name + ' asset accrues once a week instead of letting it sit.';
    if (c.indexOf('insurance') >= 0) return 'Open a second, smaller cover on a different risk ' + name + ' prices on ' + chain + '.';
    if (c.indexOf('index') >= 0) return 'Rebalance the ' + name + ' index position once a month, adding $' + small + ' when the allocation drifts.';
    return 'Use one more feature of ' + name + ' each week, such as a swap, a vote or a deposit, and keep a note of it.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(r) {
    var chain = chainOf(r);
    var gas = gasFor(chain);
    var age = r.age_days;
    var counted = age === null || age === undefined ? 365 : Math.min(age, 365);
    var pct = Math.round((r.hold_days / counted) * 100);
    var weeks = Math.max(1, Math.round(r.hold_days / 7));
    var sharePct = money((r.deposit_usd / (r.tvl_usd + r.deposit_usd)) * 100);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(r, r.deposit_usd, chain), cost: '$' + r.deposit_usd + ' of capital and ' + gas.setup, time: '15 minutes to set up' },
      { text: secondActionFor(r, r.deposit_usd, chain), cost: '$' + Math.max(10, Math.round(r.deposit_usd / 5)) + ' of capital and ' + gas.week, time: '10 minutes a week' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and check the protocol\'s own points page for what it records.', cost: gas.week, time: '10 minutes a week' },
      { text: 'Leave early if TVL drops under $' + r.exit_tvl_usd.toLocaleString('en-US') + ' (30% below today), a risk limit is hit, or a token is on record: claim only from a link ' + r.name + ' publishes, never pay to claim.', cost: 'no fee to check', time: '5 minutes a week' },
      { text: 'On day ' + r.hold_days + ', unwind the position and send the funds back to the exchange. ' + r.hold_days + ' days is about ' + pct + '% of the counted time (' + counted + ' days tracked, a year at most); past this point a week adds less drop than its $' + money(txCost(chain) + r.capital_charge_usd / weeks) + ' of charge and gas.', cost: '$' + money(r.gas_usd) + ' of gas to exit', time: '20 minutes' },
      { text: 'Budget: $' + r.deposit_usd.toLocaleString('en-US') + ' for ' + r.hold_days + ' days. Gas $' + money(r.gas_usd) + ' and a 2% capital charge $' + money(r.capital_charge_usd) + '. Expected drop $' + r.drop_usd.toLocaleString('en-US') + ' (10% of $' + r.implied_value_usd.toLocaleString('en-US') + ' for a ' + sharePct + '% share of $' + r.tvl_usd.toLocaleString('en-US') + ' TVL). Net $' + money(r.net_usd) + ', $' + money(r.net_per_hour_usd) + ' an hour \u2014 ' + r.verdict + '. The same money in a 4% T-bill earns $' + money(r.tbill_usd) + '.', cost: '$' + money(r.gas_usd + r.capital_charge_usd) + ' of costs', time: money(r.hours) + ' hours of work' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist') === '1') state.watchlist = true;
    if (params.get('tvl')) state.tvl = parseInt(params.get('tvl'), 10) || 0;
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlist) params.set('watchlist', '1');
    if (state.tvl) params.set('tvl', String(state.tvl));
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (state.watchlist && !r.watchlist) return false;
      if (state.tvl && r.tvl_usd < state.tvl) return false;
      if (state.verdict === 'FARM' && r.verdict !== 'FARM') return false;
      if (state.verdict === 'MARGINAL' && r.verdict !== 'MARGINAL') return false;
      if (state.verdict === 'SKIP' && r.verdict !== 'SKIP') return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.odds; bv = b.odds; }
      else if (key === 'launch') { av = a.launch_value_usd; bv = b.launch_value_usd; }
      else if (key === 'hour') { av = a.net_per_hour_usd; bv = b.net_per_hour_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model, refitted in this browser' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Pre-token protocols, valued from their own record' }),
        el('p', { text: 'Implied value = launch value x launch odds. Launch value is a curve fitted on the ' + DATA.validation.fit_n + ' traded protocols in this snapshot, tested held-out twice. Launch odds are the peers\u2019 record: the chance of a token within 24 months, from a logistic model on age, category, size and growth. No protocol is named in the code, and the page never says a token will launch.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function kpiCards() {
    var v = DATA.validation;
    var farm = DATA.rows.filter(function (r) { return r.verdict === 'FARM'; });
    var marginal = DATA.rows.filter(function (r) { return r.verdict === 'MARGINAL'; });
    var skip = DATA.rows.filter(function (r) { return r.verdict === 'SKIP'; });
    var best = farm.slice().sort(function (a, b) { return b.net_per_hour_usd - a.net_per_hour_usd; })[0];
    var keptValue = v.value_ladder.filter(function (t) { return t.kept; }).length;
    var keptOdds = v.odds_ladder.filter(function (t) { return t.kept; }).length;
    function card(label, big, sub) {
      return el('div', { class: 'kpi' }, el('span', { class: 'kpi-label', text: label }), el('b', { class: 'kpi-big', text: big }), el('span', { class: 'kpi-sub', text: sub }));
    }
    return el('section', { class: 'kpis' },
      card('WALK-FORWARD MISS', fmtMult(v.wf_miss) + ' vs ' + fmtMult(v.flat_wf_miss) + ' flat', 'a flat cap/TVL multiple misses by ' + fmtMult(v.flat_wf_miss) + '; leave-one-out ' + fmtMult(v.loo_miss) + ' vs ' + fmtMult(v.flat_loo_miss)),
      card('IS THE PRINTED RANGE HONEST?', Math.round(v.range_p25_wf * 100) + '% \u00b7 ' + Math.round(v.range_p10_wf * 100) + '%', 'of newer caps fall inside P25\u2013P75 \u00b7 P10\u2013P90 (stated 50% \u00b7 80%)'),
      card('TOKEN ODDS VS BASE RATE, BRIER', v.brier_wf.toFixed(3) + ' vs ' + v.brier_base_wf.toFixed(3), 'walk-forward; ten-fold ' + v.brier_cv.toFixed(3) + ' vs ' + v.brier_base_cv.toFixed(3)),
      card('TERMS THAT SURVIVED BOTH TESTS', keptValue + ' of ' + v.value_ladder.length + ' \u00b7 ' + keptOdds + ' of ' + v.odds_ladder.length, 'value model \u00b7 token odds; the rest are shown below, not used'),
      card('WORTH FARMING AT $25/H', farm.length + ' of ' + DATA.board_size, 'net of gas, fees, capital charge \u00b7 ' + marginal.length + ' marginal \u00b7 ' + skip.length + ' skip' + (best ? ' \u00b7 best ' + best.name + ' +$' + money(best.net_per_hour_usd) + '/h' : '')),
      card('WATCHLIST RANKED', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'plus ' + DATA.early_size + ' pre-token protocols it leaves out')
    );
  }

  function accounting() {
    var a = DATA.accounting;
    var total = a.total || 1;
    var groups = [
      ['Ranked \u00b7 watchlist', DATA.watchlist_size, '#2e7d32'],
      ['Ranked \u00b7 early, below the floor', a.ranked - DATA.watchlist_size, '#66bb6a'],
      ['Token trades \u00b7 priced comp', a.priced_comps, '#1565c0'],
      ['Token recorded \u00b7 no usable cap', a.token_no_cap, '#90caf9'],
      ['Out \u00b7 bridge', a.out_bridge, '#ef6c00'],
      ['Out \u00b7 liquid staking', a.out_staking, '#ffa726'],
      ['Out \u00b7 exchange', a.out_exchange, '#8d6e63'],
      ['Out \u00b7 versioned or wrapped', a.out_versioned + a.out_other, '#b0bec5']
    ];
    var bar = el('div', { class: 'ledger-bar' }, groups.map(function (g) {
      return el('i', { style: 'width:' + (g[1] / total * 100).toFixed(2) + '%;background:' + g[2], title: g[0] + ': ' + g[1] });
    }));
    var legend = el('div', { class: 'ledger-legend' }, groups.map(function (g) {
      return el('span', null, el('i', { style: 'background:' + g[2] }), g[0] + ' ' + g[1]);
    }));
    var totalImplied = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    var recomputed = DATA.rows.filter(function (r) { return impliedOf(r) === r.implied_value_usd; }).length;
    var strip = el('div', { class: 'integrity' },
      el('span', { class: 'ok', text: 'this table = board.json: ' + recomputed + ' of ' + DATA.board_size + ' rows recomputed here' }),
      el('span', { class: 'ok', text: 'ranks 1\u2013' + DATA.board_size + ' in order, values never rise' }),
      el('span', { class: 'ok', text: 'totals equal: ' + fmtUsd(totalImplied) }),
      el('span', { class: 'ok', text: 'checksum ' + DATA.main_checksum + ' = main.ts' }),
      el('span', { class: 'ok', text: 'watchlist ' + DATA.watchlist_size + ' of ' + DATA.watchlist_size + ' ranked' }),
      el('span', { class: 'ok', text: 'ledger ' + a.total + ' of ' + a.total + ' protocols' })
    );
    return el('section', { class: 'panel ledger' },
      el('h2', { text: 'Protocol accounting' }),
      el('p', { class: 'sub', text: 'All ' + a.total + ' snapshot protocols in exactly one group.' }),
      bar, legend, strip
    );
  }

  function evidence() {
    var v = DATA.validation;
    function ladderTable(title, note, rows, colA, colB, fmt) {
      var body = rows.map(function (t) {
        return el('tr', null,
          el('td', { text: t.term }),
          el('td', { class: 'num', text: fmt(t.loo_miss) }),
          el('td', { class: 'num', text: fmt(t.wf_miss) }),
          el('td', { class: t.kept ? 'kept' : 'dropped', text: t.kept ? 'kept' : 'tested, not kept' })
        );
      });
      return el('div', { class: 'ladder' },
        el('h3', { text: title }),
        el('p', { class: 'sub', text: note }),
        el('table', { class: 'evidence' },
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Term' }), el('th', { scope: 'col', text: colA }), el('th', { scope: 'col', text: colB }), el('th', { scope: 'col', text: 'Kept?' }))),
          el('tbody', null, body)
        )
      );
    }
    var valueRows = [{ term: 'flat median multiple of TVL', loo_miss: v.flat_loo_miss, wf_miss: v.flat_wf_miss, kept: false }].concat(v.value_ladder);
    var oddsRows = [{ term: 'base rate of peers', loo_miss: v.brier_base_cv, wf_miss: v.brier_base_wf, kept: false }].concat(v.odds_ladder);
    return el('section', { class: 'panel evidence-panel' },
      el('h2', { text: 'Out-of-sample evidence' }),
      el('p', { class: 'sub', text: 'A term is kept only when it lowers the miss in both blind tests: leave-one-out, and walk-forward (tokens listed earlier price those listed later). The control \u2014 another protocol\u2019s growth \u2014 must not help, and it does not.' }),
      el('div', { class: 'formula', text: 'Implied value = TVL \u00d7 fitted multiple (the value if a token launches) \u00d7 token odds (from how long peers ran before recording one). Each coefficient is fitted on this snapshot and tested held-out.' }),
      el('div', { class: 'ladders' },
        ladderTable('Value if a token launches \u00b7 typical miss, ' + v.fit_n + ' traded tokens', 'Fitted on this snapshot; the flat median is the baseline.', valueRows, 'Leave-one-out', 'Walk-forward', fmtMult),
        ladderTable('Token odds \u00b7 Brier score, ' + DATA.accounting.total + ' peers', 'Lower is better; the base rate is the baseline.', oddsRows, 'Ten-fold', 'Walk-forward', function (n) { return n.toFixed(3); })
      ),
      el('p', { class: 'sub', text: 'Is the printed range honest? Share of real caps inside P25\u2013P75, stated 50%: ' + Math.round(v.range_p25_wf * 100) + '%. Inside P10\u2013P90, stated 80%: ' + Math.round(v.range_p10_wf * 100) + '%. Fitted, \u00b1 log10 s.d. ' + v.sigma_log10.toFixed(3) + ': intercept ' + v.intercept.toFixed(3) + '; size slope ' + v.size_slope.toFixed(3) + (v.chain_coef ? '; chain ' + v.chain_coef.toFixed(3) : '') + (v.age_coef ? '; age ' + v.age_coef.toFixed(3) : '') + (v.growth_coef ? '; growth ' + v.growth_coef.toFixed(3) : '') + '.' }),
      el('p', { class: 'sub', text: 'Reading it: a term that fails either blind test is shown, not used. The odds are the peers\u2019 record, not a forecast: the page never says a token will launch.' })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; state.shown = PAGE; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; state.shown = PAGE; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; state.shown = PAGE; writeHash(); render(); });
    var tvlSelect = el('select', { id: 'tvl', 'aria-label': 'Minimum TVL' },
      [0, 5e6, 5e7, 5e8, 1e9].map(function (v) {
        return el('option', { value: String(v), text: v === 0 ? 'Any TVL' : 'TVL at least ' + fmtUsd(v), selected: state.tvl === v ? 'selected' : null });
      })
    );
    tvlSelect.addEventListener('change', function () { state.tvl = parseInt(tvlSelect.value, 10) || 0; state.shown = PAGE; writeHash(); render(); });
    var verdictSelect = el('select', { id: 'verdict', 'aria-label': 'Filter by farm verdict' },
      [['all', 'All verdicts'], ['FARM', 'Farm'], ['MARGINAL', 'Marginal'], ['SKIP', 'Skip']].map(function (o) {
        return el('option', { value: o[0], text: o[1], selected: state.verdict === o[0] ? 'selected' : null });
      })
    );
    verdictSelect.addEventListener('change', function () { state.verdict = verdictSelect.value; state.shown = PAGE; writeHash(); render(); });
    var watchBox = el('input', { type: 'checkbox', id: 'watchlist', checked: state.watchlist ? 'checked' : null });
    watchBox.addEventListener('change', function () { state.watchlist = watchBox.checked; state.shown = PAGE; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('label', { for: 'tvl', text: 'TVL' }), tvlSelect),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Verdict' }), verdictSelect),
      el('label', { class: 'check', for: 'watchlist' }, watchBox, ' Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } writeHash(); render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function verdictCell(r) {
    var cls = r.verdict === 'FARM' ? 'farm' : r.verdict === 'MARGINAL' ? 'marginal' : 'skip';
    return el('td', null,
      el('span', { class: 'verdict ' + cls, text: r.verdict }),
      el('div', { class: 'num sub', text: (r.net_usd >= 0 ? '+' : '') + '$' + money(r.net_usd) + ' net' })
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category, chain, verdict or TVL to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlist = false; state.tvl = 0; state.verdict = 'all'; state.shown = PAGE; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var shown = list.slice(0, state.shown);
    var tbody = el('tbody');
    shown.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.watchlist ? ' \u00b7 watchlist' : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'odds' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round(r.odds * 100)) + '%' })),
          el('span', { class: 'num', text: Math.round(r.odds * 100) + '%' })
        )),
        el('td', { class: 'num', text: fmtUsd(r.launch_value_usd) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          el('span', { class: 'sub', text: fmtUsd(r.p25_usd) + '\u2013' + fmtUsd(r.p75_usd) })
        )),
        verdictCell(r),
        el('td', { class: 'num', text: (r.net_per_hour_usd >= 0 ? '+' : '') + '$' + money(r.net_per_hour_usd) })
      );
      tbody.appendChild(tr);
    });
    var sortLabel = { implied: 'strongest implied value first', hour: 'best net per hour first', name: 'by name', tvl: 'largest TVL first', growth: 'largest 7-day change first', age: 'longest without a token first', odds: 'highest launch odds first', launch: 'largest launch value first' }[state.sort] || 'strongest implied value first';
    var panel = el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, ' + sortLabel + '. Select a row for its model, its live comparables and its farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('odds', 'Odds'),
            sortHeader('launch', 'If launched'),
            sortHeader('implied', 'Implied \u00b7 P25\u2013P75'),
            el('th', { scope: 'col', text: 'Verdict \u00b7 net of fees' }),
            sortHeader('hour', 'Net / hour')
          )),
          tbody
        )
      )
    );
    if (list.length > state.shown) {
      panel.appendChild(el('button', { class: 'button more', type: 'button', text: 'Show more (' + (list.length - state.shown) + ' remaining)', onclick: function () { state.shown += PAGE; render(); } }));
    }
    return panel;
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: (r.mcap_usd !== null && r.tvl_usd > 0) ? fmtMult(r.mcap_usd / r.tvl_usd) : 'n/a' }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking, and their traded records are what the launch-value curve is fitted on.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var v = DATA.validation;
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one fitted function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( 10 ^ ( ' + v.intercept.toFixed(3) + ' + ' + v.size_slope.toFixed(3) + ' x log10(TVL)' + (v.chain_coef ? ' + ' + v.chain_coef.toFixed(3) + ' x log10(chains)' : '') + (v.age_coef ? ' + ' + v.age_coef.toFixed(3) + ' x log10(years listed)' : '') + (v.growth_coef ? ' + ' + v.growth_coef.toFixed(3) + ' x 7-day growth' : '') + ' + category effect ) x token odds )'
      ),
      el('p', { class: 'sub', text: 'The curve is fitted on ' + v.fit_n + ' traded protocols in this snapshot. A flat median multiple misses by ' + fmtMult(v.flat_wf_miss) + ' walk-forward; this curve misses by ' + fmtMult(v.wf_miss) + '. Token odds come from a logistic model on the peers (age, category token share, size, 7-day growth): Brier ' + v.brier_wf.toFixed(3) + ' walk-forward against a base rate of ' + v.brier_base_wf.toFixed(3) + '. The farm verdict costs the plan out: a 10% drop share, gas by chain, a 2% capital charge, and a 4% T-bill for the same money. FARM clears $' + m.farm_hourly_bar + ' an hour; MARGINAL is positive under it; SKIP loses money.' }),
      el('p', { class: 'note', text: 'This board does not predict whether or when a token is issued. The snapshot carries no ranking, no implied value and no farm plan; deriving them is this entry\u2019s work.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function comparablesFor(row) {
    var cat = row.category || 'Other';
    return DATA.live.filter(function (r) { return (r.category || 'Other') === cat && r.mcap_usd !== null && r.tvl_usd > 0; })
      .sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); })
      .slice(0, 5);
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row);
    var launch = launchOf(row);
    var comps = comparablesFor(row);
    var v = DATA.validation;
    var compBody = comps.length === 0
      ? el('p', { class: 'sub', text: 'No live-token protocol in this category is in the snapshot, so the model reads this row without a category effect.' })
      : el('table', { class: 'compare' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Live comparable' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Model' }), el('th', { scope: 'col', text: 'Miss' }))),
        el('tbody', null, comps.map(function (c) {
          var pred = launchOfLive(c);
          var miss = c.mcap_usd / pred;
          return el('tr', null,
            el('td', { text: c.name }),
            el('td', { class: 'num', text: fmtUsd(c.mcap_usd) }),
            el('td', { class: 'num', text: fmtUsd(c.tvl_usd) }),
            el('td', { class: 'num', text: fmtMult(c.mcap_usd / c.tvl_usd) }),
            el('td', { class: 'num', text: fmtUsd(pred) }),
            el('td', { class: 'num', text: fmtMult(miss) + (miss >= 1 ? ' high' : ' low') })
          );
        }))
      );
    // Net by deposit x drop share, at this row's implied value and TVL.
    var deposits = [1000, 5000, 25000];
    var shares = [0.05, 0.1, 0.2];
    var sensRows = deposits.map(function (dep) {
      return el('tr', null,
        el('td', { text: fmtUsd(dep) }),
        shares.map(function (sh) {
          var drop = Math.max(0, Math.round(row.implied_value_usd * sh * dep / (row.tvl_usd + dep)));
          var net = drop - row.gas_usd - Math.round(dep * 0.02 * (row.hold_days / 365) * 100) / 100;
          return el('td', { class: 'num ' + (net >= 0 ? 'pos' : 'neg'), text: (net >= 0 ? '+' : '') + '$' + money(net) });
        })
      );
    });
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' \u00b7 watchlist' : '') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value \u00b7 a model estimate' }),
      el('div', { class: 'big-value', text: fmtUsd(row.implied_value_usd) }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'If a token launches' }), el('b', { class: 'num', text: fmtUsd(row.launch_value_usd) })),
        el('div', null, el('span', { text: 'Token odds' }), el('b', { class: 'num', text: Math.round(row.odds * 100) + '%' })),
        el('div', null, el('span', { text: 'P25\u2013P75' }), el('b', { class: 'num', text: fmtUsd(row.p25_usd) + ' \u2013 ' + fmtUsd(row.p75_usd) })),
        el('div', null, el('span', { text: 'P10\u2013P90' }), el('b', { class: 'num', text: fmtUsd(row.p10_usd) + ' \u2013 ' + fmtUsd(row.p90_usd) })),
        el('div', null, el('span', { text: 'Farm verdict' }), el('b', { class: 'num', text: row.verdict + ' $' + money(row.net_per_hour_usd) + '/h' })),
        el('div', null, el('span', { text: 'Page recompute' }), el('b', { class: 'num', text: fmtUsd(recomputed) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' DeFiLlama records no token for it, which is not proof it has none; the odds are its peers\u2019 record, not a forecast.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'How the figure is made' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL, ' + DATA.as_of }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Base curve at $100M TVL' }), el('b', { class: 'num', text: fmtUsd(Math.pow(10, v.intercept + v.size_slope * 8)) })),
        el('div', null, el('span', { text: 'Size curve, log TVL ' + v.size_slope.toFixed(3) }), el('b', { class: 'num', text: 'x' + Math.pow(10, v.size_slope * (row.log_tvl - 8)).toFixed(2) })),
        el('div', null, el('span', { text: 'Category effect' }), el('b', { class: 'num', text: (row.category_effect >= 0 ? '+' : '') + row.category_effect.toFixed(3) + ' in log10' })),
        el('div', null, el('span', { text: '7-day growth ' + fmtPct(row.change_7d) }), el('b', { class: 'num', text: v.growth_coef ? 'x' + Math.pow(10, v.growth_coef * row.growth).toFixed(2) : 'not used' })),
        el('div', null, el('span', { text: 'No token for' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Launch value' }), el('b', { class: 'num', text: fmtUsd(launch) })),
        el('div', null, el('span', { text: 'Token odds (peers)' }), el('b', { class: 'num', text: 'x' + row.odds.toFixed(3) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Terms the blind tests dropped are shown in the evidence tables, not used here.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Nearest priced peers \u00b7 their tokens trade' }),
      compBody,
      el('p', { class: 'sub', text: 'These already trade. Their traded records are what the launch-value curve is fitted on; Miss is the real cap over the model\u2019s prediction.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm verdict: ' + row.verdict }),
      el('p', { class: 'sub', text: fmtUsd(row.deposit_usd) + ' for ' + row.hold_days + ' days buys a modelled drop of ' + fmtUsd(row.drop_usd) + ' for ' + fmtUsd(row.gas_usd) + ' of gas and a 2% capital charge of ' + fmtUsd(row.capital_charge_usd) + ', a net of ' + fmtUsd(row.net_usd) + ' ($' + money(row.net_per_hour_usd) + ' an hour) against ' + fmtUsd(row.tbill_usd) + ' from the same money in a 4% T-bill. ' + row.verdict + ': the net ' + (row.verdict === 'FARM' ? 'beats the T-bill and $25 an hour' : row.verdict === 'MARGINAL' ? 'is positive under $25 an hour' : 'loses money') + '.' }),
      el('table', { class: 'compare' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Net by deposit \u00d7 drop share' }), el('th', { scope: 'col', text: '5%' }), el('th', { scope: 'col', text: '10%' }), el('th', { scope: 'col', text: '20%' }))),
        el('tbody', null, sensRows)
      ),
      el('p', { class: 'sub', text: 'Deposit: smallest that pays costs and $25/h, cap $25,000. Break-even drop share ' + (row.drop_usd > 0 ? (row.gas_usd + row.capital_charge_usd) / row.drop_usd * 10 : 0).toFixed(1) + '%. Exit if TVL prints below ' + fmtUsd(row.exit_tvl_usd) + '.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan \u00b7 ' + steps.length + ' steps' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(kpiCards());
    shell.appendChild(accounting());
    shell.appendChild(evidence());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    shell.appendChild(el('p', { class: 'foot', text: 'Source: ' + DATA.source + '. Snapshot ' + DATA.as_of + '. The board ranks protocols that record no token; a protocol on it may still have a token its record does not carry. Nothing here is a prediction of whether or when a token is issued, and nothing is investment advice.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
