const CONFIG = {
  storeName: "Vila Esfirra",
  whatsapp: "5511912345678",
  phoneDisplay: "(11) 91234-5678",
  address: "R. das Fornadas, 123 — Vila Madalena, São Paulo",
  addressUrl: "https://maps.google.com/?q=Vila+Madalena+S%C3%A3o+Paulo",
  deliveryFee: 6,
  foundedYear: "2018",
  dayNames: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  hours: {
    0: { open: 10, close: 15 },
    1: null,
    2: { open: 10, close: 22 },
    3: { open: 10, close: 22 },
    4: { open: 10, close: 22 },
    5: { open: 10, close: 22 },
    6: { open: 10, close: 22 }
  }
};

const PRODUCTS = [
  { id: "carne", name: "Carne temperada", emoji: "🥟", price: 4.5, category: "salgadas", desc: "Moída na hora com o tempero da avó Lúcia: hortelã, limão e cebola roxa.", tags: ["mais vendida"] },
  { id: "frango", name: "Frango com catupiry", emoji: "🍗", price: 5, category: "salgadas", desc: "Peito desfiado na panela com requeijão cremoso de verdade.", tags: [] },
  { id: "queijo", name: "Queijo três leites", emoji: "🧀", price: 4.5, category: "salgadas", desc: "Muçarela, provolone e parmesão gratinados na borda da massa.", tags: ["vegetariano"], veg: true },
  { id: "calabresa", name: "Calabresa e queijo", emoji: "🌶️", price: 5, category: "salgadas", desc: "Calabresa artesanal tostada no forno com muçarela e cheiro-verde.", tags: [] },
  { id: "pizza", name: "Pizza", emoji: "🍕", price: 4.5, category: "salgadas", desc: "Tomate, mussarela, orégano e um fio de azeite — favorita do fim de tarde.", tags: [], veg: true },
  { id: "escarola", name: "Escarola com bacon", emoji: "🥬", price: 5.5, category: "salgadas", desc: "Escarola refogada no alho, bacon crocante e um toque de pimenta.", tags: ["novo"] },
  { id: "doce-morango", name: "Chocolate com morango", emoji: "🍫", price: 5.5, category: "doces", desc: "Chocolate ao leite derretido, morangos picados e açúcar de confeiteiro.", tags: ["novo"] },
  { id: "doce-banana", name: "Banana com canela", emoji: "🍌", price: 5, category: "doces", desc: "Banana caramelizada, canela do Ceilão e um fio de mel.", tags: [] },
  { id: "doce-rj", name: "Romeu e Julieta", emoji: "🍯", price: 5.5, category: "doces", desc: "Goiabada cascão derretida com queijo minas curado.", tags: [], veg: true },
  { id: "combo-dezena-carne", name: "Dezena de carne", emoji: "📦", price: 48, category: "combos", desc: "12 minis de carne temperada. Quem leva, volta pra repetir.", tags: ["economize 12%"] },
  { id: "combo-dezena-mix", name: "Dezena variada", emoji: "🎁", price: 50, category: "combos", desc: "12 minis sortidas: carne, queijo, calabresa e pizza.", tags: ["queridinha das famílias"] },
  { id: "combo-party", name: "Kit festa 50 un.", emoji: "🎉", price: 175, category: "combos", desc: "50 minis variadas em caixa térmica. Para aniversário ou sexta da firma.", tags: ["encomende 24h antes"] },
  { id: "refri-lata", name: "Refrigerante lata", emoji: "🥤", price: 6, category: "bebidas", desc: "Cola ou guaraná, geladinho — 350 ml.", tags: [] },
  { id: "suco", name: "Suco de laranja natural", emoji: "🧃", price: 7, category: "bebidas", desc: "Espremido na hora, 500 ml, sem açúcar.", tags: [], veg: true },
  { id: "agua", name: "Água mineral", emoji: "💧", price: 3.5, category: "bebidas", desc: "Com gás ou sem gás, 500 ml.", tags: [] }
];

