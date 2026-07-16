// ════════════════════════════════════════════════════════
//  SUPABASE CONFIG — Cockpit Zone Dashboard (แอปใหม่ แยกจาก Cockpit Sales Intelligence เดิม)
//  Project: ihacmeddgtszicmgvzqb
//
//  ก่อน deploy อย่าลืม: รัน supabase_setup.sql ใน SQL Editor ของ project นี้
//  (สร้างตาราง app_data + เปิด Realtime) ถ้ายังไม่ได้รัน
// ════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ihacmeddgtszicmgvzqb.supabase.co'
const SUPABASE_KEY = 'sb_publishable_aA_7s-n44pyX0OL_vOOuww_SyEBvYaG'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
