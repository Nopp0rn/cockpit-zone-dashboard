# คู่มือ Deploy "Cockpit Zone Intelligence" (ละเอียดทีละขั้นตอน)

## เกี่ยวกับ "API"
แอปนี้**ไม่มีและไม่ต้องมี** backend API ของตัวเอง — เป็น React app (Vite) ล้วนๆ ที่รันในเบราว์เซอร์
แล้วเรียก Supabase โดยตรงผ่าน JavaScript SDK (`@supabase/supabase-js`) โดยใช้ Project URL +
publishable key ที่ใส่ไว้ใน `src/supabase.js` แล้ว (project `ihacmeddgtszicmgvzqb`)
Supabase เป็นคนให้บริการ API เบื้องหลังให้เองอัตโนมัติ — ไม่ต้องเขียน API เพิ่ม ไม่ต้องมีโฟลเดอร์ `/api`
และไม่ต้องตั้งค่า environment variables ใดๆ บน Vercel (ค่าทุกอย่างที่จำเป็นอยู่ในโค้ดแล้ว)

ถ้า build error พูดถึง "API" แปลว่าเป็นปัญหาคนละเรื่อง (เช่น syntax error ในโค้ด) — แปะ error message
เต็มๆ มาดูได้เลย

---

## ขั้นที่ 1 — สร้าง GitHub Repo ใหม่ (ทำผ่านเว็บ ไม่ต้องใช้ git command)

1. เข้า [github.com](https://github.com) → ล็อกอิน
2. คลิกปุ่ม **+** มุมขวาบน → **New repository**
3. ตั้งชื่อ เช่น `cockpit-zone-dashboard`
4. เลือก **Private** (แนะนำ เพราะมีข้อมูลบริษัท)
5. **ไม่ต้อง** ติ๊ก "Add a README file" — ปล่อยว่างไว้
6. กด **Create repository**

### อัพโหลดไฟล์เข้า repo (วิธีลากวาง ไม่ต้องใช้ terminal)

1. ในหน้า repo ที่เพิ่งสร้าง จะเห็นข้อความ "Quick setup" → มองหาลิงก์ **uploading an existing file** แล้วคลิก
   (หรือ path: `github.com/<ชื่อคุณ>/cockpit-zone-dashboard` → ปุ่ม **Add file → Upload files**)
2. เปิดโฟลเดอร์ `cockpit-zone-dashboard` ที่แตกไฟล์ zip ไว้ในเครื่อง
3. **ลากทั้งโฟลเดอร์** (หรือเลือกไฟล์ทั้งหมดข้างในรวมทั้งโฟลเดอร์ `src/` และ `public/`) วางลงในหน้าเว็บ GitHub
   - GitHub เว็บรองรับการลากทั้งโฟลเดอร์ย่อยเข้าไปพร้อมกันได้ (โครงสร้างโฟลเดอร์จะถูกเก็บไว้)
   - ไฟล์ที่ต้องมีครบ: `index.html`, `package.json`, `vite.config.js`, `vercel.json`, `supabase_setup.sql`,
     โฟลเดอร์ `src/` (App.jsx, main.jsx, supabase.js, MorningBrief.jsx, index.css),
     โฟลเดอร์ `public/` (manifest.json, icons/)
4. เลื่อนลงล่างสุด ใส่ commit message เช่น `initial commit` → กด **Commit changes**
5. รอสักครู่ ไฟล์จะขึ้นครบใน repo — เช็คว่ามีโฟลเดอร์ `src` และ `public` จริงๆ (ไม่ใช่แค่ไฟล์ลอยๆ)

⚠️ จุดที่มักพลาด: ลากแค่ไฟล์ข้างในโฟลเดอร์ `src/` เข้าไปที่ root ของ repo โดยไม่มีโฟลเดอร์ `src/` ครอบ —
ถ้าเกิดแบบนี้ build จะหา `/src/main.jsx` ไม่เจอ (เพราะ `index.html` อ้างอิง path `/src/main.jsx`)
ให้ลบไฟล์ที่หลุดออกมา แล้วอัพโหลดใหม่โดยให้แน่ใจว่าโฟลเดอร์ `src` และ `public` ยังเป็นโฟลเดอร์อยู่ ไม่ถูกแตกไฟล์ออกมาที่ root

---

## ขั้นที่ 2 — Deploy บน Vercel

1. เข้า [vercel.com](https://vercel.com) → ล็อกอินด้วย GitHub account เดียวกัน
2. หน้า Dashboard → **Add New... → Project**
3. หา repo `cockpit-zone-dashboard` ในลิสต์ (ถ้าไม่เห็น กด **Adjust GitHub App Permissions** เพื่อให้ Vercel เข้าถึง repo นี้) → กด **Import**
4. หน้า Configure Project:
   - **Framework Preset**: ควรขึ้น "Vite" อัตโนมัติ (ถ้าไม่ขึ้น เลือกเองได้)
   - **Root Directory**: ปล่อยเป็น `./` (ค่า default) — **ห้าม** ตั้งเป็น `src`
   - **Build Command / Output Directory**: ปล่อยค่า default ไว้ (มี `vercel.json` กำหนดไว้ให้แล้วคือ `vite build` / `dist`)
   - **Environment Variables**: ไม่ต้องใส่อะไรเลย (ข้ามได้)
5. กด **Deploy**
6. รอ build (~1-2 นาที) → ถ้าขึ้น "Congratulations" แปลว่าสำเร็จ จะได้ URL เช่น `cockpit-zone-dashboard.vercel.app`

---

## ขั้นที่ 3 — รัน SQL setup ใน Supabase (ถ้ายังไม่ได้ทำ)

1. เข้า [supabase.com](https://supabase.com) → เปิด project `ihacmeddgtszicmgvzqb`
2. เมนูซ้าย → **SQL Editor** → **New query**
3. เปิดไฟล์ `supabase_setup.sql` ที่แนบมา → คัดลอกทั้งหมดวางในช่อง
4. กด **Run** → ควรเห็นข้อความ `Setup complete! Table app_data ready.`

---

## ขั้นที่ 4 — เปิดแอปครั้งแรก

เปิด URL ที่ Vercel ให้มา → จะเจอหน้า "ตั้งรหัสผ่าน" (เพราะ Supabase project ใหม่ยังไม่มีรหัสผ่านตั้งไว้)
ตั้งรหัสผ่านที่ต้องการได้เลย

---

## ถ้า Build Error

แปะ **ทั้งข้อความ error** (ไม่ใช่แค่ warning สีเหลือง) มาให้ดูได้เลย โดยทั่วไป error จะขึ้นเป็นสีแดง
และมักมีบรรทัด `Error:` หรือ `Failed to compile` ตามด้วยชื่อไฟล์/เลขบรรทัดที่มีปัญหา — จุดนั้นแหละที่ต้องแก้