const CATEGORIES = [
  { id: "all", label: "Tudo" },
  { id: "salgadas", label: "🥟 Salgadas" },
  { id: "doces", label: "🍫 Doces" },
  { id: "combos", label: "📦 Combos" },
  { id: "bebidas", label: "🥤 Bebidas" }
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const state = {
  cart: new Map(),
  category: "all",
  search: "",
  fulfillment: "delivery"
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const el = {};

function grabElements() {
  el.header = $("#header");
  el.cartBtn = $("#btn-cart");
  el.badge = $("#cart-badge");
  el.grid = $("#product-grid");
  el.chips = $("#category-chips");
  el.search = $("#search-input");
  el.empty = $("#empty-msg");
  el.drawer = $("#cart-drawer");
  el.overlay = $("#overlay");
  el.cartItems = $("#cart-items");
  el.cartEmpty = $("#cart-empty");
  el.summary = $("#cart-summary");
  el.checkout = $("#btn-checkout");
  el.toastZone = $("#toast-zone");
  el.fab = $("#fab-cart");
  el.fabTotal = $("#fab-total");
  el.statusText = $("#status-text");
  el.heroStatus = $("#hero-status");
  el.footerStatus = $("#footer-status");
  el.hoursList = $("#hours-list");
  el.mobileNav = $("#mobile-nav");
  el.menuBtn = $("#btn-menu");
}

function saveCart() {
  localStorage.setItem("vila-esfirra-cart", JSON.stringify([...state.cart]));
}

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem("vila-esfirra-cart") || "[]");
    raw.forEach(([id, qty]) => {
      if (Number.isInteger(qty) && qty > 0 && PRODUCTS.some((p) => p.id === id)) {
        state.cart.set(id, qty);
      }
    });
  } catch {
    state.cart.clear();
  }
}

function cartEntries() {
  return [...state.cart]
    .map(([id, qty]) => ({ product: PRODUCTS.find((p) => p.id === id), qty }))
    .filter((entry) => entry.product);
}

function cartCount() {
  return cartEntries().reduce((acc, entry) => acc + entry.qty, 0);
}

function cartSubtotal() {
  return cartEntries().reduce((acc, entry) => acc + entry.product.price * entry.qty, 0);
}

function cartIsOpen() {
  return !el.drawer.hidden;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  el.toastZone.appendChild(node);
  setTimeout(() => {
    node.classList.add("hide");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }, 2600);
}

function updateCartUI(bounce = false) {
  const count = cartCount();
  el.badge.hidden = count === 0;
  el.badge.textContent = count > 99 ? "99+" : count;
  if (bounce && count > 0) {
    el.cartBtn.classList.remove("bounce");
    void el.cartBtn.offsetWidth;
    el.cartBtn.classList.add("bounce");
  }

  el.cartItems.innerHTML = "";
  cartEntries().forEach(({ product, qty }, index) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    li.style.animationDelay = `${index * 40}ms`;
    li.dataset.id = product.id;
    li.innerHTML = `
      <span class="cart-item__emoji" aria-hidden="true">${product.emoji}</span>
      <div class="cart-item__info">
        <h4>${product.name}</h4>
        <span>${money.format(product.price)} · un.</span>
      </div>
      <div class="cart-item__qty">
        <button class="qty-btn" data-action="minus" aria-label="Diminuir quantidade de ${product.name}">−</button>
        <b aria-label="${qty} unidades">${qty}</b>
        <button class="qty-btn" data-action="plus" aria-label="Aumentar quantidade de ${product.name}">+</button>
        <button class="qty-btn qty-btn--remove" data-action="remove" aria-label="Remover ${product.name}">🗑</button>
      </div>`;
    el.cartItems.appendChild(li);
  });

  const hasItems = cartEntries().length > 0;
  el.cartEmpty.hidden = hasItems;
  el.summary.hidden = !hasItems;

  const sub = cartSubtotal();
  const fee = hasItems && state.fulfillment === "delivery" ? CONFIG.deliveryFee : 0;
  $("#total-sub").textContent = money.format(sub);
  $("#total-fee").textContent = fee ? money.format(fee) : "Grátis";
  $("#row-fee").style.display = state.fulfillment === "delivery" ? "flex" : "none";
  $("#total-grand").textContent = money.format(sub + fee);

  const fabOk = count > 0 && window.scrollY > 500 && !cartIsOpen();
  if (fabOk && el.fab.hidden) {
    el.fab.hidden = false;
    el.fab.style.animation = "";
  } else {
    el.fab.hidden = !fabOk;
  }
  el.fabTotal.textContent = money.format(sub + fee);
  saveCart();
}

function addToCart(id) {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return;
  state.cart.set(id, (state.cart.get(id) || 0) + 1);
  updateCartUI(true);
  toast(`${product.emoji} ${product.name} adicionada ao carrinho!`);
}

function changeQty(id, delta) {
  const next = (state.cart.get(id) || 0) + delta;
  if (next <= 0) state.cart.delete(id);
  else state.cart.set(id, next);
  updateCartUI();
}

