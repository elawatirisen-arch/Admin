// ===================================================================
// ALIPSTORE ADMIN — app logic
// Firebase v10 modular SDK (via CDN, ES modules)
// ===================================================================
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ---------------- state ----------------
let PRODUCTS = [];
let ORDERS = [];
let GALLERY = [];
let currentEditId = null;
let pickerTargetField = null; // 'image' field being chosen from gallery

// ---------------- helpers ----------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtPrice = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');

function toast(msg, type = '') {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showSection(name) {
  $$('.section').forEach(s => s.classList.remove('active'));
  $('#section-' + name)?.classList.add('active');
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.section === name));
  $('#sidebar').classList.remove('open');
  const titles = {
    dashboard: ['Dashboard', 'Ringkasan performa ALIPSTORE'],
    products: ['Kelola Produk', 'Tambah, ubah, dan atur seluruh produk'],
    gallery: ['Galeri Media', 'Upload dan kelola foto produk'],
    orders: ['Pesanan', 'Riwayat permintaan pembelian dari pelanggan'],
    settings: ['Pengaturan Toko', 'Banner, kontak, dan info umum toko'],
  };
  const [t, s] = titles[name] || ['', ''];
  $('#pageTitle').textContent = t;
  $('#pageSub').textContent = s;
}

// ---------------- auth ----------------
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#loginEmail').value.trim();
  const pass = $('#loginPassword').value;
  const btn = $('#loginBtn');
  const errBox = $('#loginError');
  errBox.classList.remove('show');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Masuk...';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    errBox.textContent = mapAuthError(err.code);
    errBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Masuk ke Dashboard';
  }
});

function mapAuthError(code) {
  const map = {
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/user-not-found': 'Akun admin tidak ditemukan.',
    'auth/wrong-password': 'Password salah.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
  };
  return map[code] || 'Gagal login. Periksa kembali kredensial kamu.';
}

$('#logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    $('#loginScreen').style.display = 'none';
    $('#appScreen').style.display = 'flex';
    $('#adminEmail').textContent = user.email;
    $('#adminAvatar').textContent = (user.email || 'A').slice(0, 2).toUpperCase();
    attachListeners();
    showSection('dashboard');
  } else {
    $('#loginScreen').style.display = 'flex';
    $('#appScreen').style.display = 'none';
  }
});

// ---------------- nav ----------------
$$('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', () => showSection(item.dataset.section));
});
$('#mobileMenuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

// ---------------- Firestore listeners ----------------
let unsubProducts = null, unsubOrders = null;
function attachListeners() {
  if (unsubProducts) return; // already attached
  unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), (snap) => {
    PRODUCTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDashboard();
    renderProductsTable();
  }, (err) => toast('Gagal memuat produk: ' + err.message, 'err'));

  unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snap) => {
    ORDERS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDashboard();
    renderOrdersTable();
  }, (err) => toast('Gagal memuat pesanan: ' + err.message, 'err'));

  loadGallery();
  loadSettings();
}

// ---------------- dashboard ----------------
function renderDashboard() {
  const total = PRODUCTS.length;
  const uid = PRODUCTS.filter(p => p.category === 'uid').length;
  const script = PRODUCTS.filter(p => p.category === 'script').length;
  const available = PRODUCTS.filter(p => p.status === 'available').length;
  const sold = PRODUCTS.filter(p => p.status === 'sold').length;
  const orders = ORDERS.length;

  $('#statTotalProducts').textContent = total;
  $('#statUid').textContent = uid;
  $('#statScript').textContent = script;
  $('#statAvailable').textContent = available;
  $('#statSold').textContent = sold;
  $('#statOrders').textContent = orders;

  const recentBody = $('#recentOrdersBody');
  recentBody.innerHTML = '';
  if (!ORDERS.length) {
    recentBody.innerHTML = `<tr><td colspan="4"><div class="empty-state">Belum ada pesanan masuk.</div></td></tr>`;
  } else {
    ORDERS.slice(0, 6).forEach(o => {
      recentBody.innerHTML += `
        <tr>
          <td>${escapeHtml(o.productName || '-')}</td>
          <td>${escapeHtml(o.buyerName || 'Anonim')}</td>
          <td>${fmtPrice(o.price)}</td>
          <td><span class="badge badge-${o.status === 'done' ? 'good' : 'warn'}">${o.status === 'done' ? 'Selesai' : 'Menunggu'}</span></td>
        </tr>`;
    });
  }
}

