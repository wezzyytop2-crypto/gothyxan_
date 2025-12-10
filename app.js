// app.js - products, cart and admin logic (client-side)
// Supports Firestore (if firebase-init.js initialized __g_firebase) or falls back to localStorage.
//
// To use Firebase:
// 1) Paste your Firebase config into firebase-init.js (see template).
// 2) Ensure Firestore and Storage enabled in Firebase console.
// 3) Optionally setup Firebase Authentication and sign in in admin.html (not enforced here).
//
// Storage layout:
// - Firestore collection: "products"
// - Each product: { id, title, price, category, desc, color, imageUrl }

const KEY_PRODUCTS = 'gothyxan_products_v1';
const KEY_CART = 'gothyxan_cart_v1';
const DEFAULT_PRODUCTS = [
  { id: 'prod-001', title: "Nocturne Coat", price: 7990, category: 'unisex', desc: "Elegant wool coat.", color: "#1b1b1b" },
  { id: 'prod-002', title: "Raven Belt", price: 1990, category: 'unisex', desc: "Leather belt.", color: "#2a2a2a" },
  { id: 'prod-003', title: "Eclipse Dress", price: 5490, category: 'girls', desc: "Evening dress.", color: "#292929" },
  { id: 'prod-004', title: "Void Boots", price: 9200, category: 'boys', desc: "Lace-up boots.", color: "#111111" }
];

// Firebase helpers
function hasFirebase(){ return !!(window.__g_firebase && __g_firebase.db); }
async function fetchProductsFromFirestore(){
    const db = __g_firebase.db;
    const snap = await db.collection('products').orderBy('title').get();
    return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
}
async function saveProductToFirestore(product, file /* optional file input */){
    const db = __g_firebase.db;
    const storage = __g_firebase.storage;
    // If file provided, upload to storage and set product.imageUrl
    if (file) {
        const filename = `products/${Date.now()}_${file.name}`;
        const ref = storage.ref().child(filename);
        await ref.put(file);
        product.imageUrl = await ref.getDownloadURL();
    }
    // if product.id exists, set document with that id, else add auto-id
    const docRef = product.id ? db.collection('products').doc(product.id) : db.collection('products').doc();
    product.id = docRef.id;
    await docRef.set(product, { merge: true });
    return product;
}
async function deleteProductFromFirestore(id){
    const db = __g_firebase.db;
    await db.collection('products').doc(id).delete();
    return true;
}

// Local storage fallback
function loadProductsLocal(){ try { const raw = localStorage.getItem(KEY_PRODUCTS); if (!raw){ localStorage.setItem(KEY_PRODUCTS, JSON.stringify(DEFAULT_PRODUCTS)); return DEFAULT_PRODUCTS.slice(); } return JSON.parse(raw); } catch(e){ return DEFAULT_PRODUCTS.slice(); } }
function saveProductsLocal(arr){ localStorage.setItem(KEY_PRODUCTS, JSON.stringify(arr)); }

// Public load/save (auto chooses Firestore if available)
async function loadProducts(){
    if (hasFirebase()){
        try { return await fetchProductsFromFirestore(); } catch(e){ console.warn('Firestore read failed, falling back to local', e); return loadProductsLocal(); }
    }
    return loadProductsLocal();
}
async function saveProduct(product, file){
    if (hasFirebase()){
        return await saveProductToFirestore(product, file);
    } else {
        const arr = loadProductsLocal();
        if (!product.id) product.id = 'prod-' + Math.random().toString(36).slice(2,8);
        arr.push(product);
        saveProductsLocal(arr);
        return product;
    }
}
async function deleteProduct(id){
    if (hasFirebase()){
        return await deleteProductFromFirestore(id);
    } else {
        const arr = loadProductsLocal().filter(x=>x.id!==id);
        saveProductsLocal(arr);
        return true;
    }
}

// CART (local only)
function loadCart(){ try { return JSON.parse(localStorage.getItem(KEY_CART) || '[]'); } catch(e){ return []; } }
function saveCart(cart){ localStorage.setItem(KEY_CART, JSON.stringify(cart)); }
function cartCount(){ return loadCart().reduce((s,i)=>s+i.qty,0); }
function addToCart(item){ const cart = loadCart(); const idx = cart.findIndex(i=>i.id===item.id); if (idx === -1) cart.push(Object.assign({}, item, { qty: item.qty || 1 })); else cart[idx].qty += (item.qty || 1); saveCart(cart); }