function removeItem(id, li) {
  if (!li) {
    state.cart.delete(id);
    updateCartUI();
    return;
  }
  li.classList.add("remove");
  li.addEventListener("animationend", () => {
    state.cart.delete(id);
    updateCartUI();
  }, { once: true });
}

function tagClass(tag) {
  if (/vég|veget|veg$/i.test(tag) || /economize/i.test(tag)) return tag.includes("economize") ? "tag" : "tag tag--veg";
  if (/novo/i.test(tag)) return "tag tag--new";
  return "tag";
}

function filteredProducts() {
  const query = state.search.trim().toLowerCase();
  if (!query) return PRODUCTS.filter((p) => state.category === "all" || p.category === state.category);
  return PRODUCTS.filter((p) => {
    const inCategory = state.category === "all" || p.category === state.category;
    const haystack = `${p.name} ${p.desc} ${p.category}`.toLowerCase();
    return inCategory && haystack.includes(query);
  });
}

function renderChips() {
  el.chips.innerHTML = "";
  CATEGORIES.forEach((cat, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip${state.category === cat.id ? " active" : ""}`;
    btn.textContent = cat.label;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(state.category === cat.id));
    btn.style.setProperty("--d", `${index * 50}ms`);
    btn.addEventListener("click", () => {
      state.category = cat.id;
      $$("button", el.chips).forEach((chip) => {
        const active = chip === btn;
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-selected", String(active));
      });
      renderProducts();
    });
    el.chips.appendChild(btn);
  });
  observeReveals(el.chips);
}

function renderProducts() {
  const items = filteredProducts();
  el.grid.innerHTML = "";
  el.empty.hidden = items.length > 0;
  items.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product reveal";
    card.style.setProperty("--d", `${Math.min(index, 8) * 60}ms`);
    card.innerHTML = `
      <span class="product__emoji" aria-hidden="true">${product.emoji}</span>
      <div class="product__tags">
        ${product.tags.filter(Boolean).map((tag) => `<span class="${tagClass(tag)}">${tag}</span>`).join("")}
      </div>
      <h3>${product.name}</h3>
      <p class="product__desc">${product.desc}</p>
      <div class="product__foot">
        <span class="product__price">${money.format(product.price)}</span>
        <button class="add-btn" data-add="${product.id}" aria-label="Adicionar ${product.name} ao carrinho" title="Adicionar ao carrinho">+</button>
      </div>`;
    el.grid.appendChild(card);
  });
  observeReveals(el.grid);
}

function openCart() {
  el.drawer.hidden = false;
  el.overlay.hidden = false;
  requestAnimationFrame(() => {
    el.drawer.classList.add("show");
    el.overlay.classList.add("show");
  });
  document.body.classList.add("no-scroll");
  el.cartBtn.setAttribute("aria-expanded", "true");
  el.fab.hidden = true;
}

function closeCart() {
  if (cartIsOpen()) {
    el.drawer.classList.remove("show");
    el.overlay.classList.remove("show");
    el.cartBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("no-scroll");
    setTimeout(() => {
      el.drawer.hidden = true;
      el.overlay.hidden = true;
    }, 380);
    updateCartUI();
  }
  el.mobileNav.classList.remove("open");
  el.menuBtn.classList.remove("open");
  el.menuBtn.setAttribute("aria-expanded", "false");
}

function closeMobileNav() {
  el.mobileNav.classList.remove("open");
  el.menuBtn.classList.remove("open");
  el.menuBtn.setAttribute("aria-expanded", "false");
  el.overlay.hidden = true;
  el.overlay.classList.remove("show");
  document.body.classList.remove("no-scroll");
}

function openMobileNav() {
  el.overlay.hidden = false;
  requestAnimationFrame(() => el.overlay.classList.add("show"));
  el.mobileNav.classList.add("open");
  el.menuBtn.classList.add("open");
  el.menuBtn.setAttribute("aria-expanded", "true");
  document.body.classList.add("no-scroll");
}

function buildWhatsAppLink(text) {
  return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
}

function checkout() {
  const entries = cartEntries();
  if (!entries.length) {
    toast("Seu carrinho está vazio 🙂");
    return;
  }
  const name = $("#input-name").value.trim();
  const isDelivery = state.fulfillment === "delivery";
  const address = $("#input-address").value.trim();
  if (!name) {
    toast("Preencha seu nome para continuar 🙏");
    $("#input-name").focus();
    return;
  }
  if (isDelivery && !address) {
    toast("Precisamos do endereço para a entrega 🛵");
    $("#input-address").focus();
    return;
  }
  const fee = isDelivery ? CONFIG.deliveryFee : 0;
  const payment = $("#input-payment").value;
  const notes = $("#input-notes").value.trim();
  const lines = [
    `*NOVO PEDIDO — ${CONFIG.storeName}* 🥟`,
    "",
    ...entries.map(
      ({ product, qty }) =>
        `• ${qty}x ${product.name} — ${money.format(product.price * qty)}`
    ),
    "",
    `Subtotal: ${money.format(cartSubtotal())}`,
    isDelivery ? `Entrega: ${money.format(fee)}` : "Retirada no balcão (grátis)",
    `*Total: ${money.format(cartSubtotal() + fee)}*`,
    `Pagamento: ${payment}`,
    "",
    `*Nome:* ${name}`,
    isDelivery ? `*Endereço:* ${address}` : `*Retirada:* ${CONFIG.address}`
  ];
  if (notes) lines.push(`*Observações:* ${notes}`);
  window.open(buildWhatsAppLink(lines.join("\n")), "_blank", "noopener");
}

function nextOpenLabel(now) {
  const day = now.getDay();
  const hourNow = now.getHours() + now.getMinutes() / 60;
  const today = CONFIG.hours[day];
  if (today && hourNow < today.open) return `abrimos hoje às ${today.open}h`;
  for (let i = 1; i <= 7; i++) {
    const target = CONFIG.hours[(day + i) % 7];
    if (target) {
      const dayName = CONFIG.dayNames[(day + i) % 7];
      return `abrimos ${i === 1 ? "amanhã" : dayName.toLowerCase()} às ${target.open}h`;
    }
  }
  return "";
}

function checkOpen() {
  const now = new Date();
  const today = CONFIG.hours[now.getDay()];
  const hourNow = now.getHours() + now.getMinutes() / 60;
  const isOpen = !!today && hourNow >= today.open && hourNow < today.close;
  const text = isOpen ? "Aberto agora — fornada saindo!" : `Fechado — ${nextOpenLabel(now)}`;
  el.statusText.textContent = text;
  el.heroStatus.classList.toggle("closed", !isOpen);
  el.footerStatus.textContent = isOpen ? "🟢 Aberto agora — peça já!" : `🔴 Fechado — ${nextOpenLabel(now)}`;
}

function renderHours() {
  el.hoursList.innerHTML = "";
  const today = new Date().getDay();
  CONFIG.dayNames.forEach((dayName, index) => {
    const hours = CONFIG.hours[index];
    const li = document.createElement("li");
    if (index === today) li.classList.add("today");
    const label = index === today ? `Hoje (${dayName})` : dayName;
    const value = hours ? `${hours.open}h – ${hours.close}h` : "fechado";
    li.innerHTML = `<span>${label}</span><span>${value}</span>`;
    el.hoursList.appendChild(li);
  });
}

let revealObserver = null;
function observeReveals(root = document) {
  if (!("IntersectionObserver" in window)) {
    $$(".reveal", root).forEach((node) => node.classList.add("in-view"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }
  $$(".reveal:not(.in-view)", root).forEach((node) => revealObserver.observe(node));
}

function initCounters() {
  const counters = $$(".stat [data-count]");
  if (!counters.length) return;
  const animate = (node) => {
    const target = Number(node.dataset.count);
    const suffix = node.dataset.suffix || "";
    const decimals = Number(node.dataset.decimal || 0);
    const format = (value) =>
      decimals
        ? (value / 10).toFixed(decimals).replace(".", ",")
        : Math.round(value).toLocaleString("pt-BR");
    const start = performance.now();
    const duration = 1800;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = format(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!("IntersectionObserver" in window)) {
    counters.forEach(animate);
    return;
  }
  const counterObserver = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  counters.forEach((node) => counterObserver.observe(node));
}

function initScrollHeader() {
  const onScroll = () => {
    el.header.classList.toggle("scrolled", window.scrollY > 10);
    if (cartCount() > 0 && !cartIsOpen()) {
      const show = window.scrollY > 500;
      if (show && el.fab.hidden) {
        el.fab.hidden = false;
        el.fab.style.animation = "";
        void el.fab.offsetWidth;
      } else if (!show) {
        el.fab.hidden = true;
      }
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function initScrollSpy() {
  if (!("IntersectionObserver" in window)) return;
  const navLinks = $$(".nav__link");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = `#${entry.target.id}`;
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === id);
        });
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  ["#inicio", "#cardapio", "#como", "#sobre", "#contato"].forEach((sel) => {
    const section = $(sel);
    if (section) observer.observe(section);
  });
}

