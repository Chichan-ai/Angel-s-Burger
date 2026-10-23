(() => {
'use strict';

/* ------------------------------------------------------------------
   SETTINGS – edit values here only
------------------------------------------------------------------ */
const CONFIG = Object.freeze({
  ORDER_PHONE: '+639512862056',          // number that receives text orders
  DELIVERY_FEE_MIN: 30,
  DELIVERY_FEE_MAX: 150,
  MAX_QTY_PER_ITEM: 20,                  // blocks absurd quantities
  OPEN_HOUR: 10,                         // 10 AM (Philippine time)
  CLOSE_HOUR: 20,                        // 8 PM
  FB_URL: 'https://www.facebook.com/share/1HFL8ad2Cn/?mibextid=wwXIfr',
  TIKTOK_URL: '',
  INSTAGRAM_URL: '',
  MAX_LEN: Object.freeze({ name: 60, time: 40, address: 200, notes: 200 })
});

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const peso = v => '₱' + v;
const slugify = v => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* Strip control / invisible / bidi-override characters, collapse whitespace
   (also prevents fake extra lines in the SMS), trim and cap length. */
const clean = (value, max) =>
  String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2069\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/* Element builder – always uses textContent, never innerHTML. */
const el = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'data') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  kids.forEach(kid => node.append(kid));
  return node;
};

/* CSS custom properties set through the CSSOM (allowed by a strict CSP). */
$$('[data-op]').forEach(node => node.style.setProperty('--op', node.dataset.op));

/* ------------------------------------------------------------------
   Catalog (single source of truth for prices used by the cart)
------------------------------------------------------------------ */
const FRIES_SIZES = [
  { base: 'fries-regular', label: 'Regular', p: 20 },
  { base: 'fl',            label: 'Large',   p: 50 }
];
const FRIES_FLAVORS = ['regular', 'BBQ', 'Sour Cream', 'Cheese'];
const friesItems = FRIES_SIZES.flatMap(size =>
  FRIES_FLAVORS.map(flavor => ({
    id: `${size.base}-${slugify(flavor)}`,
    n: `Crispy Fries: ${size.label} (${flavor === 'regular' ? 'Plain' : flavor})`,
    c: 'Add-ons',
    p: size.p
  })));

const MIX_MAINS = Object.freeze({
  'burger-egg': 'Burger Egg',
  'burger-cheese': 'Burger Cheese',
  'siomai': '5 pcs Siomai'
});
const MIX_SIDES = Object.freeze({
  'large-fries': 'Large Fries',
  'soda-blue': 'Soda — Blue Lemonade',
  'soda-lychee': 'Soda — Lychee',
  'soda-green': 'Soda — Green Apple',
  'classic-nachos': 'Classic Nachos'
});
const MIX_PRICE = 99;

const itemsById = new Map();
const registerItem = item => {
  if (!item.id || !item.n || !Number.isInteger(item.p) || item.p <= 0) {
    console.warn('Skipped invalid menu item:', item);
    return;
  }
  if (itemsById.has(item.id)) {
    console.warn('Duplicate menu id ignored:', item.id);
    return;
  }
  itemsById.set(item.id, Object.freeze({ ...item }));
};

$$('.card').forEach(card => {
  const sizeButtons = $$('[data-add][data-order-name][data-price]', card);
  if (sizeButtons.length) {
    sizeButtons.forEach(b => registerItem({ id: b.dataset.add, n: b.dataset.orderName, c: card.dataset.c, p: Number(b.dataset.price) }));
  } else {
    registerItem({ id: card.dataset.id, n: card.dataset.n, c: card.dataset.c, p: Number(card.dataset.p) });
  }
  const price = $('.price', card);
  if (price && card.dataset.p) price.textContent = peso(Number(card.dataset.p));
});
friesItems.forEach(registerItem);

/* ------------------------------------------------------------------
   Categories / menu routing
------------------------------------------------------------------ */
const grid = $('#dishes'), categoryView = $('#category-view'), productsView = $('#products-view'), mixBuilder = $('#mix-builder');
/* Stock photos: Unsplash; drink photo by ROMAN ODINTSOV via Pexels. */
const categories = [
  { name: 'Burger',        slug: 'burger',        image: 'assets/category-burgers.jpg' },
  { name: 'Drinks',        slug: 'drinks',        image: 'assets/category-drinks.jpg' },
  { name: 'Combos',        slug: 'combos',        image: 'assets/category-combos.jpg' },
  { name: 'Special',       slug: 'special',       image: 'assets/category-special.jpg' },
  { name: 'Mix and Match', slug: 'mix-and-match', image: 'assets/category-mix-match.jpg' },
  { name: 'Add-ons',       slug: 'add-ons',       image: 'assets/category-add-ons.jpg' }
];

