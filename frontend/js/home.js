/* Home / menu: search + autocomplete (quiz5) + infinite scroll (unit test 2) */

let homeState = { page: 1, limit: 6, totalPages: 1, loading: false, search: '', categoryId: '' };
let sizes = [];
let addons = [];
let cmSelectedAddons = [];

async function initHome() {
  await Promise.all([loadCategories(), loadSizesAddons()]);
  bindSearch();
  bindInfiniteScroll();
  resetAndLoad();

  $('#cmAddBtn').on('click', addCustomizedToCart);
  $('#cmSize, #cmQty').on('change input', updateCmTotal);
}

async function loadCategories() {
  try {
    const { data } = await api('/items/categories');
    const sel = $('#categoryFilter');
    data.forEach((c) => sel.append(`<option value="${c.id}">${c.name}</option>`));
    sel.on('change', function () { homeState.categoryId = this.value; resetAndLoad(); });
  } catch (e) {}
}

async function loadSizesAddons() {
  try {
    const s = await api('/items/sizes'); sizes = s.data;
    const a = await api('/items/addons'); addons = a.data;
  } catch (e) {}
}

function resetAndLoad() {
  homeState.page = 1;
  $('#menuGrid').empty();
  $('#endMsg').addClass('hidden');
  loadMenu();
}

async function loadMenu() {
  if (homeState.loading) return;
  homeState.loading = true;
  $('#loadMore').removeClass('hidden');
  try {
    const params = new URLSearchParams({
      page: homeState.page,
      limit: homeState.limit,
      availableOnly: 'true',
    });
    if (homeState.search) params.set('search', homeState.search);
    if (homeState.categoryId) params.set('categoryId', homeState.categoryId);
    const res = await api('/items?' + params.toString());
    homeState.totalPages = res.totalPages;
    renderItems(res.data);
    if (homeState.page === 1 && res.data.length === 0) {
      $('#menuGrid').html('<div class="empty"><div class="ico">\u{1F9CB}</div><p>No drinks found.</p></div>');
    }
    if (homeState.page >= res.totalPages) $('#endMsg').removeClass('hidden');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    homeState.loading = false;
    $('#loadMore').addClass('hidden');
  }
}

function renderItems(items) {
  const grid = $('#menuGrid');
  items.forEach((it) => {
    const thumb = it.image
      ? `<img src="${it.image}" alt="${it.name}" />`
      : '\u{1F9CB}';
    grid.append(`
      <div class="product">
        <div class="thumb">${thumb}</div>
        <div class="body">
          <div class="flex between center"><span class="name">${it.name}</span>
            <span class="tag">${it.category ? it.category.name : 'Drink'}</span></div>
          <div class="desc">${it.description || ''}</div>
          <div class="flex between center">
            <span class="price">${peso(it.basePrice)}</span>
            <button class="btn btn-sm btn-primary" onclick='openCustomize(${JSON.stringify(it).replace(/'/g, "&#39;")})'>Order</button>
          </div>
        </div>
      </div>`);
  });
}

/* Infinite scroll */
function bindInfiniteScroll() {
  $(window).on('scroll', function () {
    if (homeState.loading || homeState.page >= homeState.totalPages) return;
    if ($(window).scrollTop() + $(window).height() > $(document).height() - 250) {
      homeState.page++;
      loadMenu();
    }
  });
}

/* Search with debounce + autocomplete dropdown */
function bindSearch() {
  let timer;
  $('#searchInput').on('input', function () {
    const q = this.value.trim();
    clearTimeout(timer);
    timer = setTimeout(() => {
      homeState.search = q;
      resetAndLoad();
      showAutocomplete(q);
    }, 280);
  });
  $(document).on('click', (e) => {
    if (!$(e.target).closest('.search-box').length) $('#acBox').hide();
  });
}

async function showAutocomplete(q) {
  const box = $('#acBox');
  if (!q) { box.hide().empty(); return; }
  try {
    const { data } = await api('/items/autocomplete?q=' + encodeURIComponent(q));
    if (!data.length) { box.hide().empty(); return; }
    box.empty();
    data.forEach((it) => {
      box.append(`<div class="ac-item" data-id="${it.id}"><span>${it.name}</span><span class="muted">${peso(it.basePrice)}</span></div>`);
    });
    box.find('.ac-item').on('click', function () {
      $('#searchInput').val($(this).find('span').first().text());
      homeState.search = $(this).find('span').first().text();
      box.hide();
      resetAndLoad();
    });
    box.show();
  } catch (e) { box.hide(); }
}

/* Customize modal */
function openCustomize(item) {
  if (!Auth.isLoggedIn) { toast('Please log in to order', 'error'); setTimeout(() => location.href = 'login.html', 800); return; }
  $('#cmItemId').val(item.id);
  $('#cmTitle').text(item.name);
  $('#cmDesc').text(item.description || '');
  $('#cmItemId').data('base', Number(item.basePrice));
  const sizeSel = $('#cmSize').empty();
  sizes.forEach((s) => sizeSel.append(`<option value="${s.name}" data-mod="${s.priceModifier}">${s.name}${Number(s.priceModifier) ? ' (+' + peso(s.priceModifier) + ')' : ''}</option>`));
  cmSelectedAddons = [];
  const ad = $('#cmAddons').empty();
  addons.forEach((a) => {
    ad.append(`<span class="addon-chip" data-id="${a.id}" data-price="${a.price}" data-name="${a.name}">${a.name} +${peso(a.price)}</span>`);
  });
  ad.find('.addon-chip').on('click', function () {
    $(this).toggleClass('selected');
    const id = $(this).data('id');
    if ($(this).hasClass('selected')) cmSelectedAddons.push({ id, name: $(this).data('name'), price: Number($(this).data('price')) });
    else cmSelectedAddons = cmSelectedAddons.filter((x) => x.id !== id);
    updateCmTotal();
  });
  $('#cmQty').val(1);
  updateCmTotal();
  openModal('customizeModal');
}

function cmQty(delta) {
  const q = Math.max(1, (parseInt($('#cmQty').val()) || 1) + delta);
  $('#cmQty').val(q);
  updateCmTotal();
}

function unitPriceNow() {
  const base = $('#cmItemId').data('base') || 0;
  const mod = Number($('#cmSize option:selected').data('mod')) || 0;
  const addonsTotal = cmSelectedAddons.reduce((s, a) => s + a.price, 0);
  return base + mod + addonsTotal;
}

function updateCmTotal() {
  const qty = Math.max(1, parseInt($('#cmQty').val()) || 1);
  $('#cmTotal').text(peso(unitPriceNow() * qty));
}

function addCustomizedToCart() {
  const qty = Math.max(1, parseInt($('#cmQty').val()) || 1);
  const lineTotal = unitPriceNow() * qty;
  Cart.add({
    itemId: Number($('#cmItemId').val()),
    itemName: $('#cmTitle').text(),
    sizeName: $('#cmSize').val(),
    sugarLevel: $('#cmSugar').val(),
    iceLevel: $('#cmIce').val(),
    quantity: qty,
    addonIds: cmSelectedAddons.map((a) => a.id),
    addons: cmSelectedAddons,
    unitPrice: unitPriceNow(),
    lineTotal,
  });
  closeModal('customizeModal');
  toast('Added to cart', 'success');
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