function initMobileNav() {
  el.menuBtn.hidden = false;
  el.menuBtn.addEventListener("click", () => {
    if (el.mobileNav.classList.contains("open")) closeMobileNav();
    else openMobileNav();
  });
  $$(".mobile-nav__link", el.mobileNav).forEach((link) => link.addEventListener("click", closeMobileNav));
}

function initCartControls() {
  el.grid.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-add]");
    if (btn) addToCart(btn.dataset.add);
  });
  el.cartBtn.addEventListener("click", openCart);
  el.fab.addEventListener("click", openCart);
  $("#btn-cart-close").addEventListener("click", closeCart);
  el.overlay.addEventListener("click", () => {
    closeCart();
    closeMobileNav();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
      closeMobileNav();
    }
  });
  el.cartItems.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    const li = btn.closest(".cart-item");
    const { id } = li.dataset;
    if (btn.dataset.action === "plus") changeQty(id, 1);
    if (btn.dataset.action === "minus") changeQty(id, -1);
    if (btn.dataset.action === "remove") removeItem(id, li);
  });
  el.search.addEventListener("input", (event) => {
    state.search = event.target.value;
    renderProducts();
  });
  $$('input[name="fulfillment"]').forEach((radio) => {
    radio.checked = state.fulfillment === radio.value;
    radio.addEventListener("change", () => {
      state.fulfillment = radio.value;
      $("#field-address").hidden = state.fulfillment !== "delivery";
      const addressInput = $("#input-address");
      if (state.fulfillment === "delivery") addressInput.setAttribute("required", "");
      else addressInput.removeAttribute("required");
      updateCartUI();
    });
  });
  $("#field-address").hidden = state.fulfillment !== "delivery";
  el.checkout.addEventListener("click", (event) => {
    event.preventDefault();
    checkout();
  });
  $("#link-go-menu").addEventListener("click", () => setTimeout(closeCart, 60));
}