categories.forEach(c => {
  const tile = el('button', { type: 'button', class: 'category-tile', 'aria-label': `View ${c.name} menu`, data: { category: c.name } },
    el('span', { class: 'category-art', 'aria-hidden': 'true' }, el('img', { src: c.image, alt: '' })),
    el('span', { text: c.name }));
  tile.addEventListener('click', () => {
    history.pushState(null, '', `#menu/${c.slug}`);
    showCategory(c);
    $('#menu').scrollIntoView();
  });
  categoryView.append(tile);
});

function showCategory(category) {
  categoryView.hidden = true;
  productsView.hidden = false;
  $('#category-title').textContent = category.name;
  let count = 0;
  $$('.card', grid).forEach(card => {
    const match = card.dataset.c === category.name;
    card.classList.toggle('hide', !match);
    if (match) { count++; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
  });
  mixBuilder.hidden = category.name !== 'Mix and Match';
  $('#category-empty').hidden = count > 0 || category.name === 'Mix and Match';
}
function showCategories() { categoryView.hidden = false; productsView.hidden = true; }
function syncMenuRoute() {
  const slug = location.hash.startsWith('#menu/') ? location.hash.slice(6) : '';
  const category = categories.find(c => c.slug === slug);   // whitelist match only
  if (category) showCategory(category); else showCategories();
}
$('#back-categories').addEventListener('click', () => {
  history.pushState(null, '', '#menu');
  showCategories();
  $('#menu').scrollIntoView();
});
addEventListener('popstate', syncMenuRoute);
addEventListener('hashchange', syncMenuRoute);
syncMenuRoute();

/* ------------------------------------------------------------------
   Cart
------------------------------------------------------------------ */
const cart = Object.create(null);   // no prototype => no "__proto__" tricks
const toast = m => {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1600);
};

function addToCart(id) {
  const item = itemsById.get(id);
  if (!item) return false;                                   // unknown id => ignored
  if ((cart[id] || 0) >= CONFIG.MAX_QTY_PER_ITEM) {
    toast(`Maximum of ${CONFIG.MAX_QTY_PER_ITEM} per item`);
    return false;
  }
  cart[id] = (cart[id] || 0) + 1;
  return item;
}

function render() {
  const rows = [...itemsById.values()].filter(i => cart[i.id]);
  const lines = $('#lines');
  if (rows.length) {
    lines.replaceChildren(...rows.map(i => el('li', {},
      el('span', { class: 'nm' }, document.createTextNode(i.n), el('br'), el('small', { class: 'each', text: `${peso(i.p)} each` })),
      el('span', { class: 'q' },
        el('button', { type: 'button', 'data-q': `${i.id}:-1`, 'aria-label': `Remove one ${i.n}`, text: '−' }),
        el('b', { text: String(cart[i.id]) }),
        el('button', { type: 'button', 'data-q': `${i.id}:1`, 'aria-label': `Add one ${i.n}`, text: '+' })))));
  } else {
    lines.replaceChildren(el('li', { class: 'empty', text: 'Your order is empty. Add items from the menu.' }));
  }
  const subtotal = rows.reduce((s, i) => s + i.p * cart[i.id], 0);
  const n = rows.reduce((s, i) => s + cart[i.id], 0);
  const delivery = $('#fulfillment').value === 'delivery';
  const { DELIVERY_FEE_MIN: min, DELIVERY_FEE_MAX: max } = CONFIG;
  $('#subtotal').textContent = peso(subtotal);
  $('#delivery-row').hidden = !delivery;
  $('#delivery-note').hidden = !delivery;
  $('#delivery-fee').textContent = delivery ? `${peso(min)}–${peso(max)}` : '';
  $('#total-label').textContent = delivery ? 'Estimated total' : 'Total';
  $('#tot').textContent = delivery ? `${peso(subtotal + min)}–${peso(subtotal + max)}` : peso(subtotal);
  $('#fc').textContent = n;
  $('#fab').classList.toggle('show', n > 0);
  return { subtotal, total: subtotal, delivery, rows };
}

function updateFulfillment() {
  const delivery = $('#fulfillment').value === 'delivery', address = $('#delivery-address');
  $('#delivery-address-wrap').hidden = !delivery;
  $('#delivery-row').hidden = !delivery;
  if (!delivery) { address.setAttribute('aria-invalid', 'false'); address.nextElementSibling.textContent = ''; }
  render();
}
$('#fulfillment').addEventListener('change', updateFulfillment);

