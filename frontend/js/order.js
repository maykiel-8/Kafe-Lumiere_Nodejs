/* Orders listing (DataTables), detail view, status update, payment processing */

let ordersTable;
const isStaff = () => Auth.hasRole('admin', 'cashier');

function initOrders() {
  if (!requireAuth()) return;
  if (isStaff()) $('#ordersTitle').text('Orders');

  ordersTable = $('#ordersTable').DataTable({
    serverSide: false,
    ajax: async function (data, callback) {
      try {
        const params = new URLSearchParams({ limit: 1000 });
        const status = $('#statusFilter').val();
        const search = $('#orderSearch').val().trim();
        if (status) params.set('status', status);
        if (search) params.set('search', search);
        const res = await api('/orders?' + params.toString());
        callback({ data: res.data });
      } catch (err) { toast(err.message, 'error'); callback({ data: [] }); }
    },
    columns: [
      { data: 'orderNumber' },
      { data: null, render: (r) => r.customer ? r.customer.name : '<span class="muted">Walk-in</span>' },
      { data: null, render: (r) => (r.items || []).length + ' item(s)' },
      { data: 'total', render: (t) => peso(t) },
      { data: 'status', render: (s) => `<span class="badge ${s}">${s}</span>` },
      { data: 'createdAt', render: (d) => fmtDate(d) },
      {
        data: null, orderable: false, render: function (r) {
          let btns = `<button class="btn btn-sm btn-outline" onclick="viewOrder(${r.id})">View</button>`;
          btns += ` <a class="btn btn-sm btn-ghost" href="/api/orders/${r.id}/receipt?_t=${Auth.token}" onclick="return openReceipt(event, ${r.id})">Receipt</a>`;
          if (isStaff()) {
            const paid = r.status === 'completed';
            if (!paid) btns += ` <button class="btn btn-sm btn-success" onclick='openPay(${JSON.stringify({ id: r.id, orderNumber: r.orderNumber, total: r.total }).replace(/'/g, "&#39;")})'>Pay</button>`;
          }
          return btns;
        }
      },
    ],
    order: [[5, 'desc']],
    pageLength: 10,
  });

  let t;
  $('#orderSearch').on('input', function () { clearTimeout(t); t = setTimeout(() => ordersTable.ajax.reload(), 300); });
  $('#statusFilter').on('change', () => ordersTable.ajax.reload());

  $('#payCash').on('input', updateChange);
  $('#payConfirm').on('click', confirmPay);
}

// Receipts require an auth header, so fetch as blob and open
async function openReceipt(ev, id) {
  ev.preventDefault();
  try {
    const res = await api('/orders/' + id + '/receipt', { raw: true });
    if (!res.ok) throw new Error('Could not load receipt');
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  } catch (err) { toast(err.message, 'error'); }
  return false;
}

async function viewOrder(id) {
  try {
    const { order } = await api('/orders/' + id);
    $('#omTitle').text('Order ' + order.orderNumber);
    const rows = (order.items || []).map((it) => {
      const addons = it.addonsJson ? JSON.parse(it.addonsJson) : [];
      return `<tr><td>${it.quantity}x ${it.itemName}<div class="muted" style="font-size:.78rem">${it.sizeName} · Sugar ${it.sugarLevel} · Ice ${it.iceLevel}${addons.length ? ' · ' + addons.map(a => a.name).join(', ') : ''}</div></td><td class="right">${peso(it.lineTotal)}</td></tr>`;
    }).join('');
    let statusControl = '';
    if (isStaff()) {
      const opts = ['pending', 'preparing', 'ready', 'completed', 'cancelled']
        .map((s) => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('');
      statusControl = `<div class="form-group mt"><label>Update status</label>
        <div class="flex gap"><select id="omStatus" style="flex:1">${opts}</select>
        <button class="btn btn-primary" onclick="saveStatus(${order.id})">Save</button></div></div>`;
    }
    $('#omBody').html(`
      <div class="flex between wrap">
        <div><span class="badge ${order.status}">${order.status}</span></div>
        <div class="muted">${fmtDate(order.createdAt)}</div>
      </div>
      <p class="muted">Customer: ${order.customer ? order.customer.name : 'Walk-in'}${order.cashier ? ' · Cashier: ' + order.cashier.name : ''}</p>
      <table class="simple">${rows}</table>
      <div class="flex between mt"><strong>Total</strong><strong style="color:var(--gold)">${peso(order.total)}</strong></div>
      ${statusControl}
      <button class="btn btn-ghost mt" onclick="openReceipt(event, ${order.id})">View Receipt (PDF)</button>
    `);
    openModal('orderModal');
  } catch (err) { toast(err.message, 'error'); }
}

async function saveStatus(id) {
  try {
    await api('/orders/' + id + '/status', { method: 'PATCH', body: { status: $('#omStatus').val() } });
    toast('Status updated', 'success');
    closeModal('orderModal');
    ordersTable.ajax.reload();
  } catch (err) { toast(err.message, 'error'); }
}

function openPay(order) {
  $('#payOrderId').val(order.id);
  $('#payOrderInfo').text('Order ' + order.orderNumber);
  $('#payDue').val(peso(order.total));
  $('#payDue').data('amount', Number(order.total));
  $('#payCash').val('');
  $('#payChange').text(peso(0));
  openModal('payModal');
}

function updateChange() {
  const due = $('#payDue').data('amount') || 0;
  const cash = Number($('#payCash').val()) || 0;
  $('#payChange').text(peso(Math.max(0, cash - due)));
}

async function confirmPay() {
  const due = $('#payDue').data('amount') || 0;
  const cash = Number($('#payCash').val()) || 0;
  if (cash < due) { toast('Insufficient cash', 'error'); return; }
  const btn = $('#payConfirm').prop('disabled', true).text('Processing...');
  try {
    const data = await api('/transactions/pay', { method: 'POST', body: { orderId: Number($('#payOrderId').val()), amountPaid: cash } });
    toast('Payment recorded. Change: ' + peso(data.change) + '. Receipt emailed.', 'success');
    closeModal('payModal');
    ordersTable.ajax.reload();
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.prop('disabled', false).text('Confirm Payment'); }
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