// ---------------- products ----------------
function renderProductsTable() {
  const tbody = $('#productsBody');
  const term = ($('#productSearch').value || '').toLowerCase();
  const catFilter = $('#productCategoryFilter').value;
  let rows = PRODUCTS.filter(p =>
    (!term || (p.name || '').toLowerCase().includes(term)) &&
    (!catFilter || p.category === catFilter)
  );
  tbody.innerHTML = '';
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">Belum ada produk. Klik "Tambah Produk" untuk mulai.</div></td></tr>`;
    return;
  }
  const catLabel = { uid: 'UID Free Fire', script: 'Script', tools: 'Tools Digital', other: 'Produk Lainnya' };
  rows.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td><img class="thumb" src="${p.image || placeholderImg()}" alt=""></td>
        <td>
          <div style="font-weight:600">${escapeHtml(p.name)}</div>
          <div style="color:var(--muted-2);font-size:11.5px">${p.label ? escapeHtml(p.label) : ''}</div>
        </td>
        <td>${catLabel[p.category] || p.category}</td>
        <td>
          ${p.discountPrice ? `<span style="text-decoration:line-through;color:var(--muted-2);font-size:11.5px">${fmtPrice(p.price)}</span><br>${fmtPrice(p.discountPrice)}` : fmtPrice(p.price)}
        </td>
        <td><span class="badge badge-${p.status === 'available' ? 'good' : 'sold'}">${p.status === 'available' ? 'Tersedia' : 'Terjual'}</span></td>
        <td>${p.featured ? '<span class="badge badge-warn">Unggulan</span>' : ''}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-ghost" data-edit="${p.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del="${p.id}">Hapus</button>
        </td>
      </tr>`;
  });
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.edit)));
  $$('[data-del]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.del)));
}
$('#productSearch').addEventListener('input', renderProductsTable);
$('#productCategoryFilter').addEventListener('change', renderProductsTable);

function placeholderImg() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#141C2C"/><text x="50%" y="55%" font-size="11" fill="#59667C" text-anchor="middle" font-family="sans-serif">No Image</text></svg>`
  );
}

function openProductModal(id = null) {
  currentEditId = id;
  const p = id ? PRODUCTS.find(x => x.id === id) : null;
  $('#productModalTitle').textContent = p ? 'Edit Produk' : 'Tambah Produk';
  $('#pf-name').value = p?.name || '';
  $('#pf-category').value = p?.category || 'uid';
  $('#pf-price').value = p?.price || '';
  $('#pf-discount').value = p?.discountPrice || '';
  $('#pf-desc').value = p?.description || '';
  $('#pf-status').value = p?.status || 'available';
  $('#pf-label').value = p?.label || '';
  $('#pf-featured').checked = !!p?.featured;
  $('#pf-image').value = p?.image || '';
  $('#pf-imagePreview').src = p?.image || placeholderImg();
  // script-specific
  $('#pf-lang').value = p?.lang || '';
  $('#pf-version').value = p?.version || '';
  $('#pf-compat').value = p?.compat || '';
  $('#pf-install').value = p?.installGuide || '';
  toggleScriptFields();
  $('#productOverlay').classList.add('show');
}
function closeProductModal() { $('#productOverlay').classList.remove('show'); currentEditId = null; }
$('#addProductBtn').addEventListener('click', () => openProductModal());
$('#productModalClose').addEventListener('click', closeProductModal);
$('#productCancelBtn').addEventListener('click', closeProductModal);
$('#pf-category').addEventListener('change', toggleScriptFields);
function toggleScriptFields() {
  const isScript = $('#pf-category').value === 'script';
  $('#scriptFields').style.display = isScript ? 'block' : 'none';
}

$('#pf-pickImage').addEventListener('click', () => {
  pickerTargetField = 'pf-image';
  openGalleryPicker();
});

$('#productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = $('#productSaveBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span> Menyimpan...';
  const data = {
    name: $('#pf-name').value.trim(),
    category: $('#pf-category').value,
    price: Number($('#pf-price').value) || 0,
    discountPrice: $('#pf-discount').value ? Number($('#pf-discount').value) : null,
    description: $('#pf-desc').value.trim(),
    status: $('#pf-status').value,
    label: $('#pf-label').value.trim(),
    featured: $('#pf-featured').checked,
    image: $('#pf-image').value.trim(),
    lang: $('#pf-lang').value.trim(),
    version: $('#pf-version').value.trim(),
    compat: $('#pf-compat').value.trim(),
    installGuide: $('#pf-install').value.trim(),
    updatedAt: serverTimestamp(),
  };
  try {
    if (!data.name) throw new Error('Nama produk wajib diisi.');
    if (currentEditId) {
      await updateDoc(doc(db, 'products', currentEditId), data);
      toast('Produk diperbarui.', 'ok');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'products'), data);
      toast('Produk ditambahkan.', 'ok');
    }
    closeProductModal();
  } catch (err) {
    toast(err.message || 'Gagal menyimpan produk.', 'err');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Simpan Produk';
  }
});

async function deleteProduct(id) {
  if (!confirm('Hapus produk ini? Tindakan tidak bisa dibatalkan.')) return;
  try {
    await deleteDoc(doc(db, 'products', id));
    toast('Produk dihapus.', 'ok');
  } catch (err) {
    toast('Gagal menghapus produk.', 'err');
  }
}

// ---------------- gallery ----------------
async function loadGallery() {
  try {
    const listRef = ref(storage, 'gallery');
    const res = await listAll(listRef);
    GALLERY = await Promise.all(res.items.map(async (itemRef) => ({
      name: itemRef.name,
      path: itemRef.fullPath,
      url: await getDownloadURL(itemRef),
    })));
    renderGallery();
  } catch (err) {
    // bucket may be empty or rules not yet configured — fail quietly in UI
    renderGallery();
  }
}