document.addEventListener('click', e => {
  const addBtn = e.target.closest('[data-add]'), qBtn = e.target.closest('[data-q]'), mixBtn = e.target.closest('#add-mix');

  if (addBtn) {
    let id = addBtn.dataset.add, label = '';
    if (id === 'fries-regular' || id === 'fl') {
      const picked = addBtn.closest('.fbtns, .row')?.querySelector('.fries-flavor')?.value;
      const flavor = FRIES_FLAVORS.includes(picked) ? picked : 'regular';   // whitelist
      id = `${id}-${slugify(flavor)}`;
    }
    const item = addToCart(id);
    if (item) { render(); toast(`Added ${item.n}`); }
  }

  if (mixBtn) {
    const main = $('#mix-main').value, side = $('#mix-side').value;
    if (!(main in MIX_MAINS) || !(side in MIX_SIDES)) { toast('Please pick a valid combo'); return; }
    const id = `mix-${main}-${side}`;
    registerItem({ id, n: `Mix & Match: ${MIX_MAINS[main]} + ${MIX_SIDES[side]}`, c: 'Mix and Match', p: MIX_PRICE });
    if (addToCart(id)) { render(); toast('Mix & Match combo added'); }
  }

  if (qBtn) {
    const [id, d] = qBtn.dataset.q.split(':');
    const delta = d === '1' ? 1 : d === '-1' ? -1 : 0;
    if (!itemsById.has(id) || !delta) return;
    if (delta > 0) addToCart(id);
    else { cart[id] = Math.max(0, (cart[id] || 0) - 1); if (!cart[id]) delete cart[id]; }
    render();
  }
});

/* ------------------------------------------------------------------
   Build + send the SMS (nothing leaves the device until the user sends)
------------------------------------------------------------------ */
function buildMessage() {
  const { subtotal, total, delivery, rows } = render();
  if (!rows.length) { toast('Add at least one item first'); return null; }

  const fields = {
    name:    { node: $('#nm'), max: CONFIG.MAX_LEN.name },
    time:    { node: $('#pk'), max: CONFIG.MAX_LEN.time },
    address: { node: $('#delivery-address'), max: CONFIG.MAX_LEN.address },
    notes:   { node: $('#nt'), max: CONFIG.MAX_LEN.notes }
  };
  const v = {};
  for (const [k, f] of Object.entries(fields)) v[k] = clean(f.node.value, f.max);

  const required = [fields.name.node, fields.time.node, ...(delivery ? [fields.address.node] : [])];
  required.forEach(node => {
    const ok = !!clean(node.value, 999);
    node.setAttribute('aria-invalid', String(!ok));
    node.nextElementSibling.textContent = ok ? '' : 'Required.';
  });
  const invalid = required.find(node => !clean(node.value, 999));
  if (invalid) { invalid.focus(); return null; }

  const { DELIVERY_FEE_MIN: min, DELIVERY_FEE_MAX: max } = CONFIG;
  const lines = rows.map(i => `${cart[i.id]}x ${i.n} (${peso(i.p * cart[i.id])})`).join('\n');
  const feeLine = delivery ? `\nDelivery fee: ${peso(min)}–${peso(max)} (depends on location and distance)` : '';
  const totalLine = delivery
    ? `Estimated total: ${peso(subtotal + min)}–${peso(subtotal + max)} (final fee and total to be confirmed by the shop)`
    : `Total: ${peso(total)}`;
  return `Hello Angels Homemade Burger! Pre-order:\n${lines}\nItems subtotal: ${peso(subtotal)}${feeLine}\n${totalLine}\n` +
         `Name: ${v.name}\nOrder method: ${delivery ? 'Delivery' : 'Pickup'}\nPreferred time: ${v.time}` +
         `${delivery ? `\nDelivery address: ${v.address}` : ''}${v.notes ? `\nNotes: ${v.notes}` : ''}`;
}

$('#of').addEventListener('submit', e => {
  e.preventDefault();
  const m = buildMessage();
  if (!m) return;
  const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  location.href = `sms:${CONFIG.ORDER_PHONE}${isApple ? '&' : '?'}body=${encodeURIComponent(m)}`;
});