// Price formatter
function formatPrice(n){ return n.toLocaleString('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }); }
window.GOTHYXAN_formatPrice = formatPrice;

// Header update
function updateHeaderCount(){ document.querySelectorAll('.cart-count').forEach(el => el.textContent = cartCount()); }

// Render products on catalog page
window.GOTHYXAN_renderProducts = async function(){
    const container = document.getElementById('products');
    if (!container) return;
    let products = await loadProducts();
    const sort = window.GOTHYXAN_sort || 'default';
    if (sort === 'price-asc') products = products.slice().sort((a,b)=> a.price - b.price);
    if (sort === 'price-desc') products = products.slice().sort((a,b)=> b.price - a.price);

    container.innerHTML = products.map(p => `
    <article class="product-card" data-id="${p.id}">
      <a class="product-media" href="product.html?id=${p.id}" aria-hidden="true">
        <div class="prod-thumb" style="background:${p.color || '#ddd'}"></div>
      </a>
      <div class="product-body">
        <h3 class="product-title"><a href="product.html?id=${p.id}">${p.title}</a></h3>
        <div class="product-meta">${p.category || ''}</div>
        <div class="product-foot">
          <div class="price">${formatPrice(p.price)}</div>
          <button class="btn small add-to-cart" data-id="${p.id}">Add</button>
        </div>
      </div>
    </article>
  `).join('');

    container.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', (e)=>{
        const id = e.currentTarget.dataset.id;
        loadProducts().then(list => {
            const prod = list.find(x=>x.id===id);
            if (!prod) return alert('Product not found');
            addToCart({ id: prod.id, title: prod.title, price: prod.price, qty: 1 });
            updateHeaderCount();
            e.currentTarget.textContent = 'Added';
            setTimeout(()=> e.currentTarget.textContent = 'Add', 900);
        });
    }));
};

// Render product detail
async function renderProductDetail(){
    const el = document.getElementById('product-detail');
    if (!el) return;
    const url = new URL(location.href);
    const id = url.searchParams.get('id') || '';
    const products = await loadProducts();
    const prod = products.find(p => p.id === id) || products[0];
    if (!prod) return el.innerHTML = '<p>Product not found</p>';
    el.innerHTML = `
    <div class="product-detail-grid">
      <div class="gallery">
        <div class="prod-thumb large" style="background:${prod.color || '#ddd'}"></div>
      </div>
      <div class="info">
        <h1>${prod.title}</h1>
        <div class="price big">${formatPrice(prod.price)}</div>
        <p class="muted">${prod.desc || ''}</p>
        <div style="margin-top:18px;display:flex;gap:12px">
          <input id="pd-qty" type="number" min="1" value="1" style="width:80px;padding:8px;border-radius:8px;border:1px solid #eee" />
          <button id="pd-add" class="btn primary">Add to cart</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById('pd-add').addEventListener('click', ()=> {
        const qty = Math.max(1, parseInt(document.getElementById('pd-qty').value||1,10));
        addToCart({ id: prod.id, title: prod.title, price: prod.price, qty });
        updateHeaderCount();
        alert('Added to cart');
    });
}

// Cart rendering (same as before)
window.GOTHYXAN_renderCart = function(){
    const tbody = document.getElementById('cart-items');
    const table = document.getElementById('cart-table');
    const empty = document.getElementById('cart-empty');
    const summary = document.getElementById('cart-summary');
    if (!tbody) return;
    const cart = loadCart();
    if (cart.length === 0) {
        if (table) table.style.display = 'none';
        if (summary) summary.style.display = 'none';
        if (empty) empty.style.display = 'block';
        updateHeaderCount();
        return;
    }
    if (table) table.style.display = '';
    if (summary) summary.style.display = '';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = '';
    let totalQty = 0, totalSum = 0;
    cart.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><div style="display:flex;gap:12px;align-items:center"><div style="width:64px;height:64px;background:${item.color||'#ddd'};border-radius:8px"></div><div><strong>${escapeHtml(item.title)}</strong></div></div></td>
      <td>${formatPrice(item.price)}</td>
      <td>${item.qty}</td>
      <td>${formatPrice(item.price * item.qty)}</td>
      <td><button class="remove-item" data-id="${item.id}">Remove</button></td>
    `;
        tbody.appendChild(tr);
        totalQty += item.qty; totalSum += item.price * item.qty;
    });
    document.getElementById('cart-total-qty').textContent = totalQty;
    document.getElementById('cart-total-sum').textContent = formatPrice(totalSum);

    tbody.querySelectorAll('.remove-item').forEach(b => b.addEventListener('click', ()=>{
        const id = b.dataset.id;
        let cart = loadCart();
        cart = cart.filter(i => i.id !== id);
        saveCart(cart);
        window.GOTHYXAN_renderCart();
        updateHeaderCount();
    }));
};

