/* Dashboard: stat cards, 3 charts (line/bar/pie), reports + export, activity log */

const PURPLE = '#6b4e9e';
const PURPLE_LIGHT = '#b9a6e6';
const GOLD = '#d9b26a';
const PALETTE = ['#6b4e9e', '#8367c7', '#b9a6e6', '#d9b26a', '#4b2e83', '#a78bd0', '#e0c98a'];

async function initDashboard() {
  if (!requireAuth(['admin', 'cashier'])) return;
  $('#todayLabel').text(new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

  await loadOverview();
  await loadCharts();
  if (Auth.hasRole('admin')) loadLogs(); else $('#logsCard').addClass('hidden');

  $('#loadReportBtn').on('click', runReport);
  $('#exportPdfBtn').on('click', () => downloadReport('pdf'));
  $('#exportExcelBtn').on('click', () => downloadReport('excel'));
  runReport();
}

async function loadOverview() {
  try {
    const o = await api('/dashboard/overview');
    const cards = [
      { label: "Today's Revenue", value: peso(o.todayRevenue) },
      { label: "Today's Orders", value: o.todayTransactions },
      { label: 'Month Revenue', value: peso(o.monthRevenue) },
      { label: 'Pending Orders', value: o.pendingOrders },
      { label: 'Products', value: o.totalItems },
      { label: 'Users', value: o.totalUsers },
    ];
    $('#statCards').html(cards.map((c) => `<div class="stat"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`).join(''));
  } catch (err) { toast(err.message, 'error'); }
}

async function loadCharts() {
  try {
    const c = await api('/dashboard/charts');
    $('#lineTitle').text(c.line.title);
    $('#barTitle').text(c.bar.title);
    $('#pieTitle').text(c.pie.title);

    new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: {
        labels: c.line.data.map((d) => d.label),
        datasets: [{
          label: 'Revenue', data: c.line.data.map((d) => d.value),
          borderColor: PURPLE, backgroundColor: 'rgba(107,78,158,.15)',
          fill: true, tension: 0.35, pointBackgroundColor: GOLD,
        }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });

    new Chart(document.getElementById('barChart'), {
      type: 'bar',
      data: {
        labels: c.bar.data.map((d) => d.label),
        datasets: [{ label: 'Qty sold', data: c.bar.data.map((d) => d.value), backgroundColor: PURPLE_LIGHT, borderColor: PURPLE, borderWidth: 1, borderRadius: 6 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });

    new Chart(document.getElementById('pieChart'), {
      type: 'pie',
      data: {
        labels: c.pie.data.map((d) => d.label),
        datasets: [{ data: c.pie.data.map((d) => d.value), backgroundColor: PALETTE }],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });
  } catch (err) { toast(err.message, 'error'); }
}

async function runReport() {
  const period = $('#reportPeriod').val();
  try {
    const r = await api('/dashboard/report/' + period);
    const rows = r.bestSellers.map((b, i) => `<tr><td>${i + 1}</td><td>${b.name}</td><td>${b.qty}</td><td>${peso(b.revenue)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No sales in this period.</td></tr>';
    $('#reportBody').html(`
      <div class="stats" style="margin-bottom:14px">
        <div class="stat"><div class="label">Total Revenue</div><div class="value">${peso(r.totalRevenue)}</div></div>
        <div class="stat"><div class="label">Transactions</div><div class="value">${r.totalTransactions}</div></div>
      </div>
      <table class="simple"><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>${rows}</tbody></table>
    `);
  } catch (err) { toast(err.message, 'error'); }
}

async function downloadReport(format) {
  const period = $('#reportPeriod').val();
  try {
    const res = await api(`/dashboard/report/${period}/${format}`, { raw: true });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales-report-${period}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    toast('Report downloaded', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function loadLogs() {
  try {
    const { data } = await api('/dashboard/logs?limit=15');
    const tb = $('#logsTable tbody').empty();
    if (!data.length) { tb.append('<tr><td colspan="4" class="muted">No activity yet.</td></tr>'); return; }
    data.forEach((l) => tb.append(`<tr><td>${fmtDate(l.createdAt)}</td><td>${l.user ? l.user.name : 'System'}</td><td><span class="tag">${l.action}</span></td><td class="muted">${l.details || ''}</td></tr>`));
  } catch (err) {}
}
