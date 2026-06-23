/* Admin product/category/size/addon management */

let itemsTable;

function initItemAdmin() {
  if (!requireAuth(['admin'])) return;

  // Tabs
  $('.tab').on('click', function () {
    $('.tab').removeClass('active');
    $(this).addClass('active');
    const t = $(this).data('tab');
    ['products', 'categories', 'sizes', 'addons'].forEach((x) => $('#tab-' + x).toggleClass('hidden', x !== t));
  });

  itemsTable = $('#itemsTable').DataTable({
    ajax: async function (data, callback) {
      try { const res = await api('/items?limit=1000'); callback({ data: res.data }); }
      catch (err) { toast(err.message, 'error'); callback({ data: [] }); }
    },
    columns: [
      { data: 'id' },
      { data: 'image', orderable: false, render: (img) => img ? `<img src="${img}" style="width:40px;height:40px;object-fit:cover;border-radius:8px" />` : '\u{1F9CB}' },
      { data: 'name' },
      { data: null, render: (r) => r.category ? r.category.name : '<span class="muted">—</span>' },
      { data: 'basePrice', render: (p) => peso(p) },
      { data: 'available', render: (a, t, row) => `<span class="badge ${a ? 'active' : 'inactive'}" style="cursor:pointer" onclick="toggleAvail(${row.id}, ${!a})">${a ? 'Yes' : 'No'}</span>` },
      { data: null, orderable: false, render: (r) => `<button class="btn btn-sm btn-outline" onclick="editItem(${r.id})">Edit</button> <button class="btn btn-sm btn-ghost" onclick="deleteItem(${r.id})">Delete</button>` },
    ],
    order: [[0, 'desc']],
  });

  loadCategoryOptions();
  loadCatTable(); loadSizeTable(); loadAddonTable();

  $('#newItemBtn').on('click', () => openItemModal());
  $('#addCatBtn').on('click', addCategory);
  $('#addSizeBtn').on('click', addSize);
  $('#addAddonBtn').on('click', addAddon);

  $('#itemForm').validate({
    rules: { name: { required: true }, basePrice: { required: true, number: true, min: 0 } },
    errorElement: 'label',
    submitHandler: saveItem,
  });
}

async function loadCategoryOptions() {
  try {
    const { data } = await api('/items/categories');
    const sel = $('#iCategory').html('<option value="">— None —</option>');
    data.forEach((c) => sel.append(`<option value="${c.id}">${c.name}</option>`));
  } catch (e) {}
}

function openItemModal(item) {
  $('#itemForm')[0].reset();
  $('#iId').val(item ? item.id : '');
  $('#itemModalTitle').text(item ? 'Edit Product' : 'New Product');
  if (item) {
    $('#iName').val(item.name); $('#iDesc').val(item.description || '');
    $('#iPrice').val(item.basePrice); $('#iCategory').val(item.categoryId || '');
    $('#iAvailable').prop('checked', item.available);
  } else { $('#iAvailable').prop('checked', true); }
  openModal('itemModal');
}

async function saveItem() {
  const id = $('#iId').val();
  const fd = new FormData();
  fd.append('name', $('#iName').val());
  fd.append('description', $('#iDesc').val());
  fd.append('basePrice', $('#iPrice').val());
  fd.append('categoryId', $('#iCategory').val());
  fd.append('available', $('#iAvailable').is(':checked'));
  const file = $('#iImage')[0].files[0];
  if (file) fd.append('image', file);
  try {
    if (id) await api('/items/' + id, { method: 'PUT', body: fd, isForm: true });
    else await api('/items', { method: 'POST', body: fd, isForm: true });
    toast('Product saved', 'success');
    closeModal('itemModal');
    itemsTable.ajax.reload();
  } catch (err) { toast(err.message, 'error'); }
}

async function editItem(id) {
  try { const { item } = await api('/items/' + id); openItemModal(item); }
  catch (err) { toast(err.message, 'error'); }
}
async function deleteItem(id) {
  if (!confirm('Delete this product?')) return;
  try { await api('/items/' + id, { method: 'DELETE' }); toast('Deleted', 'success'); itemsTable.ajax.reload(); }
  catch (err) { toast(err.message, 'error'); }
}
async function toggleAvail(id, available) {
  try { await api('/items/' + id + '/availability', { method: 'PATCH', body: { available } }); itemsTable.ajax.reload(); }
  catch (err) { toast(err.message, 'error'); }
}

/* Categories */
async function loadCatTable() {
  try {
    const { data } = await api('/items/categories');
    const tb = $('#catTable tbody').empty();
    data.forEach((c) => tb.append(`<tr><td>${c.id}</td><td>${c.name}</td><td><button class="btn btn-sm btn-ghost" onclick="deleteCat(${c.id})">Delete</button></td></tr>`));
  } catch (e) {}
}
async function addCategory() {
  const name = $('#newCatName').val().trim();
  if (!name) return toast('Enter a category name', 'error');
  try { await api('/items/categories', { method: 'POST', body: { name } }); $('#newCatName').val(''); loadCatTable(); loadCategoryOptions(); toast('Added', 'success'); }
  catch (err) { toast(err.message, 'error'); }
}
async function deleteCat(id) {
  if (!confirm('Delete category?')) return;
  try { await api('/items/categories/' + id, { method: 'DELETE' }); loadCatTable(); loadCategoryOptions(); }
  catch (err) { toast(err.message, 'error'); }
}

/* Sizes */
async function loadSizeTable() {
  try {
    const { data } = await api('/items/sizes');
    const tb = $('#sizeTable tbody').empty();
    data.forEach((s) => tb.append(`<tr><td>${s.id}</td><td>${s.name}</td><td>${peso(s.priceModifier)}</td><td><button class="btn btn-sm btn-ghost" onclick="deleteSize(${s.id})">Delete</button></td></tr>`));
  } catch (e) {}
}
async function addSize() {
  const name = $('#newSizeName').val().trim();
  if (!name) return toast('Enter a size name', 'error');
  try { await api('/items/sizes', { method: 'POST', body: { name, priceModifier: Number($('#newSizeMod').val()) || 0 } }); $('#newSizeName').val(''); $('#newSizeMod').val(''); loadSizeTable(); toast('Added', 'success'); }
  catch (err) { toast(err.message, 'error'); }
}
async function deleteSize(id) {
  if (!confirm('Delete size?')) return;
  try { await api('/items/sizes/' + id, { method: 'DELETE' }); loadSizeTable(); }
  catch (err) { toast(err.message, 'error'); }
}

/* Add-ons */
async function loadAddonTable() {
  try {
    const { data } = await api('/items/addons');
    const tb = $('#addonTable tbody').empty();
    data.forEach((a) => tb.append(`<tr><td>${a.id}</td><td>${a.name}</td><td>${peso(a.price)}</td><td><button class="btn btn-sm btn-ghost" onclick="deleteAddon(${a.id})">Delete</button></td></tr>`));
  } catch (e) {}
}
async function addAddon() {
  const name = $('#newAddonName').val().trim();
  if (!name) return toast('Enter an add-on name', 'error');
  try { await api('/items/addons', { method: 'POST', body: { name, price: Number($('#newAddonPrice').val()) || 0 } }); $('#newAddonName').val(''); $('#newAddonPrice').val(''); loadAddonTable(); toast('Added', 'success'); }
  catch (err) { toast(err.message, 'error'); }
}
async function deleteAddon(id) {
  if (!confirm('Delete add-on?')) return;
  try { await api('/items/addons/' + id, { method: 'DELETE' }); loadAddonTable(); }
  catch (err) { toast(err.message, 'error'); }
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
