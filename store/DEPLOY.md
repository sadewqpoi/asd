# نشر المتجر على Railway (أسهل طريقة)

> الاستضافة تكلّف مبلغاً صغيراً شهرياً (يُحسب حسب الاستخدام)، وهي أسهل خيار يحفظ بياناتك.
> الدومين: تقدر تستخدم الرابط المجاني اللي يعطيك إياه Railway، أو تربط دومينك لاحقاً.

## 1) ارفع المشروع على GitHub
1. أنشئ ريبو **Private** جديد على github.com.
2. ارفع كل محتويات هذا المجلد (ملف `.gitignore` يمنع رفع `.env` و `data/` تلقائياً).

## 2) انقل بياناتك (اختياري — لو تبي منتجاتك وطلباتك الحالية)
1. أنشئ مجلد باسم `seed-data` داخل المشروع.
2. انسخ فيه محتوى مجلد `data` (ملف `db.json` ومجلد `uploads`).
3. ارفع المجلد للريبو الـ Private. **احذفه من الريبو بعد أول تشغيل ناجح** (فيه بيانات عملاء).

> لو تبي تبدأ من الصفر، تجاوز هذي الخطوة.

## 3) أنشئ المشروع في Railway
1. ادخل railway.com وسجّل بحساب GitHub.
2. **New Project ← Deploy from GitHub repo** واختر الريبو.
3. من **Settings ← Volumes**: أضف Volume واجعل Mount path = `/data`.
4. من **Variables** أضف:
   ```
   DATA_DIR=/data
   COOKIE_SECURE=true
   TRUST_PROXY=1
   ```
   وإذا تبي الواتساب: `WHATSAPP_TOKEN` و `WHATSAPP_PHONE_NUMBER_ID` و `WHATSAPP_TEMPLATE` (وبقية متغيرات `.env.example`).
5. من **Settings ← Networking**: اضغط **Generate Domain** — هذا رابط متجرك.

## 4) أول دخول
- افتح **Deployments ← View Logs** وابحث عن **رمز الإعداد** (مثل `ABCD-1234`) لو بدأت من الصفر.
- ادخل `رابطك/admin` وأنشئ حساب المالك.

## 5) ربط دومينك الخاص
من **Settings ← Networking ← Custom Domain** اكتب دومينك، وأضف عند مسجّل الدومين السجل (CNAME) اللي يعطيك إياه Railway. الـ HTTPS يتفعّل تلقائياً.
