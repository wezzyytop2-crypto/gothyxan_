firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const productsGrid = document.getElementById('productsGrid');
const adminBtn = document.getElementById('adminBtn');
const adminModal = document.getElementById('adminModal');
const closeAdmin = document.getElementById('closeAdmin');
const addProductBtn = document.getElementById('addProductBtn');
const adminProductsTable = document.getElementById('adminProductsTable').querySelector('tbody');
const adminActionsTable = document.getElementById('adminActionsTable').querySelector('tbody');
const notice = document.getElementById('notice');

// ===== Каталог товаров =====
function renderProducts(products) {
    productsGrid.innerHTML = '';
    products.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
      <img src="${prod.image || 'https://via.placeholder.com/210x210'}" alt="">
      <div class="brand">${prod.brand || ''}</div>
      <h2>${prod.name}</h2>
      <div class="desc">${prod.desc || ''}</div>
      <div class="sizes">Размеры: ${prod.sizes ? prod.sizes.join(', ') : ''}</div>
      <div class="price">$${prod.price}</div>
      <button class="cart-btn" onclick="addToCart('${prod.id || ''}', '${prod.name}')">ADD TO CART</button>
    `;
        productsGrid.appendChild(card);
    });
}

function fetchProducts() {
    db.collection('products').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const products = [];
        snapshot.forEach(doc => products.push({ ...doc.data(), id: doc.id }));
        renderProducts(products);
        renderAdminProducts(products);
    });
}
fetchProducts();

// ===== Добавление товара (admin) =====
addProductBtn.onclick = () => {
    const name = document.getElementById('prodName').value.trim();
    const brand = document.getElementById('prodBrand').value.trim();
    const price = document.getElementById('prodPrice').value.trim();
    const image = document.getElementById('prodImage').value.trim();
    const desc = document.getElementById('prodDesc').value.trim();
    const sizes = document.getElementById('prodSizes').value
      .split(',').map(s => s.trim()).filter(s => s);

    if (!name || !price || !image) return showNotice('Заполните все обязательные поля!', true);

    db.collection('products').add({
        name, brand, price, image, desc, sizes,
            createdAt: new Date().toISOString()
    })
    .then(() => {
        document.getElementById('prodName').value = '';
        document.getElementById('prodBrand').value = '';
        document.getElementById('prodPrice').value = '';
        document.getElementById('prodImage').value = '';
        document.getElementById('prodDesc').value = '';
        document.getElementById('prodSizes').value = '';
        showNotice('Товар успешно добавлен!');
    });
};

// ===== Удаление товара (admin) =====
function renderAdminProducts(products) {
    adminProductsTable.innerHTML = '';
    products.forEach(prod => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${prod.name}</td>
      <td>${prod.brand}</td>
      <td>${prod.price}</td>
      <td>${prod.sizes ? prod.sizes.join(', ') : ''}</td>
      <td><button class="delete-btn" onclick="deleteProduct('${prod.id}')">Удалить</button></td>
    `;
        adminProductsTable.appendChild(tr);
    });
}
window.deleteProduct = function(id) {
    if (confirm('Уверены что хотите удалить товар?')) {
        db.collection('products').doc(id).delete();
        showNotice('Товар удалён!');
    }
};

// ===== Лог действий пользователей =====
window.addToCart = function(id, name) {
    db.collection('actions').add({
        action: `Пользователь добавил в корзину: ${name}`,
        timestamp: new Date().toLocaleString()
    });
    showNotice('Товар добавлен в корзину!');
};

function renderAdminActions(actions) {
    adminActionsTable.innerHTML = '';
    actions.forEach(act => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${act.action}</td>
      <td>${act.timestamp}</td>
    `;
        adminActionsTable.appendChild(tr);
    });
}

function fetchActions() {
    db.collection('actions').orderBy('timestamp', 'desc')
      .limit(30)
      .onSnapshot(snapshot => {
          const actions = [];
          snapshot.forEach(doc => actions.push(doc.data()));
          renderAdminActions(actions);
      });
}

// ====== Admin Modal ======
adminBtn.onclick = () => {
    adminModal.style.display = 'flex';
    fetchActions();
};
closeAdmin.onclick = () => { adminModal.style.display = 'none'; }
window.onclick = function(e) {
    if (e.target === adminModal) adminModal.style.display = 'none';
}

// ===== Уведомления =====
function showNotice(msg, err) {
    notice.textContent = msg;
    notice.style.background = err ? '#e74c3c' : '#000';
    notice.style.display = 'block';
    setTimeout(() => { notice.style.display = 'none'; }, 2800);
}