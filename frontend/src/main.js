// API Configuration
const API_URL = 'http://localhost:3000/api';

// State Management
const state = {
  user: null,
  token: localStorage.getItem('token'),
  products: [],
  cart: [],
  orders: [],
  currentPage: 'products',
  sustainabilityData: null,
  cartImpact: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initEventListeners();
  loadProducts();
});

// Check authentication
function checkAuth() {
  if (state.token) {
    try {
      const payload = JSON.parse(atob(state.token.split('.')[1]));
      state.user = { 
        id: payload.userId, 
        role: payload.role 
      };
      updateAuthUI(true);
      loadCart();
    } catch (error) {
      logout();
    }
  }
}

// Update authentication UI
function updateAuthUI(isAuthenticated) {
  const authButtons = document.getElementById('authButtons');
  const userInfo = document.getElementById('userInfo');
  const navCart = document.getElementById('navCart');
  const navOrders = document.getElementById('navOrders');
  const navAdmin = document.getElementById('navAdmin');
  const navSustainability = document.getElementById('navSustainability');
  
  if (isAuthenticated) {
    authButtons.style.display = 'none';
    userInfo.style.display = 'flex';
    navCart.style.display = 'block';
    navOrders.style.display = 'block';
    navSustainability.style.display = 'block';
    
    // Show admin link only for admin users
    if (state.user && state.user.role === 'admin') {
      navAdmin.style.display = 'block';
    }
    
    if (state.user && state.user.name) {
      document.getElementById('userName').textContent = state.user.name;
    }
  } else {
    authButtons.style.display = 'flex';
    userInfo.style.display = 'none';
    navCart.style.display = 'none';
    navOrders.style.display = 'none';
    navAdmin.style.display = 'none';
    navSustainability.style.display = 'none';
  }
  
  // Update active page indicator
  updateActiveNav(state.currentPage);
}

// Update active navigation indicator
function updateActiveNav(page) {
  // Remove active class from all nav links
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active');
  });
  
  // Add active class to current page
  const navLink = document.getElementById(`nav${page.charAt(0).toUpperCase() + page.slice(1)}`);
  if (navLink) {
    navLink.classList.add('active');
  }
}

// Event Listeners
function initEventListeners() {
  // Navigation
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = e.target.dataset.page;
      navigateTo(page);
    });
  });
  
  // Auth forms
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Product controls
  document.getElementById('searchInput').addEventListener('input', filterProducts);
  document.getElementById('categoryFilter').addEventListener('change', filterProducts);
  
  // Checkout
  document.getElementById('checkoutBtn').addEventListener('click', handleCheckout);
  
  // Admin panel
  document.getElementById('adminProductForm').addEventListener('submit', handleAdminProductSubmit);
  document.getElementById('adminCancelBtn').addEventListener('click', resetAdminForm);
  document.getElementById('adminProductImage').addEventListener('input', previewImage);
  
  // Sustainability preferences
  document.getElementById('sustainabilityPreferencesForm').addEventListener('submit', handleSustainabilityPreferences);
}

// Navigation
function navigateTo(page) {
  // Check if trying to access admin page
  if (page === 'admin' && (!state.user || state.user.role !== 'admin')) {
    showToast('Admin access required', 'error');
    return;
  }
  
  // Check if trying to access protected pages
  if (['cart', 'orders', 'sustainability'].includes(page) && !state.token) {
    showToast('Please login first', 'error');
    navigateTo('login');
    return;
  }
  
  state.currentPage = page;
  
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Show selected page
  const pageElement = document.getElementById(`${page}Page`);
  if (pageElement) {
    pageElement.classList.add('active');
  }
  
  // Update active nav indicator
  updateActiveNav(page);
  
  // Load page data
  if (page === 'cart') {
    loadCart();
  } else if (page === 'orders') {
    loadOrders();
  } else if (page === 'admin') {
    loadAdminProducts();
  } else if (page === 'sustainability') {
    loadSustainabilityDashboard();
  }
}

