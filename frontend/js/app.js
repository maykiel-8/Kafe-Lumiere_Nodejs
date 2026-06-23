/* Kafé Lumière - shared frontend helpers (API client, auth, header, toast, cart) */
const API = '/api';

const Auth = {
  get token() { return localStorage.getItem('kl_token'); },
  get user() {
    try { return JSON.parse(localStorage.getItem('kl_user') || 'null'); }
    catch (e) { return null; }
  },
  set(token, user) {
    localStorage.setItem('kl_token', token);
    localStorage.setItem('kl_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('kl_token');
    localStorage.removeItem('kl_user');
  },
  get isLoggedIn() { return !!this.token; },
  hasRole(...roles) { return this.user && roles.includes(this.user.role); },
};

// Generic API request helper
async function api(path, { method = 'GET', body, isForm = false, raw = false } = {}) {
  const headers = {};
  if (Auth.token) headers['Authorization'] = 'Bearer ' + Auth.token;
  let payload;
  if (body !== undefined) {
    if (isForm) { payload = body; }
    else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  }
  const res = await fetch(API + path, { method, headers, body: payload });
  if (raw) return res;
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const msg = (data && data.message) || 'Request failed (' + res.status + ')';
    if (res.status === 401 && Auth.isLoggedIn) {
      Auth.clear();
      toast(msg + ' - please log in again', 'error');
      setTimeout(() => (location.href = 'login.html'), 1200);
    }
    throw new Error(msg);
  }
  return data;
}

function toast(message, type = '') {
  let box = document.getElementById('toast');
  if (!box) { box = document.createElement('div'); box.id = 'toast'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3200);
}

function peso(n) { return '\u20b1' + Number(n || 0).toFixed(2); }
function fmtDate(d) { return new Date(d).toLocaleString(); }

function requireAuth(roles) {
  if (!Auth.isLoggedIn) { location.href = 'login.html'; return false; }
  if (roles && roles.length && !Auth.hasRole(...roles)) {
    document.body.innerHTML = '<div class="container"><div class="card empty"><div class="ico">\u26d4</div><h2>Access denied</h2><p class="muted">You do not have permission to view this page.</p><a class="btn btn-primary" href="home.html">Back to menu</a></div></div>';
    return false;
  }
  return true;
}

// ---- Shared cart (localStorage) ----
const Cart = {
  get items() {
    try { return JSON.parse(localStorage.getItem('kl_cart') || '[]'); }
    catch (e) { return []; }
  },
  save(items) { localStorage.setItem('kl_cart', JSON.stringify(items)); updateCartBadge(); },
  add(line) { const items = this.items; items.push(line); this.save(items); },
  removeAt(i) { const items = this.items; items.splice(i, 1); this.save(items); },
  clear() { localStorage.removeItem('kl_cart'); updateCartBadge(); },
  get count() { return this.items.reduce((s, l) => s + l.quantity, 0); },
  get total() { return this.items.reduce((s, l) => s + l.lineTotal, 0); },
};

function updateCartBadge() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = Cart.count;
}

// Inject the shared navbar into #header
function renderHeader(active) {
  const u = Auth.user;
  const links = [];
  links.push(`<a href="home.html" data-nav="home">Menu</a>`);
  if (Auth.isLoggedIn) {
    links.push(`<a href="cart.html" data-nav="cart">Cart (<span id="cartCount">0</span>)</a>`);
    links.push(`<a href="orders.html" data-nav="orders">My Orders</a>`);
    if (Auth.hasRole('admin', 'cashier')) {
      links.push(`<a href="dashboard.html" data-nav="dashboard">Dashboard</a>`);
      links.push(`<a href="item.html" data-nav="item">Products</a>`);
    }
    if (Auth.hasRole('admin')) {
      links.push(`<a href="user.html" data-nav="user">Users</a>`);
    }
    links.push(`<a href="profile.html" data-nav="profile">Profile</a>`);
  }

  const userArea = Auth.isLoggedIn
    ? `<div class="nav-user">
         <span class="pill">${u.name} \u00b7 ${u.role}</span>
         <a href="#" id="logoutBtn" class="btn btn-sm btn-ghost">Logout</a>
       </div>`
    : `<div class="nav-user">
         <a href="login.html" class="btn btn-sm btn-ghost">Login</a>
         <a href="register.html" class="btn btn-sm btn-primary">Sign Up</a>
       </div>`;

  document.getElementById('header').innerHTML = `
    <nav class="navbar">
      <a class="brand" href="home.html">
        <span class="logo">KL</span>
        <span>Kaf\u00e9 Lumi\u00e8re<small>MILK TEA</small></span>
      </a>
      <div class="nav-links">${links.join('')}</div>
      ${userArea}
    </nav>`;

  if (active) {
    const a = document.querySelector(`[data-nav="${active}"]`);
    if (a) a.classList.add('active');
  }
  const lo = document.getElementById('logoutBtn');
  if (lo) lo.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await api('/users/logout', { method: 'POST' }); } catch (_) {}
    Auth.clear(); Cart.clear();
    location.href = 'login.html';
  });
  updateCartBadge();
}

document.addEventListener('DOMContentLoaded', updateCartBadge);
