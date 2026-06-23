/* Cart + checkout (place order) */

function initCart() {
  if (!requireAuth()) return;
  renderCart();
  if (Auth.hasRole('admin', 'cashier')) {
    $('#cashierFields').removeClass('hidden');
    bindCustomerSearch();
  }
  $('#checkoutBtn').on('click', checkout);
  $('#clearBtn').on('click', () => { Cart.clear(); renderCart(); });
}

function renderCart() {
  const items = Cart.items;
  const box = $('#cartItems');
  if (!items.length) {
    box.html('<div class="empty"><div class="ico">\u{1F6D2}</div><p>Your cart is empty.</p><a class="btn btn-primary" href="home.html">Browse menu</a></div>');
    $('#checkoutBtn').prop('disabled', true);
  } else {
    box.empty();
    items.forEach((l, i) => {
      const addons = (l.addons || []).map((a) => a.name).join(', ');
      box.append(`
        <div class="cart-line">
          <div class="thumb" style="width:54px;height:54px;border-radius:12px;background:linear-gradient(135deg,var(--purple-300),var(--purple-100));display:grid;place-items:center;font-size:1.6rem">\u{1F9CB}</div>
          <div class="meta">
            <div><strong>${l.itemName}</strong> <span class="muted">x${l.quantity}</span></div>
            <div class="muted" style="font-size:.82rem">${l.sizeName} · Sugar ${l.sugarLevel} · Ice ${l.iceLevel}${addons ? ' · ' + addons : ''}</div>
          </div>
          <div class="right"><div style="color:var(--gold);font-weight:700">${peso(l.lineTotal)}</div>
            <button class="btn btn-sm btn-ghost" onclick="removeLine(${i})">Remove</button></div>
        </div>`);
    });
    $('#checkoutBtn').prop('disabled', false);
  }
  $('#sumCount').text(Cart.count);
  $('#sumTotal').text(peso(Cart.total));
}

function removeLine(i) { Cart.removeAt(i); renderCart(); }

async function checkout() {
  const items = Cart.items;
  if (!items.length) return;
  const btn = $('#checkoutBtn').prop('disabled', true).text('Placing...');
  try {
    const body = {
      items: items.map((l) => ({
        itemId: l.itemId,
        sizeName: l.sizeName,
        sugarLevel: l.sugarLevel,
        iceLevel: l.iceLevel,
        quantity: l.quantity,
        addonIds: l.addonIds || [],
      })),
    };
    if (Auth.hasRole('admin', 'cashier') && $('#custId').val()) body.customerId = Number($('#custId').val());
    const data = await api('/orders', { method: 'POST', body });
    Cart.clear();
    toast('Order placed: ' + data.order.orderNumber, 'success');
    setTimeout(() => (location.href = 'orders.html'), 800);
  } catch (err) {
    toast(err.message, 'error');
    btn.prop('disabled', false).text('Place Order');
  }
}

/* Cashier: customer autocomplete */
function bindCustomerSearch() {
  let timer;
  $('#custSearch').on('input', function () {
    const q = this.value.trim();
    clearTimeout(timer);
    if (!q) { $('#custAc').hide(); $('#custId').val(''); $('#custLabel').text(''); return; }
    timer = setTimeout(async () => {
      try {
        const { data } = await api('/users/autocomplete?q=' + encodeURIComponent(q));
        const box = $('#custAc').empty();
        if (!data.length) { box.hide(); return; }
        data.forEach((u) => box.append(`<div class="ac-item" data-id="${u.id}"><span>${u.name}</span><span class="muted">${u.email}</span></div>`));
        box.find('.ac-item').on('click', function () {
          $('#custId').val($(this).data('id'));
          $('#custSearch').val($(this).find('span').first().text());
          $('#custLabel').text('Customer selected');
          box.hide();
        });
        box.show();
      } catch (e) {}
    }, 280);
  });
}
