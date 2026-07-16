# คู่มือ Deploy "Cockpit Zone Intelligence" (แอปใหม่ แยกจากแอปเดิม 100%)

แอปนี้คือแอปเดียวกับ Cockpit Sales Intelligence แต่ปรับให้ครอบคลุม **86 สาขา / 9 เขต (AM)**
ทั้งบริษัท พร้อม dropdown เลือกเขตที่ header — และใช้ **Supabase project ใหม่แยกต่างหาก**
เพื่อไม่ให้ข้อมูลปนกับแอปส่วนตัวเดิมของคุณ

---

## 1) สร้าง Supabase Project ใหม่

1. ไปที่ [supabase.com](https://supabase.com) → New Project
2. ตั้งชื่อ เช่น `cockpit-zone-dashboard`, เลือก region ที่ใกล้ (Singapore แนะนำ)
3. รอ project สร้างเสร็จ (~2 นาที)
4. ไปที่ **SQL Editor** → วางเนื้อหาจากไฟล์ `supabase_setup.sql` ที่แนบมา → กด Run
5. ไปที่ **Settings → API**
   - คัดลอก **Project URL**
   - คัดลอก **publishable key** (ขึ้นต้นด้วย `sb_publishable_...` — ไม่ใช่ legacy anon/JWT key และไม่ใช่ service_role key)

## 2) ใส่ค่า Supabase ในโค้ด

เปิดไฟล์ `src/supabase.js` แล้วแทนที่:
```js
const SUPABASE_URL = 'https://YOUR-NEW-PROJECT-REF.supabase.co'
const SUPABASE_KEY = 'sb_publishable_YOUR_NEW_PUBLISHABLE_KEY'
```
ด้วยค่าจริงจากขั้นตอนที่ 1

## 3) สร้าง GitHub Repo ใหม่

1. ไปที่ GitHub → New repository → ตั้งชื่อ เช่น `cockpit-zone-dashboard`
2. อัพโหลดไฟล์ทั้งหมดในแพ็กเกจนี้เข้า repo (หรือ `git init` แล้ว push จากเครื่อง)
3. **ไม่ต้อง** copy จาก repo เดิม (`cockpit-dashboard`) — นี่คือโปรเจกต์ใหม่แยกกันสมบูรณ์

## 4) Deploy บน Vercel

1. ไปที่ [vercel.com](https://vercel.com) → New Project → เลือก repo ใหม่ที่เพิ่งสร้าง
2. Framework Preset: Vite (ควรตรวจจับอัตโนมัติ)
3. Build command: `vite build` (ค่า default) / Output dir: `dist`
4. กด Deploy

## 5) ตั้งรหัสผ่านแอปครั้งแรก

เข้าแอปครั้งแรกจะเจอหน้า "ตั้งรหัสผ่าน" (เพราะ Supabase project ใหม่ยังไม่มี `cp_auth`) —
ตั้งรหัสผ่านที่ต้องการได้เลย ระบบจะเก็บเป็น SHA-256 hash ไว้ใน Supabase project ใหม่นี้

⚠️ **Master key** (รหัสกุญแจสำหรับเปลี่ยนรหัสผ่านในหน้า Settings) ตอนนี้ยังใช้ค่าเดิมจากแอปหลัก
ถ้าต้องการให้แอปนี้มีผู้ดูแลระบบแยกจากแอปเดิม ให้แจ้ง Claude ให้เปลี่ยนค่า `MASTER_KEY_HASH` ใน `src/App.jsx`

## สิ่งที่ต่างจากแอปเดิม

- BRANCHES ครอบคลุม 86 สาขา / 9 เขต (Klodbavorn, Salisa, Nopporn, Siriya, Dutsanee, Patranon, Rungchai, Phuthipat, Poonnarat) พร้อม dropdown เลือกเขตที่ header (ค่าเริ่มต้น = ทุกเขต)
- มีแค่ **เป้า ก.ค. 2026** เป็นค่าเริ่มต้าน (SEED_T) — ไม่มีข้อมูลยอดขายจริง/ประวัติย้อนหลังฝังไว้เลย (ต่างจากแอปเดิมที่มีของ 10 สาขา Nopporn ฝังไว้)
- แต่ละเขตอัพโหลดข้อมูลของตัวเองผ่านแท็บ **Upload** ตามปกติ (ยอดขายรายวัน.xlsx, ยอดขายยางรายวัน.xlsx, ประวัติยอดขาย.xlsx, Target) — ระบบจับรหัสสาขาอัตโนมัติอยู่แล้ว ไม่ต้องแก้โค้ดเพิ่ม
- Auth/Entry/Overview/MTD/Tracker/ASP ฯลฯ ทำงานเหมือนแอปเดิมทุกอย่าง เพียงแต่ข้อมูลแยกกันคนละ Supabase project

## ไฟล์ในแพ็กเกจนี้

```
index.html
manifest.json          (ใน public/)
vite.config.js
package.json
supabase_setup.sql
src/
  main.jsx
  App.jsx
  MorningBrief.jsx
  supabase.js           ← ต้องแก้ URL/KEY ก่อน deploy
  index.css
public/
  manifest.json
  icons/                (โลโก้/มาสคอตชุดเดิม)
```
