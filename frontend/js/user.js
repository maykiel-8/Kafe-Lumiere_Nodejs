/* Auth forms + profile + admin user management */

function initLogin() {
  $('#loginForm').validate({
    rules: {
      email: { required: true, email: true },
      password: { required: true },
    },
    messages: {
      email: { required: 'Email is required', email: 'Enter a valid email' },
      password: { required: 'Password is required' },
    },
    errorElement: 'label',
    submitHandler: async function (form) {
      const btn = $(form).find('button[type=submit]');
      btn.prop('disabled', true).text('Signing in...');
      try {
        const data = await api('/users/login', {
          method: 'POST',
          body: { email: $('#email').val(), password: $('#password').val() },
        });
        Auth.set(data.token, data.user);
        toast('Welcome, ' + data.user.name + '!', 'success');
        const dest = Auth.hasRole('admin', 'cashier') ? 'dashboard.html' : 'home.html';
        setTimeout(() => (location.href = dest), 600);
      } catch (err) {
        toast(err.message, 'error');
        btn.prop('disabled', false).text('Login');
      }
    },
  });
}

function initRegister() {
  $('#registerForm').validate({
    rules: {
      name: { required: true, minlength: 2 },
      email: { required: true, email: true },
      password: { required: true, minlength: 6 },
      confirm: { required: true, equalTo: '#password' },
    },
    messages: {
      name: { required: 'Name is required' },
      email: { required: 'Email is required', email: 'Enter a valid email' },
      password: { required: 'Password is required', minlength: 'At least 6 characters' },
      confirm: { required: 'Please confirm your password', equalTo: 'Passwords do not match' },
    },
    errorElement: 'label',
    submitHandler: async function (form) {
      const btn = $(form).find('button[type=submit]');
      btn.prop('disabled', true).text('Creating...');
      try {
        await api('/users/register', {
          method: 'POST',
          body: {
            name: $('#name').val(),
            email: $('#email').val(),
            phone: $('#phone').val(),
            password: $('#password').val(),
          },
        });
        toast('Account created! Please log in.', 'success');
        setTimeout(() => (location.href = 'login.html'), 900);
      } catch (err) {
        toast(err.message, 'error');
        btn.prop('disabled', false).text('Sign Up');
      }
    },
  });
}

async function initProfile() {
  if (!requireAuth()) return;
  try {
    const { user } = await api('/users/me');
    $('#pName').val(user.name);
    $('#pEmail').val(user.email);
    $('#pPhone').val(user.phone || '');
    $('#pAddress').val(user.address || '');
  } catch (err) { toast(err.message, 'error'); }

  $('#profileForm').validate({
    rules: { name: { required: true } },
    errorElement: 'label',
    submitHandler: async function () {
      try {
        const data = await api('/users/me', {
          method: 'PUT',
          body: { name: $('#pName').val(), phone: $('#pPhone').val(), address: $('#pAddress').val() },
        });
        Auth.set(Auth.token, data.user);
        toast('Profile updated', 'success');
        renderHeader('profile');
      } catch (err) { toast(err.message, 'error'); }
    },
  });

  $('#passwordForm').validate({
    rules: {
      currentPassword: { required: true },
      newPassword: { required: true, minlength: 6 },
      confirmPassword: { required: true, equalTo: '#newPassword' },
    },
    messages: {
      confirmPassword: { equalTo: 'Passwords do not match' },
      newPassword: { minlength: 'At least 6 characters' },
    },
    errorElement: 'label',
    submitHandler: async function (form) {
      try {
        await api('/users/me/password', {
          method: 'PUT',
          body: { currentPassword: $('#currentPassword').val(), newPassword: $('#newPassword').val() },
        });
        toast('Password updated', 'success');
        form.reset();
      } catch (err) { toast(err.message, 'error'); }
    },
  });
}

/* ---- Admin user management (DataTables) ---- */
function initUserAdmin() {
  if (!requireAuth(['admin'])) return;
  const table = $('#usersTable').DataTable({
    ajax: async function (data, callback) {
      try {
        const res = await api('/users?limit=1000');
        callback({ data: res.data });
      } catch (err) { toast(err.message, 'error'); callback({ data: [] }); }
    },
    columns: [
      { data: 'id', title: 'ID' },
      { data: 'name', title: 'Name' },
      { data: 'email', title: 'Email' },
      {
        data: 'role',
        title: 'Role',
        render: (r) => `<span class="badge ${r}">${r}</span>`,
      },
      {
        data: 'active',
        title: 'Status',
        render: (a) => a ? '<span class="badge active">Active</span>' : '<span class="badge inactive">Inactive</span>',
      },
      {
        data: null,
        title: 'Actions',
        orderable: false,
        render: (row) => `
          <button class="btn btn-sm btn-outline" onclick="editUser(${row.id})">Edit</button>
          <button class="btn btn-sm ${row.active ? 'btn-danger' : 'btn-success'}" onclick="toggleActive(${row.id}, ${!row.active})">${row.active ? 'Deactivate' : 'Activate'}</button>
          <button class="btn btn-sm btn-ghost" onclick="deleteUser(${row.id})">Delete</button>`,
      },
    ],
    order: [[0, 'desc']],
    pageLength: 10,
  });
  window._usersTable = table;

  $('#newUserBtn').on('click', () => openUserModal());
  $('#userForm').validate({
    rules: {
      name: { required: true },
      email: { required: true, email: true },
      password: { required: function () { return !$('#uId').val(); }, minlength: 6 },
    },
    errorElement: 'label',
    submitHandler: async function () {
      const id = $('#uId').val();
      const body = {
        name: $('#uName').val(),
        email: $('#uEmail').val(),
        role: $('#uRole').val(),
        phone: $('#uPhone').val(),
      };
      if ($('#uPassword').val()) body.password = $('#uPassword').val();
      try {
        if (id) await api('/users/' + id, { method: 'PUT', body });
        else await api('/users', { method: 'POST', body });
        toast('Saved', 'success');
        closeModal('userModal');
        table.ajax.reload();
      } catch (err) { toast(err.message, 'error'); }
    },
  });
}

function openUserModal(user) {
  $('#userForm')[0].reset();
  $('#uId').val(user ? user.id : '');
  $('#userModalTitle').text(user ? 'Edit User' : 'New User');
  if (user) {
    $('#uName').val(user.name); $('#uEmail').val(user.email);
    $('#uRole').val(user.role); $('#uPhone').val(user.phone || '');
    $('#uPassword').attr('placeholder', 'Leave blank to keep current');
  } else {
    $('#uPassword').attr('placeholder', 'Required');
  }
  openModal('userModal');
}

async function editUser(id) {
  try { const { user } = await api('/users/' + id); openUserModal(user); }
  catch (err) { toast(err.message, 'error'); }
}
async function toggleActive(id, active) {
  try { await api('/users/' + id + '/active', { method: 'PATCH', body: { active } }); toast('Updated', 'success'); window._usersTable.ajax.reload(); }
  catch (err) { toast(err.message, 'error'); }
}
async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try { await api('/users/' + id, { method: 'DELETE' }); toast('Deleted', 'success'); window._usersTable.ajax.reload(); }
  catch (err) { toast(err.message, 'error'); }
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