// API Helper
async function apiCall(endpoint, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (state.token) {
    defaultOptions.headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: { ...defaultOptions.headers, ...options.headers }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}

// Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Auth Functions
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('token', data.token);
    
    updateAuthUI(true);
    showToast(`Welcome back, ${data.user.name}!`);
    
    // Redirect to admin panel if admin user
    if (data.user.role === 'admin') {
      navigateTo('admin');
    } else {
      navigateTo('products');
    }
    
    loadCart();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const isAdmin = document.getElementById('registerAsAdmin').checked;
  
  try {
    const data = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ 
        name, 
        email, 
        password,
        role: isAdmin ? 'admin' : 'user'
      })
    });
    
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('token', data.token);
    
    updateAuthUI(true);
    showToast('Registration successful!');
    
    // Redirect to admin panel if admin user
    if (data.user.role === 'admin') {
      navigateTo('admin');
    } else {
      navigateTo('products');
    }
    
    loadCart();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.cart = [];
  localStorage.removeItem('token');
  
  updateAuthUI(false);
  updateCartBadge();
  showToast('Logged out successfully');
  navigateTo('products');
}

// Product Functions
async function loadProducts() {
  try {
    const products = await apiCall('/products');
    state.products = products;
    renderProducts(products);
  } catch (error) {
    showToast('Failed to load products', 'error');
  }
}

function renderProducts(products) {
  const container = document.getElementById('productsList');
  
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No products found</h3><p>Check back later for new products!</p></div>';
    return;
  }
  
  container.innerHTML = products.map(product => {
    // Determine carbon level
    let carbonClass = 'low';
    let carbonEmoji = '🌱';
    if (product.carbonFootprint > 10) {
      carbonClass = 'high';
      carbonEmoji = '⚠️';
    } else if (product.carbonFootprint > 5) {
      carbonClass = 'medium';
      carbonEmoji = '⚡';
    }
    
    return `
      <div class="product-card">
        ${product.isEcoFriendly ? '<div class="eco-badge">🌿 Eco-Friendly</div>' : ''}
        <img src="${product.imageUrl || 'https://via.placeholder.com/300x200?text=Product'}" 
             alt="${product.name}" class="product-image">
        <span class="product-category">${product.category}</span>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-description">${product.description}</p>
        <div class="product-price">$${parseFloat(product.price).toFixed(2)}</div>
        <div class="carbon-footprint ${carbonClass}">
          ${carbonEmoji} ${product.carbonFootprint.toFixed(1)} kg CO₂
        </div>
        <div class="product-stock">Stock: ${product.stock}</div>
        <div class="product-actions">
          ${state.token ? `
            <button class="btn btn-primary" onclick="addToCart(${product.id})" 
                    ${product.stock === 0 ? 'disabled' : ''}>
              ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          ` : `
            <button class="btn btn-secondary" onclick="navigateTo('login')">
              Login to Buy
            </button>
          `}
          ${state.token && state.user && state.user.role === 'admin' ? `
            <button class="btn btn-secondary btn-small" onclick="editAdminProduct(${product.id})">Edit</button>
            <button class="btn btn-danger btn-small" onclick="deleteAdminProduct(${product.id})">Delete</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterProducts() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  
  let filtered = state.products;
  
  if (search) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(search) || 
      p.description.toLowerCase().includes(search)
    );
  }
  
  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }
  
  renderProducts(filtered);
}

// Cart Functions
async function loadCart() {
  if (!state.token) return;
  
  try {
    const cart = await apiCall('/cart');
    state.cart = cart;
    updateCartBadge();
    
    // Load cart impact if on sustainability page
    if (state.currentPage === 'sustainability') {
      await loadCartImpact();
    }
    
    if (state.currentPage === 'cart') {
      renderCart();
    }
  } catch (error) {
    console.error('Failed to load cart:', error);
  }
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  badge.textContent = totalItems;
}