/* ------------------------------------------------------------------
   Social links (profile URLs are validated before use)
------------------------------------------------------------------ */
const socialIcon = (name) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  if (name === 'Facebook') {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.6V13h2.7v8h3.2z');
    svg.append(path);
  } else if (name === 'Instagram') {
    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    frame.setAttribute('x', '3'); frame.setAttribute('y', '3');
    frame.setAttribute('width', '18'); frame.setAttribute('height', '18');
    frame.setAttribute('rx', '5');
    const lens = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    lens.setAttribute('cx', '12'); lens.setAttribute('cy', '12'); lens.setAttribute('r', '4');
    const flash = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    flash.setAttribute('cx', '17.5'); flash.setAttribute('cy', '6.5'); flash.setAttribute('r', '1');
    [frame, lens, flash].forEach(shape => {
      shape.setAttribute('fill', 'none');
      shape.setAttribute('stroke', 'currentColor');
      shape.setAttribute('stroke-width', '2');
      svg.append(shape);
    });
  } else {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19.6 6.7a4.8 4.8 0 0 1-3.2-4.5h-3.5v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a7 7 0 1 0 5.5 6.8V9.1a8.3 8.3 0 0 0 4.8 1.5V7.1a4.8 4.8 0 0 1-1.6-.4z');
    svg.append(path);
  }
  return svg;
};

[
  { name: 'Facebook', url: CONFIG.FB_URL, host: /(^|\.)facebook\.com$/ },
  { name: 'TikTok', url: CONFIG.TIKTOK_URL, host: /(^|\.)tiktok\.com$/ },
  { name: 'Instagram', url: CONFIG.INSTAGRAM_URL, host: /(^|\.)instagram\.com$/ }
].forEach(({ name, url, host }) => {
  let href = '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && host.test(parsed.hostname)) href = parsed.href;
  } catch { /* URL is not configured yet. */ }

  const link = el(href ? 'a' : 'span', {
    class: `social-link social-${name.toLowerCase()}${href ? '' : ' is-unset'}`,
    ...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : {}),
    'aria-label': href ? `Follow us on ${name}` : `${name} profile link not configured`
  }, socialIcon(name));
  $('#social-links').append(link);
});
render();

/* ------------------------------------------------------------------
   Open / closed badge (Philippine time)
------------------------------------------------------------------ */
const hour12 = h => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
function openState() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
  const t = (Number(parts.find(x => x.type === 'hour').value) % 24) + Number(parts.find(x => x.type === 'minute').value) / 60;
  const isOpen = t >= CONFIG.OPEN_HOUR && t < CONFIG.CLOSE_HOUR, badge = $('#openNow');
  badge.classList.toggle('closed', !isOpen);
  $('span', badge).textContent = isOpen ? `Open now · until ${hour12(CONFIG.CLOSE_HOUR)}` : `Closed now · opens ${hour12(CONFIG.OPEN_HOUR)}`;
}
openState();
setInterval(openState, 60000);

/* ------------------------------------------------------------------
   Photo viewer (same-origin images only)
------------------------------------------------------------------ */
const lb = $('#lb');
document.addEventListener('click', e => {
  const im = e.target.closest('.pic img[src],.fcard img,.mix-reference');
  if (im) {
    let sameOrigin = false;
    try { sameOrigin = new URL(im.src, location.href).origin === location.origin; } catch { /* ignore */ }
    if (!sameOrigin) return;
    $('img', lb).src = im.src;
    $('img', lb).alt = im.alt;
    lb.showModal();
  } else if (e.target === lb || e.target.closest('[data-close-lb]')) {
    lb.close();
  }
});

/* ------------------------------------------------------------------
   Navigation, dialogs, reveal-on-scroll
------------------------------------------------------------------ */
const hd = $('header'), bu = $('.burger'), ln = $('#links');
addEventListener('scroll', () => hd.classList.toggle('solid', scrollY > 40), { passive: true });
const closeMenu = () => { ln.classList.remove('open'); bu.setAttribute('aria-expanded', 'false'); bu.setAttribute('aria-label', 'Open menu'); };
bu.addEventListener('click', () => {
  const o = ln.classList.toggle('open');
  bu.setAttribute('aria-expanded', String(o));
  bu.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
});
$$('a', ln).forEach(a => a.addEventListener('click', closeMenu));

const od = $('#order-dialog');
$$('[data-open-order]').forEach(node => node.addEventListener('click', e => { e.preventDefault(); if (!od.open) od.showModal(); }));
$('[data-close-order]').addEventListener('click', () => od.close());
$('#cancel-order').addEventListener('click', () => od.close());
od.addEventListener('click', e => { if (e.target === od) od.close(); });

const io = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
}), { threshold: .15 });
$$('.rv').forEach(node => io.observe(node));
})();
