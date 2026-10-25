'use strict';
// واجهة المتجر — السلة والمفضلة

// =====================================================================
//  السلة والمفضلة
// =====================================================================
function updateCartBadge() {
  const count = S.quote.count;
  const badge = $('#cartBadge');
  badge.textContent = count > 99 ? '99+' : String(count);
  $('#cartTotal').innerHTML = money(S.quote.subtotal);
}

async function refreshCart() {
  const seq = ++S.quoteSeq;
  if (!S.cart.length) {
    S.quote = { lines: [], count: 0, subtotal: 0 };
    updateCartBadge();
    return S.quote;
  }
  try {
    const q = await api('POST', '/api/cart/quote', { items: S.cart });
    if (seq !== S.quoteSeq) return S.quote;
    S.quote = q;
    // نحذف من السلة المنتجات اللي انحذفت من المتجر ونضبط الكميات
    const before = JSON.stringify(S.cart);
    S.cart = S.cart
      .filter((x) => q.lines.some((l) => l.id === x.id))
      .map((x) => {
        const l = q.lines.find((y) => y.id === x.id);
        return { id: x.id, qty: l.inStock ? l.qty : x.qty };
      });
    if (JSON.stringify(S.cart) !== before) store.set('cart', S.cart);
  } catch { /* نخلي آخر قيمة */ }
  updateCartBadge();
  return S.quote;
}

function saveCart() {
  store.set('cart', S.cart);
  return refreshCart();
}

function addToCart(id, qty = 1) {
  const it = S.cart.find((x) => x.id === id);
  if (it) it.qty = Math.min(99, it.qty + qty);
  else S.cart.push({ id, qty: Math.min(99, qty) });
  toast('تمت الإضافة إلى السلة');
  const badge = $('#cartBadge');
  badge.classList.remove('bump');
  void badge.offsetWidth;
  badge.classList.add('bump');
  return saveCart();
}

function toggleWish(id, btn) {
  const on = !S.wish.includes(id);
  S.wish = on ? [...S.wish, id] : S.wish.filter((x) => x !== id);
  store.set('wish', S.wish);
  $$(`[data-wish="${CSS.escape(id)}"]`).forEach((b) => b.classList.toggle('on', on));
  if (btn) btn.classList.toggle('on', on);
  toast(on ? 'أضيف إلى المفضلة' : 'أزيل من المفضلة');
}