function renderGallery(forPicker = false) {
  const grid = forPicker ? $('#pickerGalleryGrid') : $('#galleryGrid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!GALLERY.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Belum ada foto diunggah.</div>`;
    return;
  }
  GALLERY.forEach(g => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `
      <img src="${g.url}" alt="${escapeHtml(g.name)}" loading="lazy">
      <div class="gi-name">${escapeHtml(g.name)}</div>
      ${forPicker ? '' : `<div class="gi-del" data-del-img="${g.path}" title="Hapus">&times;</div>`}
    `;
    if (forPicker) {
      item.addEventListener('click', () => {
        $('#' + pickerTargetField).value = g.url;
        $('#pf-imagePreview').src = g.url;
        closeGalleryPicker();
      });
    }
    grid.appendChild(item);
  });
  if (!forPicker) {
    $$('[data-del-img]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteGalleryImage(b.dataset.delImg);
    }));
  }
}

async function deleteGalleryImage(path) {
  if (!confirm('Hapus foto ini dari galeri?')) return;
  try {
    await deleteObject(ref(storage, path));
    toast('Foto dihapus.', 'ok');
    loadGallery();
  } catch (err) {
    toast('Gagal menghapus foto.', 'err');
  }
}

async function uploadFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  toast(`Mengunggah ${files.length} foto...`);
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      toast(`${file.name} dilewati (maks 5MB).`, 'err');
      continue;
    }
    try {
      const safeName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileRef = ref(storage, 'gallery/' + safeName);
      await uploadBytes(fileRef, file);
    } catch (err) {
      toast('Gagal mengunggah ' + file.name, 'err');
    }
  }
  toast('Upload selesai.', 'ok');
  loadGallery();
}

$('#galleryUploadInput').addEventListener('change', (e) => uploadFiles(e.target.files));
const dz = $('#galleryDropzone');
dz.addEventListener('click', () => $('#galleryUploadInput').click());
['dragover', 'dragleave', 'drop'].forEach(evt => {
  dz.addEventListener(evt, (e) => {
    e.preventDefault();
    dz.classList.toggle('drag', evt === 'dragover');
  });
});
dz.addEventListener('drop', (e) => uploadFiles(e.dataTransfer.files));

function openGalleryPicker() {
  renderGallery(true);
  $('#galleryPickerOverlay').classList.add('show');
}
function closeGalleryPicker() { $('#galleryPickerOverlay').classList.remove('show'); }
$('#galleryPickerClose').addEventListener('click', closeGalleryPicker);
$('#galleryPickerUploadInput').addEventListener('change', async (e) => {
  await uploadFiles(e.target.files);
  renderGallery(true);
});

// ---------------- orders ----------------
function renderOrdersTable() {
  const tbody = $('#ordersBody');
  tbody.innerHTML = '';
  if (!ORDERS.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">Belum ada pesanan.</div></td></tr>`;
    return;
  }
  ORDERS.forEach(o => {
    tbody.innerHTML += `
      <tr>
        <td>${escapeHtml(o.productName || '-')}</td>
        <td>${escapeHtml(o.buyerName || 'Anonim')}</td>
        <td>${fmtPrice(o.price)}</td>
        <td>${o.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}</td>
        <td>
          <select class="select-sm" data-order-status="${o.id}">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Menunggu</option>
            <option value="done" ${o.status === 'done' ? 'selected' : ''}>Selesai</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Dibatalkan</option>
          </select>
        </td>
        <td>${o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('id-ID') : '-'}</td>
      </tr>`;
  });
  $$('[data-order-status]').forEach(sel => {
    sel.addEventListener('change', async () => {
      try {
        await updateDoc(doc(db, 'orders', sel.dataset.orderStatus), { status: sel.value });
        toast('Status pesanan diperbarui.', 'ok');
      } catch { toast('Gagal memperbarui status.', 'err'); }
    });
  });
}

// ---------------- settings ----------------
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'store'));
    if (snap.exists()) {
      const s = snap.data();
      $('#set-bannerTitle').value = s.bannerTitle || '';
      $('#set-bannerSub').value = s.bannerSubtitle || '';
      $('#set-bannerImage').value = s.bannerImage || '';
      $('#set-whatsapp').value = s.whatsapp || '';
      $('#set-telegram').value = s.telegram || '';
    }
  } catch (err) { /* settings doc may not exist yet */ }
}
$('#set-pickBanner').addEventListener('click', () => {
  pickerTargetField = 'set-bannerImage';
  openGalleryPicker();
});
$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#settingsSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Menyimpan...';
  try {
    await setDoc(doc(db, 'settings', 'store'), {
      bannerTitle: $('#set-bannerTitle').value.trim(),
      bannerSubtitle: $('#set-bannerSub').value.trim(),
      bannerImage: $('#set-bannerImage').value.trim(),
      whatsapp: $('#set-whatsapp').value.trim(),
      telegram: $('#set-telegram').value.trim(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    toast('Pengaturan disimpan.', 'ok');
  } catch (err) {
    toast('Gagal menyimpan pengaturan.', 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Pengaturan';
  }
});

// ---------------- utils ----------------
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