async function addToCart(productId) {
  if (!state.token) {
    showToast('Please login first', 'error');
    navigateTo('login');
    return;
  }
  
  try {
    await apiCall('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity: 1 })
    });
    showToast('Added to cart!');
    loadCart();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const totalContainer = document.getElementById('cartTotal');
  const checkoutBtn = document.getElementById('checkoutBtn');
  
  if (state.cart.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>Your cart is empty</h3><p>Add some products to get started!</p></div>';
    totalContainer.innerHTML = '';
    checkoutBtn.style.display = 'none';
    return;
  }
  
  const total = state.cart.reduce((sum, item) => 
    sum + (parseFloat(item.product.price) * item.quantity), 0
  );
  
  container.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img src="${item.product.imageUrl || 'https://via.placeholder.com/80'}" 
           alt="${item.product.name}" class="cart-item-image">
      <div class="cart-item-details">
        <div class="cart-item-name">${item.product.name}</div>
        <div class="cart-item-price">$${parseFloat(item.product.price).toFixed(2)} each</div>
      </div>
      <div class="cart-item-controls">
        <div class="quantity-controls">
          <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">-</button>
          <span class="quantity-display">${item.quantity}</span>
          <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">+</button>
        </div>
        <div class="cart-item-price">$${(parseFloat(item.product.price) * item.quantity).toFixed(2)}</div>
        <button class="btn btn-danger btn-small" onclick="removeFromCart(${item.id})">Remove</button>
      </div>
    </div>
  `).join('');
  
  totalContainer.innerHTML = `<h3>Total: $${total.toFixed(2)}</h3>`;
  checkoutBtn.style.display = 'block';
}

async function updateCartQuantity(cartItemId, newQuantity) {
  if (newQuantity < 1) return;
  
  try {
    await apiCall(`/cart/${cartItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity: newQuantity })
    });
    loadCart();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function removeFromCart(cartItemId) {
  try {
    await apiCall(`/cart/${cartItemId}`, { method: 'DELETE' });
    showToast('Item removed from cart');
    loadCart();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleCheckout() {
  if (!confirm('Place this order?')) return;
  
  try {
    await apiCall('/orders', { method: 'POST' });
    showToast('Order placed successfully! 🌱');
    loadCart();
    navigateTo('orders');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Order Functions
async function loadOrders() {
  if (!state.token) return;
  
  try {
    const orders = await apiCall('/orders');
    state.orders = orders;
    renderOrders();
  } catch (error) {
    showToast('Failed to load orders', 'error');
  }
}

function renderOrders() {
  const container = document.getElementById('ordersList');
  
  if (state.orders.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No orders yet</h3><p>Start shopping to see your orders here!</p></div>';
    return;
  }
  
  container.innerHTML = state.orders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">Order #${order.id}</div>
          <div class="order-date">${new Date(order.createdAt).toLocaleDateString()}</div>
        </div>
        <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
      </div>
      ${order.greenPointsEarned ? `
        <div class="order-green-points">
          🌱 Earned ${order.greenPointsEarned} Green Points
        </div>
      ` : ''}
      <div class="order-items">
        ${order.orderItems.map(item => `
          <div class="order-item">
            <span>${item.product.name} x ${item.quantity}</span>
            <span>$${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-total">Total: $${parseFloat(order.total).toFixed(2)}</div>
      ${order.status === 'pending' ? `
        <button class="btn btn-danger" onclick="cancelOrder(${order.id})">Cancel Order</button>
      ` : ''}
    </div>
  `).join('');
}

async function cancelOrder(orderId) {
  if (!confirm('Cancel this order?')) return;
  
  try {
    await apiCall(`/orders/${orderId}`, { method: 'DELETE' });
    showToast('Order cancelled successfully');
    loadOrders();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Admin Panel Functions
async function loadAdminProducts() {
  try {
    const products = await apiCall('/products');
    state.products = products;
    renderAdminProducts(products);
  } catch (error) {
    showToast('Failed to load products', 'error');
  }
}

function renderAdminProducts(products) {
  const container = document.getElementById('adminProductsList');
  
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No products yet</h3><p>Add your first product!</p></div>';
    return;
  }
  
  container.innerHTML = products.map(product => `
    <div class="admin-product-card">
      ${product.isEcoFriendly ? '<div class="eco-badge-small">🌿 Eco</div>' : ''}
      <img src="${product.imageUrl || 'https://via.placeholder.com/80'}" 
           alt="${product.name}" class="admin-product-image">
      <div class="admin-product-info">
        <div class="admin-product-name">${product.name}</div>
        <div class="admin-product-details">
          <span>${product.category}</span> • 
          <span>$${parseFloat(product.price).toFixed(2)}</span> • 
          <span>Stock: ${product.stock}</span>
          ${product.isEcoFriendly ? ` • <span style="color: #4caf50;">CO₂: ${product.carbonFootprint.toFixed(1)}kg</span>` : ''}
        </div>
      </div>
      <div class="admin-product-actions">
        <button class="btn btn-secondary btn-small" onclick="editAdminProduct(${product.id})">Edit</button>
        <button class="btn btn-danger btn-small" onclick="deleteAdminProduct(${product.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function previewImage() {
  const imageUrl = document.getElementById('adminProductImage').value;
  const preview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  
  if (imageUrl) {
    previewImg.src = imageUrl;
    preview.style.display = 'block';
    
    previewImg.onerror = function() {
      preview.style.display = 'none';
      showToast('Invalid image URL', 'error');
    };
  } else {
    preview.style.display = 'none';
  }
}

async function handleAdminProductSubmit(e) {
  e.preventDefault();
  
  const productId = document.getElementById('adminProductId').value;
  const productData = {
    name: document.getElementById('adminProductName').value,
    description: document.getElementById('adminProductDescription').value,
    price: parseFloat(document.getElementById('adminProductPrice').value),
    imageUrl: document.getElementById('adminProductImage').value || 'https://via.placeholder.com/300x200?text=Product',
    stock: parseInt(document.getElementById('adminProductStock').value),
    category: document.getElementById('adminProductCategory').value,
    isEcoFriendly: document.getElementById('adminProductEcoFriendly')?.checked || false,
    carbonFootprint: parseFloat(document.getElementById('adminProductCarbon')?.value || 2.5),
    plasticContent: parseFloat(document.getElementById('adminProductPlastic')?.value || 50),
    recyclable: document.getElementById('adminProductRecyclable')?.checked || false,
    locallySourced: document.getElementById('adminProductLocal')?.checked || false
  };
  
  try {
    if (productId) {
      await apiCall(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
      });
      showToast('Product updated successfully!');
    } else {
      await apiCall('/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      });
      showToast('Product created successfully!');
    }
    
    resetAdminForm();
    loadAdminProducts();
    loadProducts();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editAdminProduct(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  
  document.getElementById('adminFormTitle').textContent = 'Edit Product';
  document.getElementById('adminProductId').value = product.id;
  document.getElementById('adminProductName').value = product.name;
  document.getElementById('adminProductDescription').value = product.description;
  document.getElementById('adminProductPrice').value = product.price;
  document.getElementById('adminProductImage').value = product.imageUrl || '';
  document.getElementById('adminProductStock').value = product.stock;
  document.getElementById('adminProductCategory').value = product.category;
  
  // Sustainability fields
  if (document.getElementById('adminProductEcoFriendly')) {
    document.getElementById('adminProductEcoFriendly').checked = product.isEcoFriendly;
    document.getElementById('adminProductCarbon').value = product.carbonFootprint;
    document.getElementById('adminProductPlastic').value = product.plasticContent;
    document.getElementById('adminProductRecyclable').checked = product.recyclable;
    document.getElementById('adminProductLocal').checked = product.locallySourced;
  }
  
  document.getElementById('adminFormBtnText').textContent = 'Update Product';
  document.getElementById('adminCancelBtn').style.display = 'block';
  
  if (product.imageUrl) {
    previewImage();
  }
  
  document.getElementById('adminProductForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteAdminProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  try {
    await apiCall(`/products/${productId}`, { method: 'DELETE' });
    showToast('Product deleted successfully!');
    loadAdminProducts();
    loadProducts();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function resetAdminForm() {
  document.getElementById('adminProductForm').reset();
  document.getElementById('adminFormTitle').textContent = 'Add New Product';
  document.getElementById('adminProductId').value = '';
  document.getElementById('adminFormBtnText').textContent = 'Add Product';
  document.getElementById('adminCancelBtn').style.display = 'none';
  document.getElementById('imagePreview').style.display = 'none';
}

// Sustainability Functions
async function loadSustainabilityDashboard() {
  if (!state.token) return;
  
  try {
    const dashboard = await apiCall('/sustainability/dashboard');
    state.sustainabilityData = dashboard;
    
    const preferences = await apiCall('/sustainability/preferences');
    const leaderboard = await apiCall('/sustainability/leaderboard');
    
    await loadCartImpact();
    
    renderSustainabilityDashboard(dashboard, preferences, leaderboard);
  } catch (error) {
    console.error('Failed to load sustainability dashboard:', error);
    showToast('Failed to load sustainability data', 'error');
  }
}

function renderSustainabilityDashboard(dashboard, preferences, leaderboard) {
  document.getElementById('co2Saved').textContent = `${dashboard.totalCO2Saved.toFixed(1)} kg`;
  document.getElementById('plasticSaved').textContent = `${dashboard.totalPlasticSaved.toFixed(0)} g`;
  document.getElementById('greenPoints').textContent = dashboard.greenPoints;
  document.getElementById('userRank').textContent = `#${dashboard.globalRank}`;
  
  document.getElementById('packagingPref').value = preferences.packagingPreference;
  document.getElementById('notifyGreenDeals').checked = preferences.notifyGreenDeals;
  document.getElementById('showCarbonFootprint').checked = preferences.showCarbonFootprint;
  
  renderLeaderboard(leaderboard);
}

async function loadCartImpact() {
  if (!state.token) return;
  
  try {
    const impact = await apiCall('/sustainability/cart-impact');
    state.cartImpact = impact;
    renderCartImpact(impact);
  } catch (error) {
    console.error('Failed to load cart impact:', error);
  }
}

function renderCartImpact(impact) {
  const container = document.getElementById('cartImpact');
  
  if (!impact || impact.totalItems === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">Your cart is empty. Add products to see environmental impact!</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="cart-impact-display">
      <div class="impact-metric">
        <div class="impact-metric-value">${impact.totalCO2} kg</div>
        <div class="impact-metric-label">CO₂ Footprint</div>
      </div>
      
      <div class="impact-metric">
        <div class="impact-metric-value">${impact.totalPlastic} g</div>
        <div class="impact-metric-label">Plastic Content</div>
      </div>
      
      <div class="impact-metric">
        <div class="impact-metric-value">${impact.ecoFriendlyItems}/${impact.totalItems}</div>
        <div class="impact-metric-label">Eco-Friendly Items</div>
      </div>
      
      <div class="impact-metric">
        <div class="impact-metric-value">${impact.ecoPercentage}%</div>
        <div class="impact-metric-label">Eco Score</div>
      </div>
      
      <div class="impact-metric">
        <div class="impact-metric-value" style="color: #4caf50;">+${impact.potentialGreenPoints}</div>
        <div class="impact-metric-label">Potential Green Points</div>
      </div>
    </div>
  `;
}

function renderLeaderboard(leaderboard) {
  const container = document.getElementById('leaderboard');
  
  if (leaderboard.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No data yet. Be the first green champion!</p>';
    return;
  }
  
  container.innerHTML = leaderboard.map((user, index) => `
    <div class="leaderboard-item">
      <div class="leaderboard-rank">${getRankEmoji(index + 1)}${index + 1}</div>
      <div class="leaderboard-name">${user.name}</div>
      <div class="leaderboard-stats">
        <div class="leaderboard-points">⭐ ${user.greenPoints} pts</div>
        <div style="font-size: 0.85rem; color: #666;">
          🌍 ${user.totalCO2Saved.toFixed(1)} kg CO₂ | ♻️ ${user.totalPlasticSaved.toFixed(0)} g plastic
        </div>
      </div>
    </div>
  `).join('');
}

function getRankEmoji(rank) {
  if (rank === 1) return '🥇 ';
  if (rank === 2) return '🥈 ';
  if (rank === 3) return '🥉 ';
  return '';
}

async function handleSustainabilityPreferences(e) {
  e.preventDefault();
  
  const preferences = {
    packagingPreference: document.getElementById('packagingPref').value,
    notifyGreenDeals: document.getElementById('notifyGreenDeals').checked,
    showCarbonFootprint: document.getElementById('showCarbonFootprint').checked
  };
  
  try {
    await apiCall('/sustainability/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
    
    showToast('Preferences saved! 🌱');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Make functions globally available
window.navigateTo = navigateTo;
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;
window.cancelOrder = cancelOrder;
window.editAdminProduct = editAdminProduct;
window.deleteAdminProduct = deleteAdminProduct;
window.loadCartImpact = loadCartImpact;