function initStaticLinks() {
  const heroWa = $("#hero-whatsapp");
  if (heroWa) heroWa.href = buildWhatsAppLink("Olá! Vim do site da Vila Esfirra e quero fazer um pedido 🥟");
  const contactWa = $("#footer-whatsapp");
  if (contactWa) {
    contactWa.href = buildWhatsAppLink("Olá! Vim do site da Vila Esfirra e quero fazer um pedido 🥟");
    contactWa.textContent = `💬 ${CONFIG.phoneDisplay}`;
  }
  const footerWa = $("#footer-wa-2");
  if (footerWa) {
    footerWa.href = buildWhatsAppLink("Olá! Vim do site da Vila Esfirra e quero fazer um pedido 🥟");
    footerWa.textContent = `WhatsApp: ${CONFIG.phoneDisplay}`;
  }
  ["#maps-link", "#footer-maps"].forEach((sel) => {
    const link = $(sel);
    if (link) link.href = CONFIG.addressUrl;
  });
  $("#footer-year").textContent = CONFIG.foundedYear;
  $("#footer-year-2").textContent = new Date().getFullYear();
}

function initInstall() {
  const buttons = ["#btn-install-header", "#btn-install-mobile", "#btn-install-contact", "#btn-install-footer"]
    .map((sel) => $(sel))
    .filter(Boolean);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (standalone) return;
  let deferredPrompt = null;
  const showButtons = () => buttons.forEach((btn) => (btn.hidden = false));
  const hideButtons = () => buttons.forEach((btn) => (btn.hidden = true));
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showButtons();
  });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    buttons.forEach((btn) => {
      btn.hidden = false;
      btn.textContent = "📲 Como instalar no iPhone";
      btn.addEventListener("click", () => {
        toast('Toque no botão Compartilhar e depois em "Adicionar à Tela de Início"');
      });
    });
  }
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!deferredPrompt) {
        toast("Instale pelo menu do navegador (⋮ → Instalar app) 🤙");
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") toast("App instalado! Veja o ícone na tela inicial 🤩");
      deferredPrompt = null;
      hideButtons();
    });
  });
  window.addEventListener("appinstalled", () => {
    toast("App instalado com sucesso! 🎉");
    hideButtons();
  });
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

grabElements();
loadCart();
initCartControls();
initStaticLinks();
renderChips();
renderProducts();
renderHours();
checkOpen();
setInterval(checkOpen, 60000);
initCounters();
initScrollHeader();
initScrollSpy();
initMobileNav();
initInstall();
initServiceWorker();
observeReveals();
updateCartUI();
