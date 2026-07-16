-- ════════════════════════════════════════════════════════
--  COCKPIT ZONE DASHBOARD (แอปใหม่ แยกจากแอปเดิม) — Supabase SQL Setup
--  รัน script นี้ใน Supabase → SQL Editor → Run
-- ════════════════════════════════════════════════════════

-- 1. สร้างตาราง app_data (key-value store)
CREATE TABLE IF NOT EXISTS public.app_data (
  key        TEXT PRIMARY KEY,
  value      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. เปิด Row-Level Security (อนุญาตทุกคนอ่าน/เขียน — internal use)
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON public.app_data
  FOR ALL USING (true) WITH CHECK (true);

-- 3. เปิด Realtime (ทุกเครื่องเห็นพร้อมกัน)
ALTER TABLE public.app_data REPLICA IDENTITY FULL;

-- 4. เพิ่ม index เพื่อความเร็ว
CREATE INDEX IF NOT EXISTS idx_app_data_key ON public.app_data (key);

-- 5. ตรวจสอบ
-- 6. เพิ่ม app_data เข้า Realtime publication (สำคัญ!)
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_data;

SELECT 'Setup complete! Table app_data ready.' AS status;