// ADMIN: list, add, edit, delete using unified functions
async function adminList(){
    const wrap = document.getElementById('admin-products');
    if (!wrap) return;
    const products = await loadProducts();
    wrap.innerHTML = products.map(p=>`
    <div style="border-bottom:1px dashed rgba(0,0,0,0.06);padding:8px 0;display:flex;justify-content:space-between;align-items:center">
      <div><strong>${escapeHtml(p.title)}</strong> — ${p.category || ''} — ${formatPrice(p.price)}</div>
      <div><button class="admin-edit" data-id="${p.id}">Edit</button> <button class="admin-delete" data-id="${p.id}">Delete</button></div>
    </div>
  `).join('');
    wrap.querySelectorAll('.admin-delete').forEach(b => b.addEventListener('click', async ()=>{
        if (!confirm('Delete product?')) return;
        const id = b.dataset.id;
        await deleteProduct(id);
        adminList();
        window.GOTHYXAN_renderProducts && window.GOTHYXAN_renderProducts();
    }));
    wrap.querySelectorAll('.admin-edit').forEach(b => b.addEventListener('click', async ()=>{
        const id = b.dataset.id;
        const products = await loadProducts();
        const p = products.find(x=>x.id===id);
        if (!p) return;
        document.getElementById('p-title').value = p.title;
        document.getElementById('p-price').value = p.price;
        document.getElementById('p-category').value = p.category || '';
        document.getElementById('p-desc').value = p.desc || '';
        document.getElementById('p-color').value = p.color || '';
        // Pre-delete to replace on save (simpler flow)
        await deleteProduct(id);
        adminList();
    }));
}

function adminInit(){
    const form = document.getElementById('admin-form');
    if (!form) return;
    document.getElementById('save-product').addEventListener('click', async ()=>{
        const title = document.getElementById('p-title').value.trim();
        const price = parseInt(document.getElementById('p-price').value||0,10);
        const category = document.getElementById('p-category').value.trim();
        const desc = document.getElementById('p-desc').value.trim();
        const color = document.getElementById('p-color').value.trim() || '#dddddd';
        const fileInput = document.getElementById('p-image');
        const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (!title || !price) return alert('Title and price required');
        const product = { title, price, category, desc, color };
        await saveProduct(product, file);
        form.reset();
        adminList();
        window.GOTHYXAN_renderProducts && window.GOTHYXAN_renderProducts();
        alert('Saved');
    });
    document.getElementById('cancel-product').addEventListener('click', ()=>{
        form.reset();
    });
    adminList();
}

// Utility
function escapeHtml(text){ return (''+text).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Startup
document.addEventListener('DOMContentLoaded', ()=>{
    updateHeaderCount();
    window.GOTHYXAN_renderProducts && window.GOTHYXAN_renderProducts();
    adminInit();
    window.GOTHYXAN_renderCart && window.GOTHYXAN_renderCart();
    renderProductDetail();
    document.getElementById('clear-cart')?.addEventListener('click', ()=>{ if (!confirm('Clear cart?')) return; saveCart([]); window.GOTHYXAN_renderCart(); updateHeaderCount(); });
    document.getElementById('checkout')?.addEventListener('click', ()=>{ if (cartCount() === 0) return alert('Cart empty'); alert('Order placed (stub). Thank you!'); saveCart([]); window.GOTHYXAN_renderCart(); updateHeaderCount(); });
});