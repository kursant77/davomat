# Davomat — O'quv Markazi Davomat Tizimi

Ushbu loyiha o'quv markazlarida talabalar davomatini nazorat qilish va avtomatlashtirilgan SMS xabarnomalar yuborish uchun mo'ljallangan.

## Texnologiyalar
- **Frontend:** React (Vite), TailwindCSS, React Router, React Hot Toast
- **Backend:** Supabase (Auth, PostgreSQL, Edge Functions)
- **SMS:** Eskiz.uz API

## O'rnatish yo'riqnomasi

### 1. Loyihani yuklash
Loyiha papkasiga kiring:
```bash
cd Davomat
npm install
```

### 2. Supabase sozlamalari
1. Supabase loyihasini yarating.
2. `supabase_schema.sql` faylidagi SQL kodni Supabase SQL Editor-da ishga tushiring.
3. Loyiha sozlamalaridan `URL` va `anon key`ni oling.

### 3. Muhit o'zgaruvchilari
`.env` faylini yarating va quyidagi ma'lumotlarni to'ldiring:
```env
VITE_SUPABASE_URL=loyiha_url
VITE_SUPABASE_ANON_KEY=anon_key
VITE_ESKIZ_EMAIL=eskiz_email
VITE_ESKIZ_PASSWORD=eskiz_parol
```

### 4. Edge Function (SMS yuborish)
Agar SMS yubormoqchi bo'lsangiz:
1. `edge_function_code.ts` kodi bilan `sms-sender` nomli Supabase Edge Function yarating.
2. Eskiz ma'lumotlarini Supabase Secrets-ga qo'shing:
```bash
supabase secrets set ESKIZ_EMAIL=... ESKIZ_PASSWORD=...
```

### 5. Loyihani ishga tushirish
```bash
bash start.sh
# yoki
npm run dev
```

## Foydalanish
1. Admin foydalanuvchini Supabase Auth orqali qo'shing.
2. Login qiling.
3. Talabalar sahifasida talabalarni qo'shing.
4. Davomat sahifasida kundalik holatni belgilang va saqlang.
5. "SMS yuborish" tugmasini bosing.
# davomat
