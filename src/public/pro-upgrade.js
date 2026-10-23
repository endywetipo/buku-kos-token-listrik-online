/* BukuKosOnline PRO enhancements; loaded after the original classic script. */
(function () {
  'use strict';

  const PRO_BUCKET = 'bukukos-bukti';
  const MAX_PROOF_BYTES = 2 * 1024 * 1024;
  const PAGE_SIZE = 10;
  const MONTHS = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  const tableState = {
    kos: { search: '', month: '', door: '', status: '', page: 1 },
    token: { search: '', month: '', door: '', status: '', page: 1 }
  };
  const proofUrlCache = new Map();
  const localPreviewUrls = { kos: '', token: '' };
  let revenueChart = null;
  let statusChart = null;
  let lastDataFingerprint = '';

  const safeText = value => String(value == null ? '' : value);
  const lower = value => safeText(value).trim().toLocaleLowerCase('id-ID');

  function monthIndexFromName(value) {
    const text = lower(value);
    return MONTHS.findIndex(month => text.includes(month));
  }

  function yearFromPeriod(value, fallback) {
    const match = safeText(value).match(/\b(20\d{2})\b/);
    return match ? Number(match[1]) : (fallback || new Date().getFullYear());
  }

  function periodParts(entry, type) {
    const period = safeText(entry && entry.periode);
    const year = yearFromPeriod(period, entry && entry.tanggal ? new Date(String(entry.tanggal).slice(0, 10) + 'T00:00:00').getFullYear() : new Date().getFullYear());
    let monthIndex = type === 'kos' ? monthIndexFromName(entry && entry.bulan) : -1;
    if (monthIndex < 0) monthIndex = monthIndexFromName(period);
    if (monthIndex < 0 && entry && entry.tanggal) {
      const d = new Date(String(entry.tanggal).slice(0, 10) + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) monthIndex = d.getMonth();
    }
    if (monthIndex < 0) monthIndex = new Date().getMonth();
    return { year, monthIndex };
  }

  function cycleKey(entry, type) {
    const parts = periodParts(entry, type);
    return `${parts.year}-${String(parts.monthIndex + 1).padStart(2, '0')}`;
  }

  function currentCycleKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function currentPeriodLabel() {
    return typeof getCurrentPeriode === 'function'
      ? getCurrentPeriode()
      : new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' });
  }

  function periodLabel(value, dateValue) {
    const raw = safeText(value).trim();
    if (raw) return raw.charAt(0).toLocaleUpperCase('id-ID') + raw.slice(1);
    if (dateValue) {
      const d = new Date(String(dateValue).slice(0, 10) + 'T00:00:00');
      if (!Number.isNaN(d.getTime())) return d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    }
    return currentPeriodLabel();
  }

  function kosMonthValue(entry) {
    return safeText(entry && entry.bulan) || periodLabel(entry && entry.periode, entry && entry.tanggal);
  }

  function tokenMonthValue(entry) {
    return periodLabel(entry && entry.periode, entry && entry.tanggal);
  }

  function dateFromParts(year, monthIndex, day) {
    return new Date(year, monthIndex, day, 12, 0, 0, 0);
  }

  function dateToIsoLocal(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function dateLabel(value) {
    if (!value) return '—';
    const str = String(value).slice(0, 10);
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function sortDateValue(entry) {
    const date = entry && (entry.tanggal || entry.created_at);
    const parsed = date ? new Date(date).getTime() : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function entriesForCycle(type, key) {
    const source = type === 'kos' ? data.kos_entries : data.token_entries;
    return source.filter(entry => cycleKey(entry, type) === key);
  }

  function kosRoomTotal(kamar, key) {
    return data.kos_entries
      .filter(entry => String(entry.kamar) === String(kamar) && cycleKey(entry, 'kos') === key)
      .reduce((sum, entry) => sum + Number(entry.jumlah || 0), 0);
  }

  function tokenRoomEntries(kamar, key) {
    return data.token_entries.filter(entry => String(entry.kamar) === String(kamar) && cycleKey(entry, 'token') === key);
  }

  function dueInfo(entry, paid) {
    const parts = periodParts(entry, 'kos');
    const dueDate = dateFromParts(parts.year, parts.monthIndex, 5);
    const today = new Date();
    const todayMidnight = dateFromParts(today.getFullYear(), today.getMonth(), today.getDate());
    const daysUntil = Math.ceil((dueDate.getTime() - todayMidnight.getTime()) / 86400000);
    if (paid) return { paid: true, tone: 'paid', label: 'LUNAS', lateDays: 0, dueDate };
    if (daysUntil < 0) {
      const lateDays = Math.abs(daysUntil);
      return { paid: false, tone: 'late', label: `TELAT ${lateDays} HARI`, lateDays, dueDate };
    }
    if (daysUntil <= 2) return { paid: false, tone: 'soon', label: `H-${daysUntil} JATUH TEMPO`, lateDays: 0, dueDate };
    return { paid: false, tone: 'pending', label: 'BELUM LUNAS', lateDays: 0, dueDate };
  }

  function kosStatus(entry) {
    const amountPaid = kosRoomTotal(entry.kamar, cycleKey(entry, 'kos'));
    const paid = amountPaid >= KOS_PER_BULAN;
    return { ...dueInfo(entry, paid), amountPaid, remaining: Math.max(0, KOS_PER_BULAN - amountPaid) };
  }

  function tokenIsPaid(entry) {
    return tokenRoomEntries(entry.kamar, cycleKey(entry, 'token')).length > 0;
  }

  function latestOccupant(type, kamar) {
    const source = type === 'kos' ? data.kos_entries : data.token_entries;
    const matching = source.filter(entry => String(entry.kamar) === String(kamar)).sort((a, b) => sortDateValue(b) - sortDateValue(a));
    return matching[0] ? safeText(matching[0].nama) : `Penghuni Pintu ${kamar}`;
  }

  function buildKosDisplayRows() {
    const rows = data.kos_entries.map(entry => ({ ...entry, _virtual: false, _status: kosStatus(entry) }));
    const currentKey = currentCycleKey();
    for (let room = 1; room <= JUMLAH_KAMAR; room++) {
      const currentEntries = data.kos_entries.filter(entry => String(entry.kamar) === String(room) && cycleKey(entry, 'kos') === currentKey);
      if (currentEntries.length) continue;
      const now = new Date();
      const due = dateFromParts(now.getFullYear(), now.getMonth(), 5);
      const virtual = {
        id: `pending-kos-${currentKey}-${room}`,
        nama: latestOccupant('kos', room), kamar: room,
        bulan: getCurrentBulan(), periode: currentPeriodLabel(),
        jumlah: KOS_PER_BULAN, tanggal: dateToIsoLocal(due),
        _virtual: true,
        _status: { ...dueInfo({ bulan: getCurrentBulan(), periode: currentPeriodLabel(), tanggal: dateToIsoLocal(due) }, false), amountPaid: 0, remaining: KOS_PER_BULAN }
      };
      rows.push(virtual);
    }
    return rows;
  }

  function buildTokenDisplayRows() {
    const rows = data.token_entries.map(entry => ({ ...entry, _virtual: false, _paid: tokenIsPaid(entry) }));
    const currentKey = currentCycleKey();
    for (let room = 1; room <= JUMLAH_KAMAR; room++) {
      if (tokenRoomEntries(room, currentKey).length) continue;
      rows.push({
        id: `pending-token-${currentKey}-${room}`, nama: latestOccupant('token', room), kamar: room,
        periode: currentPeriodLabel(), tanggal: '', jumlah: 0,
        _virtual: true, _paid: false
      });
    }
    return rows;
  }

  function currentKosRoomSummary() {
    const summary = {};
    const key = currentCycleKey();
    for (let room = 1; room <= JUMLAH_KAMAR; room++) {
      const entries = data.kos_entries.filter(entry => String(entry.kamar) === String(room) && cycleKey(entry, 'kos') === key);
      const total = entries.reduce((sum, entry) => sum + Number(entry.jumlah || 0), 0);
      summary[room] = { total, entries, paid: total >= KOS_PER_BULAN };
    }
    return summary;
  }

  function currentTokenRoomSummary() {
    const summary = {};
    const key = currentCycleKey();
    for (let room = 1; room <= JUMLAH_KAMAR; room++) {
      const entries = tokenRoomEntries(room, key);
      summary[room] = { total: entries.reduce((sum, entry) => sum + Number(entry.jumlah || 0), 0), entries, paid: entries.length > 0 };
    }
    return summary;
  }

  window.getKamarSummaryKos = currentKosRoomSummary;
  window.getKamarSummaryToken = currentTokenRoomSummary;

  function renderKosStats() {
    const summary = currentKosRoomSummary();
    const total = Object.values(summary).reduce((sum, room) => sum + room.total, 0);
    const paidRooms = Object.values(summary).filter(room => room.paid).length;
    const target = JUMLAH_KAMAR * KOS_PER_BULAN;
    const progress = target ? Math.min(100, Math.round(total / target * 100)) : 0;
    document.getElementById('kos-total').textContent = formatRupiah(total);
    document.getElementById('kos-sudah').textContent = paidRooms;
    document.getElementById('kos-belum').textContent = JUMLAH_KAMAR - paidRooms;
    document.getElementById('kos-target').textContent = formatRupiah(target);
    document.getElementById('kos-progress-text').textContent = progress + '%';
    document.getElementById('kos-progress-bar').style.width = progress + '%';
    document.getElementById('kos-progress-bar').className = 'progress-fill ' + (progress >= 100 ? 'green' : progress >= 50 ? 'orange' : 'red');
  }

  function renderKosKamar() {
    const summary = currentKosRoomSummary();
    const grid = document.getElementById('kos-kamar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let room = 1; room <= JUMLAH_KAMAR; room++) {
      const result = summary[room];
      const state = dueInfo({ bulan: getCurrentBulan(), periode: currentPeriodLabel() }, result.paid);
      const card = document.createElement('div');
      card.className = `kamar-item ${state.tone}`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Pintu ${room}: ${state.label}`);
      card.onclick = () => selectKamarKos(room);
      card.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectKamarKos(room); } };
      card.innerHTML = `<div class="kamar-num">Pintu ${room}</div><div class="kamar-status">${result.paid ? '✓ Lunas' : escapeHtml(state.label)}</div><div class="kamar-amount">${formatRupiah(result.paid ? result.total : Math.max(0, KOS_PER_BULAN - result.total))}</div>`;
      grid.appendChild(card);
    }
  }

  function renderTokenStats() {
    const current = entriesForCycle('token', currentCycleKey());
    const total = current.reduce((sum, entry) => sum + Number(entry.jumlah || 0), 0);
    const summary = currentTokenRoomSummary();
    const filled = Object.values(summary).filter(room => room.paid).length;
    const kwh = Math.round(total / TARIF_PER_KWH * 10) / 10;
    document.getElementById('token-total').textContent = formatRupiah(total);
    document.getElementById('token-kwh').textContent = kwh + ' kWh';
    document.getElementById('token-sudah').textContent = filled;
    document.getElementById('token-belum').textContent = JUMLAH_KAMAR - filled;
  }

  function renderTokenKamar() {
    const summary = currentTokenRoomSummary();
    const grid = document.getElementById('token-kamar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let room = 1; room <= JUMLAH_KAMAR; room++) {
      const result = summary[room];
      const card = document.createElement('div');
      card.className = `kamar-item ${result.paid ? 'paid' : 'pending'}`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Pintu ${room}: ${result.paid ? 'sudah isi token' : 'belum isi token'}`);
      card.onclick = () => selectKamarToken(room);
      card.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectKamarToken(room); } };
      card.innerHTML = `<div class="kamar-num">Pintu ${room}</div><div class="kamar-status">${result.paid ? '✓ Sudah Isi' : 'Belum Isi'}</div><div class="kamar-amount">${result.paid ? formatRupiah(result.total) : '—'}</div>`;
      grid.appendChild(card);
    }
  }

  function dueDateFor(entry) {
    const parts = periodParts(entry, 'kos');
    return dateFromParts(parts.year, parts.monthIndex, 5);
  }

  function paymentReminderUrl(entry, amount) {
    const name = safeText(entry.nama || `Penghuni Pintu ${entry.kamar}`);
    const month = kosMonthValue(entry);
    const text = `Halo ${name} Pintu ${entry.kamar} tagihan bulan ${month} ${formatRupiah(amount)} jatuh tempo tanggal 5. Mohon dibayar - BukuKosOnline`;
    return 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  function tokenReminderUrl(entry) {
    const text = `Halo ${safeText(entry.nama || `Penghuni Pintu ${entry.kamar}`)} Pintu ${entry.kamar}, mohon segera isi kontribusi token listrik bulan ${tokenMonthValue(entry)}. Terima kasih - BukuKosOnline`;
    return 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  function statusToneForToken(paid) { return paid ? 'paid' : 'late'; }

  function ensureHistoryStructure(type) {
    const host = document.getElementById(`${type}-riwayat-table`);
    if (!host) return null;
    if (host.dataset.proReady === 'true') return host;
    const isKos = type === 'kos';
    const roomOptions = Array.from({ length: JUMLAH_KAMAR }, (_, index) => `<option value="${index + 1}">Pintu ${index + 1}</option>`).join('');
    host.innerHTML = `
      <div class="table-toolbar" aria-label="Filter data ${isKos ? 'kos' : 'token'}">
        <div class="filter-grid">
          <label class="filter-search"><span>Search nama penghuni</span><input type="search" id="${type}-search" placeholder="Cari nama penghuni..." autocomplete="off"></label>
          <label><span>Filter bulan</span><select id="${type}-filter-month"><option value="">Semua bulan</option></select></label>
          <label><span>Filter pintu</span><select id="${type}-filter-door"><option value="">Semua pintu</option>${roomOptions}</select></label>
          <label><span>Status</span><select id="${type}-filter-status"><option value="">Semua status</option><option value="paid">Lunas</option><option value="unpaid">Belum</option></select></label>
        </div>
      </div>
      <div class="table-scroll"><table><thead id="${type}-table-head"></thead><tbody id="${type}-table-body"></tbody></table></div>
      <div class="pagination" id="${type}-pagination"></div>`;
    host.dataset.proReady = 'true';
    const state = tableState[type];
    host.querySelector(`#${type}-search`).addEventListener('input', event => { state.search = event.target.value; state.page = 1; renderHistory(type); });
    host.querySelector(`#${type}-filter-month`).addEventListener('change', event => { state.month = event.target.value; state.page = 1; renderHistory(type); });
    host.querySelector(`#${type}-filter-door`).addEventListener('change', event => { state.door = event.target.value; state.page = 1; renderHistory(type); });
    host.querySelector(`#${type}-filter-status`).addEventListener('change', event => { state.status = event.target.value; state.page = 1; renderHistory(type); });
    host.querySelector(`#${type}-table-head`).innerHTML = `<tr><th>Tanggal</th><th>Nama Penghuni</th><th>Pintu</th><th>Bulan</th><th>Jumlah</th><th>Status</th><th>Bukti</th><th>Aksi</th></tr>`;
    return host;
  }

  function getRows(type) { return type === 'kos' ? buildKosDisplayRows() : buildTokenDisplayRows(); }
  function paidForRow(type, row) { return type === 'kos' ? row._status.paid : row._paid; }
  function rowMonth(type, row) { return type === 'kos' ? kosMonthValue(row) : tokenMonthValue(row); }

  function updateMonthFilter(type, rows) {
    const select = document.getElementById(`${type}-filter-month`);
    if (!select) return;
    const options = [...new Set(rows.map(row => rowMonth(type, row)).filter(Boolean))];
    options.sort((a, b) => {
      const ap = periodParts({ periode: a, bulan: a }, type);
      const bp = periodParts({ periode: b, bulan: b }, type);
      return (bp.year - ap.year) || (bp.monthIndex - ap.monthIndex) || a.localeCompare(b, 'id');
    });
    const signature = options.join('|');
    if (select.dataset.signature !== signature) {
      const previous = tableState[type].month;
      select.innerHTML = '<option value="">Semua bulan</option>' + options.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
      select.dataset.signature = signature;
      tableState[type].month = options.includes(previous) ? previous : '';
    }
    select.value = tableState[type].month;
  }

  function renderProofCell(entry) {
    const path = safeText(entry.bukti_path);
    if (!path) return '<span class="muted-cell">—</span>';
    const url = proofUrlCache.get(path) && proofUrlCache.get(path).expires > Date.now() ? proofUrlCache.get(path).url : '';
    if (!url) return '<span class="proof-pending" title="Bukti sedang dimuat">Memuat…</span>';
    return `<button type="button" class="proof-thumb-button" data-proof-url="${escapeHtml(url)}" aria-label="Lihat bukti transfer"><img class="proof-thumb" src="${escapeHtml(url)}" alt="Bukti transfer" loading="lazy"></button>`;
  }

  function rowActionHtml(type, row, paid) {
    const id = escapeHtml(row.id);
    const adminActions = isAdmin && !row._virtual
      ? `<button type="button" class="btn btn-sm btn-warning" onclick="${type === 'kos' ? 'editKos' : 'editToken'}('${id}')">Edit</button><button type="button" class="btn btn-sm btn-danger" onclick="${type === 'kos' ? 'hapusKos' : 'hapusToken'}('${id}')">Hapus</button>`
      : '';
    if (type === 'kos' && !paid) {
      const due = row._status ? row._status.remaining : Math.max(0, KOS_PER_BULAN - kosRoomTotal(row.kamar, cycleKey(row, 'kos')));
      const url = paymentReminderUrl(row, due);
      return `<div class="row-actions"><a class="btn btn-success btn-sm wa-reminder" target="_blank" rel="noopener noreferrer" href="${escapeHtml(url)}">Tagih via WA</a>${adminActions}</div>`;
    }
    if (type === 'token' && !paid) {
      return `<div class="row-actions"><a class="btn btn-success btn-sm wa-reminder" target="_blank" rel="noopener noreferrer" href="${escapeHtml(tokenReminderUrl(row))}">Tagih via WA</a>${adminActions}</div>`;
    }
    return adminActions ? `<div class="row-actions">${adminActions}</div>` : '<span class="muted-cell">—</span>';
  }

  function renderHistory(type) {
    const host = ensureHistoryStructure(type);
    if (!host) return;
    const state = tableState[type];
    const rows = getRows(type);
    updateMonthFilter(type, rows);
    const search = lower(state.search);
    const filtered = rows.filter(row => {
      if (search && !lower(row.nama).includes(search)) return false;
      if (state.month && rowMonth(type, row) !== state.month) return false;
      if (state.door && String(row.kamar) !== state.door) return false;
      if (state.status === 'paid' && !paidForRow(type, row)) return false;
      if (state.status === 'unpaid' && paidForRow(type, row)) return false;
      return true;
    }).sort((a, b) => sortDateValue(b) - sortDateValue(a) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);
    const body = document.getElementById(`${type}-table-body`);
    if (!pageRows.length) {
      body.innerHTML = `<tr><td colspan="8"><div class="empty-state compact-empty"><div class="icon">${type === 'kos' ? '🏠' : '⚡'}</div><p>${filtered.length ? 'Tidak ada data pada halaman ini.' : 'Tidak ada data yang cocok dengan filter.'}</p></div></td></tr>`;
    } else {
      body.innerHTML = pageRows.map(row => {
        const paid = paidForRow(type, row);
        const meta = type === 'kos' ? row._status : { paid, tone: statusToneForToken(paid), label: paid ? 'LUNAS' : 'BELUM ISI' };
        const amount = type === 'kos' && row._virtual ? row._status.remaining : Number(row.jumlah || 0);
        const rowClass = type === 'kos' ? `status-row-${meta.tone}` : `status-row-${paid ? 'paid' : 'late'}`;
        const month = rowMonth(type, row);
        const statusLabel = meta.label;
        return `<tr class="${rowClass}"><td>${dateLabel(row.tanggal)}</td><td class="tenant-cell">${escapeHtml(row.nama)}</td><td>Pintu ${escapeHtml(row.kamar)}</td><td>${escapeHtml(month)}</td><td class="amount-cell">${formatRupiah(amount)}</td><td><span class="status-badge ${paid ? 'badge-paid' : meta.tone === 'soon' ? 'badge-soon' : 'badge-unpaid'}">${escapeHtml(statusLabel)}</span>${type === 'kos' && !paid && meta.tone === 'late' ? `<small class="late-note">Terlambat ${meta.lateDays} hari</small>` : ''}</td><td>${renderProofCell(row)}</td><td>${rowActionHtml(type, row, paid)}</td></tr>`;
      }).join('');
    }
    const pagination = document.getElementById(`${type}-pagination`);
    const from = filtered.length ? start + 1 : 0;
    const to = Math.min(start + PAGE_SIZE, filtered.length);
    pagination.innerHTML = `<span class="pagination-info">Menampilkan ${from}–${to} dari ${filtered.length}</span><div class="pagination-buttons"><button type="button" class="btn btn-sm page-button" data-page="prev" ${state.page <= 1 ? 'disabled' : ''}>Sebelumnya</button><span class="page-count">Halaman ${state.page} / ${totalPages}</span><button type="button" class="btn btn-sm page-button" data-page="next" ${state.page >= totalPages ? 'disabled' : ''}>Berikutnya</button></div>`;
    pagination.querySelector('[data-page="prev"]').addEventListener('click', () => { state.page--; renderHistory(type); });
    pagination.querySelector('[data-page="next"]').addEventListener('click', () => { state.page++; renderHistory(type); });
    host.querySelectorAll('.proof-thumb-button').forEach(button => button.addEventListener('click', () => openProofPreview(button.dataset.proofUrl)));
  }

  function renderKosRiwayat() { renderHistory('kos'); }
  function renderTokenRiwayat() { renderHistory('token'); }

  function ensureDashboardCharts() {
    const dashboard = pages && pages['/dashboard'];
    if (!dashboard || dashboard.querySelector('#pro-dashboard-charts')) return;
    const card = document.createElement('section');
    card.className = 'card pro-chart-card';
    card.id = 'pro-dashboard-charts';
    card.innerHTML = `<div class="card-title">Analitik Keuangan</div><p class="chart-subtitle">Pemasukan enam bulan terakhir dan ringkasan status pembayaran kos bulan ini.</p><div class="chart-grid"><div class="chart-panel"><h3>Pemasukan 6 Bulan</h3><canvas id="pro-revenue-chart" aria-label="Grafik pemasukan kos dan token selama enam bulan" role="img"></canvas></div><div class="chart-panel"><h3>Status Pembayaran</h3><canvas id="pro-status-chart" aria-label="Grafik status pembayaran kos bulan ini" role="img"></canvas><div class="chart-legend-note"><span><i class="legend-dot green-dot"></i>Lunas</span><span><i class="legend-dot red-dot"></i>Belum lunas</span></div></div></div>`;
    dashboard.appendChild(card);
  }

  function lastSixPeriods() {
    const now = new Date();
    const result = [];
    for (let offset = 5; offset >= 0; offset--) {
      const month = new Date(now.getFullYear(), now.getMonth() - offset, 1, 12);
      const full = month.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
      result.push({ key: lower(full), label: month.toLocaleString('id-ID', { month: 'short' }) + ' ' + month.getFullYear() });
    }
    return result;
  }

  function renderDashboardCharts() {
    ensureDashboardCharts();
    if (!window.Chart || !document.getElementById('pro-revenue-chart')) return;
    const periods = lastSixPeriods();
    const kosValues = periods.map(period => data.kos_entries.filter(entry => lower(entry.periode) === period.key).reduce((sum, entry) => sum + Number(entry.jumlah || 0), 0));
    const tokenValues = periods.map(period => data.token_entries.filter(entry => lower(entry.periode) === period.key).reduce((sum, entry) => sum + Number(entry.jumlah || 0), 0));
    const roomSummary = currentKosRoomSummary();
    const paid = Object.values(roomSummary).filter(room => room.paid).length;
    const unpaid = Math.max(0, JUMLAH_KAMAR - paid);
    if (revenueChart) {
      revenueChart.data.labels = periods.map(period => period.label);
      revenueChart.data.datasets[0].data = kosValues;
      revenueChart.data.datasets[1].data = tokenValues;
      revenueChart.update('none');
    } else {
      revenueChart = new Chart(document.getElementById('pro-revenue-chart'), {
        type: 'bar',
        data: { labels: periods.map(period => period.label), datasets: [
          { label: 'Pembayaran kos', data: kosValues, backgroundColor: '#1e40af', borderRadius: 7, maxBarThickness: 34 },
          { label: 'Token listrik', data: tokenValues, backgroundColor: '#60a5fa', borderRadius: 7, maxBarThickness: 34 }
        ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: item => `${item.dataset.label}: ${formatRupiah(item.raw)}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: value => value >= 1000000 ? `${(value / 1000000).toFixed(1)} jt` : `${Math.round(value / 1000)} rb` }, grid: { color: '#eaf0fb' } }, x: { grid: { display: false } } } }
      });
    }
    if (statusChart) {
      statusChart.data.datasets[0].data = [paid, unpaid];
      statusChart.update('none');
    } else {
      statusChart = new Chart(document.getElementById('pro-status-chart'), {
        type: 'doughnut',
        data: { labels: ['Lunas', 'Belum lunas'], datasets: [{ data: [paid, unpaid], backgroundColor: ['#16a34a', '#dc2626'], borderWidth: 0, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: item => `${item.label}: ${item.raw} pintu` } } } }
      });
    }
  }

  function proRenderAll() {
    renderKosStats(); renderKosKamar(); renderKosRiwayat();
    renderTokenStats(); renderTokenKamar(); renderTokenRiwayat(); renderDashboardCharts();
  }

  async function storageRequest(path, options) {
    const response = await fetch(`${SUPABASE_URL}/storage/v1${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: 'Bearer ' + (sessionToken || SUPABASE_PUBLISHABLE_KEY),
        ...(options && options.headers ? options.headers : {})
      }
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch (_) { payload = text; }
    if (!response.ok) throw new Error(typeof payload === 'string' ? payload : safeText(payload && (payload.message || payload.error || payload.statusCode)) || `HTTP ${response.status}`);
    return payload;
  }

  function encodeObjectPath(path) { return safeText(path).split('/').map(segment => encodeURIComponent(segment)).join('/'); }

  async function signedProofUrl(path) {
    const cached = proofUrlCache.get(path);
    if (cached && cached.expires > Date.now() + 60000) return cached.url;
    const response = await storageRequest(`/object/sign/${PRO_BUCKET}/${encodeObjectPath(path)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 })
    });
    const signed = response && (response.signedURL || response.signedUrl);
    if (!signed) throw new Error('URL bukti tidak tersedia');
    const url = signed.startsWith('http') ? signed : signed.startsWith('/storage/v1/')
      ? `${SUPABASE_URL}${signed}`
      : `${SUPABASE_URL}/storage/v1/${signed.replace(/^\//, '')}`;
    proofUrlCache.set(path, { url, expires: Date.now() + 3500000 });
    return url;
  }

  async function hydrateProofUrls(nextData) {
    const entries = [...nextData.kos_entries, ...nextData.token_entries].filter(entry => entry.bukti_path);
    await Promise.all(entries.map(async entry => {
      try { await signedProofUrl(entry.bukti_path); }
      catch (error) { console.warn('Bukti belum dapat dibuka:', error.message); }
    }));
  }

  async function uploadProof(type, file) {
    if (!file) return null;
    validateProof(file);
    const extension = file.type === 'image/png' ? 'png' : 'jpg';
    const randomId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${type}/${randomId}.${extension}`;
    await storageRequest(`/object/${PRO_BUCKET}/${encodeObjectPath(path)}`, {
      method: 'POST', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file
    });
    proofUrlCache.delete(path);
    return path;
  }

  async function removeProof(path) {
    if (!path) return;
    try {
      await storageRequest(`/object/remove/${PRO_BUCKET}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] })
      });
      proofUrlCache.delete(path);
    } catch (error) { console.warn('Tidak dapat menghapus file bukti lama:', error.message); }
  }

  function validateProof(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Bukti harus berupa gambar JPG atau PNG.');
    if (file.size > MAX_PROOF_BYTES) throw new Error('Ukuran bukti maksimal 2 MB.');
  }

  function previewProofSelection(type) {
    const input = document.getElementById(`${type}-bukti`);
    const file = input && input.files && input.files[0];
    const preview = document.getElementById(`${type}-bukti-preview`);
    if (!preview) return;
    if (!file) { preview.classList.add('hidden'); return; }
    try { validateProof(file); }
    catch (error) { showToast('❌ ' + error.message); input.value = ''; preview.classList.add('hidden'); return; }
    if (localPreviewUrls[type]) URL.revokeObjectURL(localPreviewUrls[type]);
    localPreviewUrls[type] = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${localPreviewUrls[type]}" alt="Pratinjau bukti"><span>${escapeHtml(file.name)} · ${(file.size / 1024).toFixed(0)} KB</span><button type="button" class="btn btn-sm" onclick="clearProofSelection('${type}')">Hapus pilihan</button>`;
    preview.classList.remove('hidden');
    const existing = document.getElementById(`${type}-current-proof`);
    if (existing) existing.classList.add('hidden');
  }

  function clearProofSelection(type) {
    const input = document.getElementById(`${type}-bukti`);
    if (input) input.value = '';
    const preview = document.getElementById(`${type}-bukti-preview`);
    if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
    if (localPreviewUrls[type]) { URL.revokeObjectURL(localPreviewUrls[type]); localPreviewUrls[type] = ''; }
    const current = document.getElementById(`${type}-current-proof`);
    if (current && current.dataset.path) current.classList.remove('hidden');
  }

  function showCurrentProof(type, path) {
    const box = document.getElementById(`${type}-current-proof`);
    if (!box) return;
    if (!path) { box.classList.add('hidden'); box.dataset.path = ''; return; }
    box.dataset.path = path;
    const cached = proofUrlCache.get(path);
    box.innerHTML = cached && cached.expires > Date.now()
      ? `<span>Bukti tersimpan saat ini:</span><button type="button" class="proof-thumb-button" data-proof-url="${escapeHtml(cached.url)}"><img class="proof-thumb" src="${escapeHtml(cached.url)}" alt="Bukti tersimpan"></button>`
      : '<span>Bukti tersimpan saat ini (akan tetap dipertahankan jika tidak diganti).</span>';
    box.classList.remove('hidden');
    box.querySelectorAll('[data-proof-url]').forEach(button => button.addEventListener('click', () => openProofPreview(button.dataset.proofUrl)));
  }

  function openProofPreview(url) {
    const modal = document.getElementById('pro-proof-modal');
    const image = document.getElementById('pro-proof-modal-image');
    if (!modal || !image || !url) return;
    image.src = url;
    modal.classList.remove('hidden');
    document.body.classList.add('proof-modal-open');
  }

  function closeProofPreview(event) {
    if (event && event.target && event.target.id === 'pro-proof-modal-image') return;
    const modal = document.getElementById('pro-proof-modal');
    const image = document.getElementById('pro-proof-modal-image');
    if (modal) modal.classList.add('hidden');
    if (image) image.src = '';
    document.body.classList.remove('proof-modal-open');
  }

  window.previewProofSelection = previewProofSelection;
  window.clearProofSelection = clearProofSelection;
  window.openProofPreview = openProofPreview;
  window.closeProofPreview = closeProofPreview;

  function migrationHelp(error) {
    const message = safeText(error && error.message).toLowerCase();
    return message.includes('bukti_path') || message.includes(PRO_BUCKET) || message.includes('bucket') || message.includes('schema cache') || message.includes('column')
      ? 'Fitur bukti perlu migrasi Supabase. Jalankan supabase/pro_upgrade.sql di SQL Editor, lalu coba lagi.'
      : '';
  }

  async function finishFormSave(type, uploadedPath, oldPath) {
    const formId = type === 'kos' ? 'form-kos' : 'form-token';
    document.getElementById(formId).reset();
    clearProofSelection(type);
    const current = document.getElementById(`${type}-current-proof`);
    if (current) { current.classList.add('hidden'); current.dataset.path = ''; }
    if (type === 'kos') {
      document.getElementById('kos-jumlah').value = KOS_PER_BULAN;
      document.getElementById('kos-tanggal').value = new Date().toISOString().slice(0, 10);
      setKosSubmitMode(false);
    } else {
      document.getElementById('token-tanggal').value = new Date().toISOString().slice(0, 10);
      setTokenSubmitMode(false);
    }
    if (oldPath && uploadedPath && oldPath !== uploadedPath) await removeProof(oldPath);
    await loadData(false);
    navigate(type === 'kos' ? '/kos' : '/token');
  }

  async function submitKosPro(event) {
    event.preventDefault();
    const nama = document.getElementById('kos-nama').value.trim();
    const kamar = parseInt(document.getElementById('kos-kamar').value, 10);
    const bulan = document.getElementById('kos-bulan').value;
    const jumlah = parseInt(document.getElementById('kos-jumlah').value, 10);
    const tanggal = document.getElementById('kos-tanggal').value;
    const file = document.getElementById('kos-bukti').files[0];
    if (!nama || !kamar || !bulan || !jumlah || !tanggal) { showToast('❌ Semua field wajib diisi!'); return false; }
    try { validateProof(file); } catch (error) { showToast('❌ ' + error.message); return false; }
    let newPath = null;
    const isEditing = editingEntry && editingEntry.type === 'kos';
    const oldEntry = isEditing ? data.kos_entries.find(entry => String(entry.id) === String(editingEntry.id)) : null;
    const oldPath = oldEntry && oldEntry.bukti_path;
    try {
      if (file) newPath = await uploadProof('kos', file);
      const payload = { nama, kamar, bulan, jumlah, tanggal };
      if (newPath) payload.bukti_path = newPath;
      if (userKosId) payload.kos_id = userKosId;
      if (isEditing) {
        await api('/kos_entries?id=eq.' + encodeURIComponent(editingEntry.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
        editingEntry = null;
        showToast('✅ Data pembayaran kos diperbarui.');
      } else {
        if (newPath) payload.periode = getCurrentPeriode();
        await api('/kos_entries', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...payload, periode: getCurrentPeriode() }) });
        showToast(`✅ Pembayaran ${formatRupiah(jumlah)} dari ${nama} tersimpan.`);
      }
      await finishFormSave('kos', newPath, oldPath);
    } catch (error) {
      if (newPath) await removeProof(newPath);
      console.error(error);
      showToast('❌ ' + (migrationHelp(error) || 'Gagal menyimpan pembayaran kos. Periksa izin database dan coba lagi.'));
    }
    return false;
  }

  async function submitTokenPro(event) {
    event.preventDefault();
    const nama = document.getElementById('token-nama').value.trim();
    const kamar = parseInt(document.getElementById('token-kamar').value, 10);
    const jumlah = parseInt(document.getElementById('token-jumlah').value, 10);
    const tanggal = document.getElementById('token-tanggal').value;
    const file = document.getElementById('token-bukti').files[0];
    if (!nama || !kamar || !jumlah || !tanggal) { showToast('❌ Semua field wajib diisi!'); return false; }
    try { validateProof(file); } catch (error) { showToast('❌ ' + error.message); return false; }
    let newPath = null;
    const isEditing = editingEntry && editingEntry.type === 'token';
    const oldEntry = isEditing ? data.token_entries.find(entry => String(entry.id) === String(editingEntry.id)) : null;
    const oldPath = oldEntry && oldEntry.bukti_path;
    try {
      if (file) newPath = await uploadProof('token', file);
      const payload = { nama, kamar, jumlah, tanggal };
      if (newPath) payload.bukti_path = newPath;
      if (userKosId) payload.kos_id = userKosId;
      if (isEditing) {
        await api('/token_entries?id=eq.' + encodeURIComponent(editingEntry.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
        editingEntry = null;
        showToast('✅ Data token diperbarui.');
      } else {
        await api('/token_entries', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...payload, nomor_token: NOMOR_TOKEN_LISTRIK, periode: getCurrentPeriode() }) });
        showToast(`✅ Isi token ${formatRupiah(jumlah)} dari ${nama} tersimpan.`);
      }
      await finishFormSave('token', newPath, oldPath);
    } catch (error) {
      if (newPath) await removeProof(newPath);
      console.error(error);
      showToast('❌ ' + (migrationHelp(error) || 'Gagal menyimpan data token. Periksa izin database dan coba lagi.'));
    }
    return false;
  }

  window.submitKos = submitKosPro;
  window.submitToken = submitTokenPro;

  function proLoadData(showMessage) {
    if (syncing) return Promise.resolve();
    syncing = true;
    return Promise.all([
      api('/kos_entries?select=*&order=tanggal.desc,created_at.desc'),
      api('/token_entries?select=*&order=tanggal.desc,created_at.desc')
    ]).then(async ([kos, token]) => {
      const next = { kos_entries: Array.isArray(kos) ? kos : [], token_entries: Array.isArray(token) ? token : [], periode: getCurrentPeriode() };
      const fingerprint = JSON.stringify([next.kos_entries, next.token_entries, next.periode]);
      data = next;
      await hydrateProofUrls(next);
      if (fingerprint !== lastDataFingerprint) {
        lastDataFingerprint = fingerprint;
        proRenderAll();
      }
      if (showMessage) showToast('☁️ Data berhasil disinkronkan.');
    }).catch(error => {
      console.error(error);
      showToast('❌ Gagal memuat data online. Periksa koneksi Supabase.');
    }).finally(() => { syncing = false; });
  }

  window.loadData = proLoadData;
  window.renderKosStats = renderKosStats;
  window.renderKosKamar = renderKosKamar;
  window.renderKosRiwayat = renderKosRiwayat;
  window.renderTokenStats = renderTokenStats;
  window.renderTokenKamar = renderTokenKamar;
  window.renderTokenRiwayat = renderTokenRiwayat;
  window.renderAll = proRenderAll;

  function currentKosReportRows() {
    return buildKosDisplayRows().filter(entry => cycleKey(entry, 'kos') === currentCycleKey());
  }
  function currentTokenReportRows() {
    return buildTokenDisplayRows().filter(entry => cycleKey(entry, 'token') === currentCycleKey());
  }
  function totalOf(rows) { return rows.reduce((sum, row) => sum + Number(row.jumlah || 0), 0); }

  function exportWhatsAppFullPro() {
    const kosRows = currentKosReportRows();
    const tokenRows = entriesForCycle('token', currentCycleKey());
    const kosSummary = currentKosRoomSummary();
    const tokenSummary = currentTokenRoomSummary();
    let text = `*BUKUKOSONLINE — LAPORAN BULANAN*\nPeriode: ${currentPeriodLabel()}\n\n*PEMBAYARAN KOS*\nTerkumpul: ${formatRupiah(totalOf(entriesForCycle('kos', currentCycleKey())))}\n`;
    for (let room = 1; room <= JUMLAH_KAMAR; room++) text += `Pintu ${room}: ${kosSummary[room].paid ? '✅ Lunas' : '🔴 Belum lunas — ' + formatRupiah(Math.max(0, KOS_PER_BULAN - kosSummary[room].total))}\n`;
    text += `\n*TOKEN LISTRIK*\nNomor token: ${NOMOR_TOKEN_LISTRIK}\nTotal: ${formatRupiah(totalOf(tokenRows))}\n`;
    for (let room = 1; room <= JUMLAH_KAMAR; room++) text += `Pintu ${room}: ${tokenSummary[room].paid ? '✅ Sudah isi' : 'Belum isi'}\n`;
    text += '\n*Rekening BRI: 794101019781531 — a.n. Kakak Keli*';
    showExportText(text);
  }

  function exportWhatsAppKosPro() {
    const summary = currentKosRoomSummary();
    let text = `*BUKUKOSONLINE — REKAP KOS*\nPeriode: ${currentPeriodLabel()}\nTerkumpul: ${formatRupiah(Object.values(summary).reduce((sum, room) => sum + room.total, 0))}\n\n`;
    for (let room = 1; room <= JUMLAH_KAMAR; room++) text += `Pintu ${room}: ${summary[room].paid ? '✅ Lunas' : 'Belum — ' + formatRupiah(Math.max(0, KOS_PER_BULAN - summary[room].total))}\n`;
    text += '\nTransfer ke BRI 794101019781531 — a.n. Kakak Keli';
    showExportText(text);
  }

  function exportWhatsAppTokenPro() {
    const summary = currentTokenRoomSummary();
    const rows = entriesForCycle('token', currentCycleKey());
    const total = totalOf(rows);
    const kwh = Math.round(total / TARIF_PER_KWH * 10) / 10;
    let text = `*BUKUKOSONLINE — REKAP TOKEN LISTRIK*\nPeriode: ${currentPeriodLabel()}\nNomor token: ${NOMOR_TOKEN_LISTRIK}\nTotal isi: ${formatRupiah(total)} · Estimasi ${kwh} kWh\n\n`;
    for (let room = 1; room <= JUMLAH_KAMAR; room++) text += `Pintu ${room}: ${summary[room].paid ? '✅ Sudah isi' : 'Belum isi'}\n`;
    showExportText(text);
  }

  function showExportText(text) {
    document.getElementById('export-text').textContent = text;
    document.getElementById('export-area').classList.remove('hidden');
  }

  window.exportWhatsAppFull = exportWhatsAppFullPro;
  window.exportWhatsAppKos = exportWhatsAppKosPro;
  window.exportWhatsAppToken = exportWhatsAppTokenPro;

  function addExportButtons() {
    const area = document.getElementById('export-area');
    const actions = area && area.closest('.card') && area.closest('.card').querySelector('.actions');
    if (!actions || actions.querySelector('#download-excel')) return;
    const excel = document.createElement('button');
    excel.type = 'button'; excel.id = 'download-excel'; excel.className = 'btn btn-primary btn-sm'; excel.textContent = 'Download Excel (.xlsx)';
    excel.addEventListener('click', downloadExcelReport);
    const pdf = document.createElement('button');
    pdf.type = 'button'; pdf.id = 'download-pdf'; pdf.className = 'btn btn-outline-primary btn-sm'; pdf.textContent = 'Download PDF Laporan';
    pdf.addEventListener('click', downloadPdfReport);
    actions.append(excel, pdf);
  }

  function xmlEscape(value) {
    return safeText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function excelColumn(index) {
    let n = index + 1; let result = '';
    while (n) { const rem = (n - 1) % 26; result = String.fromCharCode(65 + rem) + result; n = Math.floor((n - 1) / 26); }
    return result;
  }

  function sheetXml(rows, widths) {
    const xmlRows = rows.map((row, rowIndex) => {
      const cells = row.map((value, colIndex) => {
        if (value == null || value === '') return '';
        const ref = `${excelColumn(colIndex)}${rowIndex + 1}`;
        const style = rowIndex === 0 ? ' s="1"' : (rowIndex === 3 ? ' s="2"' : '');
        if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
        return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');
    const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${xmlRows}</sheetData></worksheet>`;
  }

  function workbookFiles() {
    const kos = currentKosReportRows();
    const token = currentTokenReportRows();
    const kosTotal = totalOf(entriesForCycle('kos', currentCycleKey()));
    const tokenTotal = totalOf(entriesForCycle('token', currentCycleKey()));
    const summaryRows = [
      ['BukuKosOnline'], ['Laporan Bulanan', currentPeriodLabel()], [],
      ['Ringkasan', 'Nilai'],
      ['Pembayaran kos terkumpul', kosTotal], ['Pintu lunas', Object.values(currentKosRoomSummary()).filter(room => room.paid).length],
      ['Pintu belum lunas', JUMLAH_KAMAR - Object.values(currentKosRoomSummary()).filter(room => room.paid).length],
      ['Pengisian token terkumpul', tokenTotal], ['Estimasi token', `${Math.round(tokenTotal / TARIF_PER_KWH * 10) / 10} kWh`]
    ];
    const kosRows = [['BukuKosOnline'], [`Laporan pembayaran kos — ${currentPeriodLabel()}`], [], ['Tanggal', 'Nama Penghuni', 'Pintu', 'Bulan', 'Jumlah (Rp)', 'Status']];
    kos.forEach(row => kosRows.push([dateLabel(row.tanggal), row.nama, `Pintu ${row.kamar}`, kosMonthValue(row), Number(row._virtual ? row._status.remaining : row.jumlah || 0), row._status.paid ? 'Lunas' : 'Belum Lunas']));
    const tokenRows = [['BukuKosOnline'], [`Laporan token listrik — ${currentPeriodLabel()}`], [], ['Tanggal', 'Nama Penghuni', 'Pintu', 'Periode', 'Jumlah (Rp)', 'Status']];
    token.forEach(row => tokenRows.push([dateLabel(row.tanggal), row.nama, `Pintu ${row.kamar}`, tokenMonthValue(row), Number(row.jumlah || 0), row._paid ? 'Lunas' : 'Belum']));
    return { summaryRows, kosRows, tokenRows };
  }

  function downloadExcelReport() {
    try {
      if (!window.fflate || typeof window.fflate.zipSync !== 'function') throw new Error('Library XLSX belum termuat');
      const report = workbookFiles();
      const sheetNames = ['Ringkasan', 'Pembayaran Kos', 'Token Listrik'];
      const sheets = [report.summaryRows, report.kosRows, report.tokenRows];
      const sheetOverrides = sheetNames.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
      const rels = sheetNames.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
      const workbookSheets = sheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
      const files = {
        '[Content_Types].xml': window.fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`),
        '_rels/.rels': window.fflate.strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
        'xl/workbook.xml': window.fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
        'xl/_rels/workbook.xml.rels': window.fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
        'xl/styles.xml': window.fflate.strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF1E40AF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E40AF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFBFDBFE"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1" xfId="0"/><xf numFmtId="0" fontId="2" fillId="0" borderId="1" applyFont="1" applyBorder="1" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
        'xl/worksheets/sheet1.xml': window.fflate.strToU8(sheetXml(report.summaryRows, [34, 26])),
        'xl/worksheets/sheet2.xml': window.fflate.strToU8(sheetXml(report.kosRows, [18, 28, 14, 18, 18, 18])),
        'xl/worksheets/sheet3.xml': window.fflate.strToU8(sheetXml(report.tokenRows, [18, 28, 14, 22, 18, 18]))
      };
      const bytes = window.fflate.zipSync(files, { level: 6 });
      downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `BukuKosOnline-${slugPeriod()}.xlsx`);
      showToast('✅ Laporan Excel berhasil diunduh.');
    } catch (error) { console.error(error); showToast('❌ Gagal membuat Excel: ' + error.message); }
  }

  function slugPeriod() { return safeText(currentPeriodLabel()).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.style.display = 'none';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function pdfDrawHeader(doc, subtitle, pageNo) {
    const width = doc.internal.pageSize.getWidth();
    doc.setFillColor(30, 64, 175); doc.rect(0, 0, width, 26, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('BukuKosOnline', 14, 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(subtitle, 14, 20);
    doc.setFontSize(8); doc.text(`Halaman ${pageNo}`, width - 14, 20, { align: 'right' });
    doc.setTextColor(30, 41, 59);
  }

  function pdfDrawTable(doc, title, headers, rows, yStart, state) {
    const width = doc.internal.pageSize.getWidth();
    const left = 14; const usable = width - 28;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 64, 175); doc.text(title, left, yStart);
    let y = yStart + 5;
    const colWidths = headers.map((_, index) => index === 1 ? usable * 0.28 : usable * 0.12);
    const adjust = usable - colWidths.reduce((sum, val) => sum + val, 0);
    colWidths[0] += adjust;
    function newPage() {
      doc.addPage(); state.page += 1; pdfDrawHeader(doc, `Laporan ${currentPeriodLabel()}`, state.page); y = 38;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 64, 175); doc.text(title + ' (lanjutan)', left, y); y += 5;
    }
    const rowHeight = 8;
    doc.setFillColor(219, 234, 254); doc.rect(left, y, usable, rowHeight, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(30, 64, 175);
    let x = left;
    headers.forEach((header, index) => { doc.text(String(header), x + 1.5, y + 5.3, { maxWidth: colWidths[index] - 3 }); x += colWidths[index]; });
    y += rowHeight;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(30, 41, 59);
    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > doc.internal.pageSize.getHeight() - 14) newPage();
      if (rowIndex % 2 === 1) { doc.setFillColor(247, 250, 255); doc.rect(left, y, usable, rowHeight, 'F'); }
      x = left;
      row.forEach((value, index) => { doc.text(String(value == null ? '' : value).slice(0, 52), x + 1.5, y + 5.3, { maxWidth: colWidths[index] - 3 }); x += colWidths[index]; });
      y += rowHeight;
    });
    doc.setDrawColor(219, 234, 254); doc.line(left, y, left + usable, y);
    return y + 11;
  }

  function downloadPdfReport() {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('Library PDF belum termuat');
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const state = { page: 1 };
      pdfDrawHeader(doc, `Laporan pembayaran kos dan token listrik · ${currentPeriodLabel()}`, state.page);
      const kosRows = currentKosReportRows().map(row => [dateLabel(row.tanggal), row.nama, `Pintu ${row.kamar}`, kosMonthValue(row), formatRupiah(row._virtual ? row._status.remaining : row.jumlah), row._status.paid ? 'Lunas' : 'Belum lunas']);
      const tokenRows = currentTokenReportRows().map(row => [dateLabel(row.tanggal), row.nama, `Pintu ${row.kamar}`, tokenMonthValue(row), formatRupiah(row.jumlah), row._paid ? 'Lunas' : 'Belum']);
      let y = pdfDrawTable(doc, 'Pembayaran Kos', ['Tanggal', 'Nama Penghuni', 'Pintu', 'Bulan', 'Jumlah', 'Status'], kosRows, 36, state);
      if (y > doc.internal.pageSize.getHeight() - 55) {
        doc.addPage(); state.page += 1;
        pdfDrawHeader(doc, `Laporan ${currentPeriodLabel()}`, state.page);
        y = 38;
      }
      pdfDrawTable(doc, 'Token Listrik', ['Tanggal', 'Nama Penghuni', 'Pintu', 'Periode', 'Jumlah', 'Status'], tokenRows, y, state);
      doc.setProperties({ title: `Laporan BukuKosOnline ${currentPeriodLabel()}`, subject: 'Laporan pembayaran kos dan token listrik' });
      doc.save(`BukuKosOnline-${slugPeriod()}.pdf`);
      showToast('✅ Laporan PDF berhasil diunduh.');
    } catch (error) { console.error(error); showToast('❌ Gagal membuat PDF: ' + error.message); }
  }

  function installGlobalWrappers() {
    window.copyRek = async function () {
      const number = '7941 0101 9781 531';
      try { await navigator.clipboard.writeText(number); showToast('Nomor berhasil disalin'); }
      catch (_) { showToast('Nomor rekening: ' + number); }
    };
    window.copyTokenNumber = async function () {
      try { await navigator.clipboard.writeText(NOMOR_TOKEN_LISTRIK); showToast('Nomor token berhasil disalin'); }
      catch (_) { showToast('Nomor token: ' + NOMOR_TOKEN_LISTRIK); }
    };

    const originalStartCreate = window.startCreate;
    if (typeof originalStartCreate === 'function') {
      window.startCreate = function (type) {
        originalStartCreate(type);
        clearProofSelection(type);
        const current = document.getElementById(`${type}-current-proof`);
        if (current) { current.classList.add('hidden'); current.dataset.path = ''; }
      };
    }
    const originalPrepareKosEditor = window.prepareKosEditor;
    if (typeof originalPrepareKosEditor === 'function') {
      window.prepareKosEditor = function (entry) { originalPrepareKosEditor(entry); showCurrentProof('kos', entry && entry.bukti_path); };
    }
    const originalPrepareTokenEditor = window.prepareTokenEditor;
    if (typeof originalPrepareTokenEditor === 'function') {
      window.prepareTokenEditor = function (entry) { originalPrepareTokenEditor(entry); showCurrentProof('token', entry && entry.bukti_path); };
    }
    const originalConfirmDelete = window.confirmDelete;
    if (typeof originalConfirmDelete === 'function') {
      window.confirmDelete = async function () {
        const target = window.deleteTarget || (typeof deleteTarget !== 'undefined' ? deleteTarget : null);
        if (!target) return originalConfirmDelete();
        const source = target.type === 'kos' ? data.kos_entries : data.token_entries;
        const entry = source.find(item => String(item.id) === String(target.id));
        const proofPath = entry && entry.bukti_path;
        await originalConfirmDelete();
        const updated = target.type === 'kos' ? data.kos_entries : data.token_entries;
        if (proofPath && !updated.some(item => String(item.id) === String(target.id))) await removeProof(proofPath);
      };
    }
  }

  function installProofModal() {
    if (document.getElementById('pro-proof-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'pro-proof-modal';
    modal.className = 'proof-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Pratinjau bukti transfer');
    modal.innerHTML = '<button type="button" class="proof-modal-close" aria-label="Tutup pratinjau">Tutup</button><img id="pro-proof-modal-image" alt="Pratinjau bukti transfer">';
    modal.addEventListener('click', event => { if (event.target === modal || event.target.classList.contains('proof-modal-close')) closeProofPreview(event); });
    document.body.appendChild(modal);
    modal.querySelector('.proof-modal-close').addEventListener('click', closeProofPreview);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeProofPreview(); });
  }

  function installUploadControls() {
    ['kos', 'token'].forEach(type => {
      const input = document.getElementById(`${type}-bukti`);
      if (input) input.addEventListener('change', () => previewProofSelection(type));
    });
  }

  function initProUi() {
    installGlobalWrappers();
    installProofModal();
    installUploadControls();
    addExportButtons();
    ensureDashboardCharts();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof sessionToken !== 'undefined' && sessionToken) window.loadData(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProUi, { once: true });
  else initProUi();
})();
