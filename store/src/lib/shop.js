'use strict';
// منطق المتجر المشترك بين الواجهة ولوحة التحكم

const ORDER_STATUSES = {
  pending_payment: 'بانتظار الدفع',
  under_review: 'بانتظار المراجعة',
  processing: 'قيد التنفيذ',
  completed: 'تم التنفيذ',
  cancelled: 'ملغي',
};

const PERMISSIONS = {
  orders: 'الطلبات',
  products: 'المنتجات',
  categories: 'قوائم المنتجات',
  customers: 'العملاء',
  media: 'مكتبة الصور',
  design: 'تعديل المتجر',
  admins: 'المشرفين',
};

function salePriceOf(p) {
  return p.salePrice !== null && p.salePrice !== undefined && p.salePrice < p.price ? p.salePrice : null;
}

function unitPrice(p) {
  const s = salePriceOf(p);
  return s === null ? p.price : s;
}

function inStock(p) {
  return p.quantity === null || p.quantity === undefined || p.quantity > 0;
}

function rating(p) {
  return p.ratingCount > 0 ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : null;
}

function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    shortDesc: p.shortDesc || '',
    price: p.price,
    salePrice: salePriceOf(p),
    images: p.images || [],
    categoryIds: p.categoryIds || [],
    inStock: inStock(p),
    left: p.quantity !== null && p.quantity !== undefined && p.quantity > 0 && p.quantity <= 5 ? p.quantity : null,
    rating: rating(p),
    ratingCount: p.ratingCount || 0,
    createdAt: p.createdAt,
  };
}

function publicSettings(s) {
  return {
    storeName: s.storeName,
    description: s.description,
    logo: s.logo,
    logoMode: s.logoMode,
    logoText: s.logoText,
    logoTextColor: s.logoTextColor,
    primaryColor: s.primaryColor,
    accentColor: s.accentColor,
    currency: s.currency,
    announcement: s.announcement,
    topLinks: s.topLinks,
    menu: s.menu,
    hero: s.hero,
    banners: s.banners,
    footer: s.footer,
    social: s.social,
    payment: { bankEnabled: s.payment.bankEnabled, instructions: s.payment.instructions },
    whatsappVerify: s.whatsappVerify !== false,
  };
}

function sortProducts(list, sort) {
  const arr = [...list];
  if (sort === 'price_asc') arr.sort((a, b) => unitPrice(a) - unitPrice(b));
  else if (sort === 'price_desc') arr.sort((a, b) => unitPrice(b) - unitPrice(a));
  else if (sort === 'best') arr.sort((a, b) => (b.sold || 0) - (a.sold || 0));
  else arr.sort((a, b) => b.createdAt - a.createdAt);
  // المنتجات المتوفرة أول
  return arr.sort((a, b) => Number(inStock(b)) - Number(inStock(a)));
}

const round2 = (n) => Math.round(n * 100) / 100;

// يرجّع الكمية للمخزون لما ينلغي الطلب
function restoreStock(products, order) {
  for (const it of order.items) {
    const p = products.find((x) => x.id === it.productId);
    if (!p) continue;
    if (p.quantity !== null && p.quantity !== undefined) p.quantity += it.qty;
    p.sold = Math.max(0, (p.sold || 0) - it.qty);
  }
}

function orderView(o, settings, { forAdmin = false } = {}) {
  const v = {
    id: o.id,
    status: o.status,
    statusLabel: ORDER_STATUSES[o.status] || o.status,
    items: o.items,
    subtotal: o.subtotal,
    total: o.total,
    note: o.note,
    reference: o.reference || '',
    history: o.history,
    createdAt: o.createdAt,
    customer: o.customer,
  };
  if (o.status === 'pending_payment' && settings.payment.bankEnabled) {
    v.bank = {
      bankName: settings.payment.bankName,
      accountName: settings.payment.accountName,
      iban: settings.payment.iban,
      instructions: settings.payment.instructions,
    };
  }
  if (forAdmin) {
    v.customerId = o.customerId;
    v.adminNote = o.adminNote || '';
  }
  return v;
}

module.exports = {
  ORDER_STATUSES, PERMISSIONS, salePriceOf, unitPrice, inStock, rating, publicProduct, publicSettings, sortProducts,
  orderView, restoreStock, round2,
};
