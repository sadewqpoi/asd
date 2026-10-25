'use strict';
// القيم الافتراضية للإعدادات وشكل قاعدة البيانات الفارغة

function defaultSettings() {
  return {
    storeName: 'MV9 STORE',
    description: 'متجر MV9 الرسمي — حزم وسيارات ومزايا حصرية لسيرفر MV9.',
    logo: '/img/logo.png',
    // شكل الشعار في هيدر المتجر: image | text | both
    logoMode: 'both',
    logoText: 'مَــأْذَنَــة',
    logoTextColor: '#0f4c52',
    // ألوان الثيم مأخوذة من الشعار: فيروزي + ذهبي
    primaryColor: '#0f4c52',
    accentColor: '#a8844a',
    currency: 'ر.س',
    announcement: { enabled: false, text: 'خصم 10% على جميع الحزم لفترة محدودة', link: '' },
    topLinks: [
      { label: 'الرئيسية', url: '/' },
      { label: 'الدسكورد', url: 'https://discord.gg/' },
      { label: 'تواصل معنا', url: '#footer' },
    ],
    menu: [],
    hero: {
      enabled: true,
      title: 'اهلا بكم في MV9 STORE',
      highlight: 'لي محبي التميز و الاثارة',
      text: 'نوفر لك مجموعة متميزة ومثيرة من الحزم الحصرية والخاصة لتناسب ذائقتك العالية، مع خيارات واسعة تناسب جميع الأوقات والظروف. بادر بالشراء لخوض المغامرات في المدينة.',
      buttonText: 'تصفح المنتجات المميزة الان',
      buttonLink: '#products',
      image: '/img/logo.png',
    },
    banners: [],
    // التحقق برمز واتساب عند إنشاء حساب وتسجيل دخول العملاء
    whatsappVerify: true,
    footer: {
      about: 'متجر MV9 الرسمي. كل المشتريات تُفعَّل داخل السيرفر بعد تأكيد الطلب.',
      copyright: 'جميع الحقوق محفوظة',
      showBrand: true,
      columns: [],
      email: '',
      phone: '',
      whatsapp: '',
    },
    social: { discord: '', x: '', instagram: '', tiktok: '', snapchat: '', youtube: '' },
    payment: {
      bankEnabled: true,
      bankName: '',
      accountName: '',
      iban: '',
      instructions: 'حوّل المبلغ على الحساب البنكي واكتب رقم الطلب في ملاحظة التحويل، وبعدها اضغط "أكّدت التحويل" واكتب اسم المحوّل أو رقم العملية.',
    },
  };
}

function emptyData() {
  return {
    version: 1,
    settings: defaultSettings(),
    categories: [],
    products: [],
    media: [],
    admins: [],
    customers: [],
    orders: [],
    ratings: [],
    pages: [],
    sessions: [],
    counters: { order: 10000 },
  };
}

module.exports = { defaultSettings, emptyData };
