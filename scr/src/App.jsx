import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase.js'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import {
  BarChart, Bar, ComposedChart, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import MorningBrief from './MorningBrief.jsx'

// Google Fonts loaded via index.html

/* ════════════════════════════════════════════════════════
   SUPABASE HELPERS
   ใช้ตาราง app_data (key TEXT, value JSONB)
════════════════════════════════════════════════════════ */
const DB = {
  get: async (key) => {
    const { data } = await supabase.from('app_data').select('value').eq('key', key).maybeSingle()
    return data?.value ?? null
  },
  set: async (key, val) => {
    const { error } = await supabase.from('app_data').upsert(
      { key, value: val, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) console.error('[DB.set] save failed:', key, error.message)
    return !error
  },
  listen: (onRow) => {
    return supabase.channel('cockpit_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, onRow)
      .subscribe()
  }
}

/* ── Mobile hook ── */
function useIsMobile() {
  // บังคับใช้ layout เดียวกันทุกแพลตฟอร์ม/ทุก orientation เสมอ
  // (iOS แนวตั้ง-แนวนอน, Android แนวตั้ง-แนวนอน, website, PC) — ไม่สลับ layout ตามขนาดจออีกต่อไป
  // ตามที่ผู้ใช้ขอให้ทุกระบบแสดงผลแบบเดียวกันหมด
  return true
}

/* ── Viewport breakpoint hook (ใช้กับ "เปลือก" แอปเท่านั้น: เมนู/หัว/ระยะขอบ)
   ไม่กระทบ layout ภายในของแต่ละการ์ด ที่ยังคงใช้ mobile=true เหมือนเดิม ── */
function useViewportMobile(bp = 900) {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < bp : false)
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp)
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [bp])
  return m
}

/* ════════════════════════════════════════════════════════
   STATIC DATA
════════════════════════════════════════════════════════ */
// ════ EXCEL DATA embedded from sales_data.xlsx + tire_sales.xlsx ════
const EXCEL_DS = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */
const EXCEL_DT = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */
const EXCEL_MS = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */
const EXCEL_MT = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */
const EXCEL_MT_ALL = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */
const EXCEL_DOWS={"003":{"1":{"0":79448.02,"1":77949.94,"2":78584.28,"3":76130.69,"4":81822.42,"5":117759.64,"6":150908.68},"2":{"0":79764.2,"1":84113.58,"2":91522.91,"3":75530.29,"4":78975.2,"5":144306.51,"6":161068.98},"3":{"0":82087.64,"1":83000.12,"2":56161.7,"3":69803.02,"4":57939.32,"5":107073.99,"6":100351.6},"4":{"0":71200.21,"1":66638.19,"2":65333.17,"3":90034.62,"4":80731.24,"5":116178.99,"6":107366.22},"5":{"0":77619.89,"1":66662.3,"2":87728.47,"3":83075.18,"4":73519.18,"5":115512.18,"6":96515.18},"6":{"0":75845.59,"1":59990.16,"2":68491.22,"3":51381.4,"4":64660.65,"5":96953.24,"6":116039.27}},"009":{"1":{"0":52350.79,"1":56759.86,"2":54026.59,"3":57609.86,"4":59960.51,"5":94423.02,"6":81329.06},"2":{"0":61039.36,"1":62503.03,"2":53893.67,"3":66781.37,"4":68912.21,"5":99718.99,"6":80801.26},"3":{"0":81243.84,"1":51213.27,"2":55592.3,"3":60035.06,"4":54860.5,"5":86547.06,"6":68667.22},"4":{"0":58079.09,"1":57706.7,"2":76038.62,"3":87409.34,"4":56754.61,"5":86271.57,"6":62176.53},"5":{"0":62747.89,"1":76175.49,"2":45986.65,"3":57101.59,"4":63831.47,"5":90770.2,"6":71676.7},"6":{"0":55473.17,"1":51203.33,"2":50977.08,"3":50366.71,"4":52935.59,"5":97539.2,"6":64289.62}},"010":{"1":{"0":75967.33,"1":68012.5,"2":74065.51,"3":75278.15,"4":69859.42,"5":106753.73,"6":66866.56},"2":{"0":56174.32,"1":77070.66,"2":67686.43,"3":74999.77,"4":74796.08,"5":91736.67,"6":96652.05},"3":{"0":75792.55,"1":55912.59,"2":68545.95,"3":55388.26,"4":61488.61,"5":96985.26,"6":83046.21},"4":{"0":79116.08,"1":67600.16,"2":68081.73,"3":78830.38,"4":74722.71,"5":89713.93,"6":68610.4},"5":{"0":79709.59,"1":90496.36,"2":78452.95,"3":62152.34,"4":67831.56,"5":95944.42,"6":61575.45},"6":{"0":77218.22,"1":48832.72,"2":59869.26,"3":71955.95,"4":57251.84,"5":94163.9,"6":67536.44}},"012":{"1":{"0":78972.07,"1":71370.87,"2":64308.63,"3":69511.67,"4":80529.17,"5":79051.75,"6":75199.91},"2":{"0":66488.14,"1":63230.09,"2":80880.55,"3":54745.23,"4":68654.93,"5":89524.61,"6":79795.78},"3":{"0":86181.13,"1":59717.62,"2":76198.42,"3":50102.37,"4":62561.72,"5":78674.7,"6":67294.48},"4":{"0":65181.04,"1":65886.01,"2":78920.24,"3":67529.95,"4":82835.81,"5":68803.68,"6":76130.35},"5":{"0":66350.03,"1":68599.82,"2":65522.34,"3":72794.95,"4":68667.98,"5":97416.19,"6":68285.17},"6":{"0":87782.77,"1":65746.94,"2":48330.38,"3":51322.04,"4":83210.9,"5":88482.47,"6":93253.59}},"014":{"1":{"0":76970.93,"1":60706.05,"2":50982.26,"3":70442.1,"4":91617.08,"5":92301.22,"6":89610.53},"2":{"0":60581.22,"1":68367.26,"2":79356.46,"3":75336.39,"4":71792.86,"5":104241.85,"6":74177.77},"3":{"0":68040.48,"1":67118.81,"2":63100.0,"3":60863.36,"4":63327.19,"5":93717.79,"6":54538.7},"4":{"0":68356.37,"1":71120.05,"2":69047.71,"3":92956.13,"4":62366.92,"5":77787.81,"6":78533.37},"5":{"0":53768.95,"1":63031.62,"2":69525.85,"3":98117.28,"4":84023.32,"5":77931.1,"6":59250.82},"6":{"0":69820.52,"1":48852.1,"2":43868.24,"3":49621.36,"4":73296.68,"5":96561.72,"6":70876.64}},"048":{"1":{"0":40789.22,"1":48281.33,"2":45043.49,"3":39615.13,"4":46720.73,"5":65917.9,"6":53007.11},"2":{"0":26830.27,"1":41436.29,"2":38816.33,"3":33792.61,"4":45672.66,"5":74605.43,"6":43486.11},"3":{"0":47557.52,"1":25012.42,"2":48867.89,"3":38800.57,"4":43700.47,"5":45563.73,"6":45489.33},"4":{"0":46367.17,"1":42941.15,"2":41872.78,"3":57329.02,"4":56169.36,"5":59818.66,"6":38720.53},"5":{"0":32102.29,"1":35571.12,"2":58000.54,"3":41815.6,"4":43789.08,"5":60029.35,"6":54866.66},"6":{"0":37357.87,"1":39454.26,"2":35258.37,"3":26017.62,"4":34557.23,"5":66159.37,"6":39011.41}},"050":{"1":{"0":58739.59,"1":40654.57,"2":52755.87,"3":46056.3,"4":51651.4,"5":69010.19,"6":55511.62},"2":{"0":55539.77,"1":44706.37,"2":54757.73,"3":43701.23,"4":53168.06,"5":82754.41,"6":65388.98},"3":{"0":66819.95,"1":48292.41,"2":42774.31,"3":40423.99,"4":61108.13,"5":68775.34,"6":53116.02},"4":{"0":49962.88,"1":39817.39,"2":54418.24,"3":49054.8,"4":69903.49,"5":78515.96,"6":59143.88},"5":{"0":36680.34,"1":52651.11,"2":37673.83,"3":34952.86,"4":66309.92,"5":81126.13,"6":54196.6},"6":{"0":46197.81,"1":43552.39,"2":40897.37,"3":45297.08,"4":52254.38,"5":74112.14,"6":45620.39}},"096":{"1":{"0":60463.51,"1":53100.29,"2":38203.94,"3":34135.99,"4":50507.04,"5":74894.98,"6":60352.19},"2":{"0":56500.48,"1":50261.52,"2":56075.59,"3":36589.58,"4":48270.82,"5":76889.74,"6":60879.29},"3":{"0":50072.43,"1":41803.25,"2":37968.06,"3":33774.97,"4":51140.8,"5":64875.22,"6":51496.3},"4":{"0":59981.94,"1":43257.59,"2":41494.76,"3":42151.95,"4":56512.43,"5":62208.56,"6":36994.38},"5":{"0":49492.05,"1":48931.37,"2":47511.87,"3":39200.7,"4":45531.99,"5":63980.24,"6":50083.5},"6":{"0":50434.94,"1":41394.12,"2":30029.42,"3":39362.78,"4":54815.89,"5":47376.75,"6":43101.41}},"107":{"1":{"0":47749.27,"1":38127.3,"2":39080.43,"3":43553.33,"4":43821.07,"5":60865.79,"6":44336.53},"2":{"0":51464.91,"1":45197.06,"2":51827.52,"3":41445.34,"4":54033.82,"5":61168.81,"6":56707.61},"3":{"0":32430.04,"1":34445.98,"2":41236.54,"3":44317.3,"4":46025.48,"5":47301.93,"6":45262.8},"4":{"0":48577.12,"1":43840.35,"2":38462.63,"3":48974.96,"4":54225.34,"5":46727.72,"6":67826.64},"5":{"0":53629.31,"1":40635.49,"2":44218.31,"3":45572.15,"4":65926.51,"5":51630.35,"6":39153.8},"6":{"0":42389.41,"1":39494.23,"2":36033.79,"3":40819.58,"4":43342.35,"5":49913.5,"6":56436.47}},"143":{"3":{"0":279.44,"1":950.47,"4":17532.71,"5":33083.18,"6":57131.77},"4":{"0":20570.79,"1":33133.02,"2":20723.55,"3":23840.65,"4":32627.8,"5":74419.39,"6":43139.02},"5":{"0":21755.83,"1":9663.08,"2":4083.41,"3":65124.77,"4":11850.44,"5":22978.69,"6":58306.73},"6":{"0":17435.49}}}
const EXCEL_DOWT={"003":{"1":{"0":12.69,"1":12.75,"2":13.15,"3":10.43,"4":12.64,"5":16.15,"6":25.75},"2":{"0":11.7,"1":12.64,"2":14.75,"3":10.83,"4":13.17,"5":23.5,"6":25.0},"3":{"0":12.83,"1":11.23,"2":7.42,"3":11.55,"4":8.55,"5":14.43,"6":11.57},"4":{"0":8.08,"1":9.25,"2":9.14,"3":11.17,"4":11.17,"5":14.5,"6":13.25},"5":{"0":11.2,"1":9.09,"2":13.27,"3":12.46,"4":8.93,"5":15.31,"6":11.08}},"009":{"1":{"0":11.09,"1":10.85,"2":10.36,"3":11.15,"4":10.14,"5":17.62,"6":15.0},"2":{"0":11.82,"1":13.45,"2":9.92,"3":14.58,"4":13.18,"5":17.67,"6":16.5},"3":{"0":17.62,"1":11.18,"2":10.75,"3":11.58,"4":9.58,"5":16.79,"6":14.0},"4":{"0":9.83,"1":11.38,"2":14.79,"3":19.23,"4":10.3,"5":15.17,"6":11.08},"5":{"0":12.0,"1":14.5,"2":6.62,"3":10.46,"4":13.4,"5":17.21,"6":13.54}},"010":{"1":{"0":15.36,"1":10.92,"2":14.57,"3":12.31,"4":11.43,"5":19.08,"6":14.1},"2":{"0":8.82,"1":13.91,"2":12.0,"3":13.62,"4":13.27,"5":14.58,"6":18.92},"3":{"0":11.14,"1":10.62,"2":12.45,"3":9.92,"4":10.15,"5":16.79,"6":14.93},"4":{"0":14.38,"1":12.54,"2":11.38,"3":13.23,"4":13.92,"5":16.5,"6":12.09},"5":{"0":14.25,"1":20.27,"2":14.23,"3":11.5,"4":12.87,"5":16.29,"6":11.23}},"012":{"1":{"0":16.23,"1":13.08,"2":11.93,"3":12.36,"4":15.79,"5":14.15,"6":14.91},"2":{"0":15.18,"1":13.27,"2":14.5,"3":10.58,"4":13.25,"5":14.75,"6":16.55},"3":{"0":15.21,"1":11.17,"2":14.09,"3":9.45,"4":12.91,"5":14.57,"6":13.0},"4":{"0":11.92,"1":12.36,"2":16.14,"3":11.0,"4":16.5,"5":12.08,"6":15.67},"5":{"0":13.17,"1":11.75,"2":11.62,"3":14.36,"4":11.64,"5":18.21,"6":12.46}},"014":{"1":{"0":17.62,"1":11.31,"2":10.31,"3":14.93,"4":15.0,"5":18.77,"6":18.0},"2":{"0":10.08,"1":11.45,"2":12.83,"3":11.54,"4":12.75,"5":21.0,"6":15.75},"3":{"0":13.0,"1":11.0,"2":11.0,"3":13.25,"4":11.62,"5":20.5,"6":10.69},"4":{"0":13.69,"1":13.57,"2":11.46,"3":13.92,"4":11.92,"5":16.17,"6":16.36},"5":{"0":9.67,"1":11.17,"2":13.77,"3":19.43,"4":17.07,"5":15.36,"6":13.5}},"048":{"1":{"0":8.42,"1":9.46,"2":8.07,"3":8.23,"4":9.08,"5":12.15,"6":9.09},"2":{"0":4.4,"1":8.08,"2":7.17,"3":8.0,"4":11.7,"5":14.5,"6":9.5},"3":{"0":10.29,"1":6.0,"2":9.36,"3":8.18,"4":8.92,"5":9.0,"6":8.86},"4":{"0":9.91,"1":9.33,"2":7.79,"3":10.85,"4":11.45,"5":11.18,"6":8.7},"5":{"0":6.18,"1":8.5,"2":12.42,"3":7.64,"4":9.92,"5":10.93,"6":9.77}},"050":{"1":{"0":13.08,"1":8.5,"2":12.62,"3":11.0,"4":12.77,"5":14.69,"6":13.73},"2":{"0":12.25,"1":9.67,"2":13.4,"3":10.55,"4":12.5,"5":18.5,"6":15.64},"3":{"0":17.17,"1":14.3,"2":8.5,"3":9.64,"4":13.15,"5":15.14,"6":11.5},"4":{"0":11.25,"1":8.54,"2":12.14,"3":10.92,"4":15.75,"5":17.55,"6":13.83},"5":{"0":8.17,"1":12.36,"2":7.38,"3":8.33,"4":14.33,"5":22.25,"6":12.08}},"096":{"1":{"0":10.38,"1":10.62,"2":7.42,"3":6.8,"4":8.57,"5":13.33,"6":10.33},"2":{"0":11.0,"1":10.36,"2":10.88,"3":7.73,"4":10.55,"5":14.67,"6":13.08},"3":{"0":9.93,"1":9.5,"2":6.9,"3":8.18,"4":11.2,"5":12.31,"6":9.14},"4":{"0":11.38,"1":7.08,"2":8.58,"3":9.2,"4":12.36,"5":9.64,"6":9.22},"5":{"0":9.55,"1":9.17,"2":8.33,"3":6.29,"4":8.57,"5":12.92,"6":9.75}},"107":{"1":{"0":7.75,"1":8.89,"2":7.75,"3":7.09,"4":7.58,"5":9.23,"6":9.0},"2":{"0":9.27,"1":8.8,"2":11.25,"3":7.5,"4":10.82,"5":10.73,"6":12.0},"3":{"0":6.0,"1":6.89,"2":7.1,"3":8.27,"4":8.42,"5":8.08,"6":9.69},"4":{"0":7.31,"1":7.08,"2":8.0,"3":9.82,"4":9.36,"5":8.36,"6":12.33},"5":{"0":9.5,"1":7.6,"2":7.18,"3":9.42,"4":11.67,"5":8.46,"6":6.36}},"143":{"3":{"4":4.0,"5":8.0,"6":16.0},"4":{"0":8.0,"1":8.0,"2":5.8,"3":8.0,"4":9.0,"5":18.0,"6":11.0},"5":{"0":5.33,"3":25.33,"4":4.0,"5":10.67,"6":15.0}}}
const EXCEL_DOWT_G = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */
const EXCEL_DOWS_G = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */

/* ── สาขาเดิม 10 สาขา (เขต Nopporn) — คงชื่อไทยเดิมไว้เหมือนเดิม ── */
const HOME_ZONE = 'Nopporn'
const HOME_BRANCHES = [
  { id:'003', name:'Cockpit Srinakarin',         short:'ศรีนครินทร์'   , zone:HOME_ZONE },
  { id:'009', name:'Cockpit Nakorn Ratchasima',  short:'นครราชสีมา'   , zone:HOME_ZONE },
  { id:'010', name:'Cockpit Udonthani',           short:'อุดรธานี'     , zone:HOME_ZONE },
  { id:'012', name:'Cockpit Khonkaen',            short:'ขอนแก่น'     , zone:HOME_ZONE },
  { id:'014', name:'Cockpit Ubolratchathani',     short:'อุบลราชธานี' , zone:HOME_ZONE },
  { id:'048', name:'Cockpit Surin',               short:'สุรินทร์'     , zone:HOME_ZONE },
  { id:'050', name:'Cockpit Lopburi',             short:'ลพบุรี'       , zone:HOME_ZONE },
  { id:'096', name:'Cockpit Nakorn Ratchasima 2', short:'นครราชสีมา2' , zone:HOME_ZONE },
  { id:'107', name:'Cockpit By Pass Udonthani',   short:'Bypass อุดรฯ', zone:HOME_ZONE },
  { id:'143', name:'Cockpit Samut Prakarn',       short:'สมุทรปราการ' , zone:HOME_ZONE },
]

/* ── สาขาอื่นทั้งบริษัท (จาก Target Jul 2026) — ชื่อ/รหัสตามไฟล์เป้า แบ่งตามเขต (AM) ──
   ⚠️ สาขากลุ่มนี้ยังไม่มีข้อมูลยอดขายจริงรายวัน/ประวัติ — จะขึ้นข้อมูลเมื่อแต่ละเขต
   อัพโหลดไฟล์ Excel ของตัวเอง (ระบบจับคู่รหัสสาขาอัตโนมัติอยู่แล้วผ่าน DAILY_BID_MAP) */
const OTHER_ZONE_BRANCHES = [
  { id:'001', name:'Cockpit Lardprao (Makro)', short:'Lardprao (Makro)', zone:'Klodbavorn' },
  { id:'002', name:'Cockpit Changwattana', short:'Changwattana', zone:'Salisa' },
  { id:'004', name:'Cockpit Chiangmai', short:'Chiangmai', zone:'Siriya' },
  { id:'005', name:'Cockpit Chonburi', short:'Chonburi', zone:'Dutsanee' },
  { id:'006', name:'Cockpit Bangbon', short:'Bangbon', zone:'Patranon' },
  { id:'007', name:'Cockpit Hadyai', short:'Hadyai', zone:'Rungchai' },
  { id:'011', name:'Cockpit Phitsanulok', short:'Phitsanulok', zone:'Siriya' },
  { id:'013', name:'Cockpit Surathani', short:'Surathani', zone:'Rungchai' },
  { id:'018', name:'Cockpit Bangna Km6.', short:'Bangna Km6.', zone:'Phuthipat' },
  { id:'019', name:'Cockpit Rangsit 3', short:'Rangsit 3', zone:'Poonnarat' },
  { id:'020', name:'Cockpit Rayong', short:'Rayong', zone:'Dutsanee' },
  { id:'021', name:'Cockpit Rama 3 (Tree on Three)', short:'Rama 3 (Tree on Three)', zone:'Klodbavorn' },
  { id:'022', name:'Cockpit Bangplee', short:'Bangplee', zone:'Dutsanee' },
  { id:'025', name:'Cockpit Nuanchan', short:'Nuanchan', zone:'Phuthipat' },
  { id:'032', name:'Cockpit Issaraparb', short:'Issaraparb', zone:'Patranon' },
  { id:'034', name:'Cockpit Nakornsawan', short:'Nakornsawan', zone:'Siriya' },
  { id:'035', name:'Cockpit Charansanitwong 37', short:'Charansanitwong 37', zone:'Patranon' },
  { id:'041', name:'Cockpit Petchkasem 2', short:'Petchkasem 2', zone:'Patranon' },
  { id:'043', name:'Cockpit Suwinthawong', short:'Suwinthawong', zone:'Phuthipat' },
  { id:'047', name:'Cockpit Nakornprathom', short:'Nakornprathom', zone:'Rungchai' },
  { id:'049', name:'Cockpit Pattaya', short:'Pattaya', zone:'Dutsanee' },
  { id:'052', name:'Cockpit Chiangrai', short:'Chiangrai', zone:'Siriya' },
  { id:'054', name:'Cockpit Wongsawang', short:'Wongsawang', zone:'Klodbavorn' },
  { id:'058', name:'Cockpit Rama3 (Lotus)', short:'Rama3 (Lotus)', zone:'Klodbavorn' },
  { id:'060', name:'Cockpit Ratchadaphisek', short:'Ratchadaphisek', zone:'Klodbavorn' },
  { id:'062', name:'Cockpit Vipavadee (Shell)', short:'Vipavadee (Shell)', zone:'Phuthipat' },
  { id:'069', name:'Cockpit Nakorn-Srithammarat', short:'Nakorn-Srithammarat', zone:'Rungchai' },
  { id:'070', name:'Cockpit Ratchaburi', short:'Ratchaburi', zone:'Rungchai' },
  { id:'074', name:'Cockpit Rangsit-Nakornnayok Klong 7', short:'Rangsit-Nakornnayok Klong 7', zone:'Poonnarat' },
  { id:'077', name:'Cockpit Pracha-Utit', short:'Pracha-Utit', zone:'Patranon' },
  { id:'078', name:'Cockpit Nawanakorn', short:'Nawanakorn', zone:'Poonnarat' },
  { id:'079', name:'Cockpit Rama2 (M Park)', short:'Rama2 (M Park)', zone:'Patranon' },
  { id:'080', name:'Cockpit Phitsanulok 2', short:'Phitsanulok 2', zone:'Siriya' },
  { id:'082', name:'Cockpit Lumlukka Klong 2', short:'Lumlukka Klong 2', zone:'Poonnarat' },
  { id:'083', name:'Cockpit Suratthani 2', short:'Suratthani 2', zone:'Rungchai' },
  { id:'087', name:'Cockpit Pattanakhan', short:'Pattanakhan', zone:'Poonnarat' },
  { id:'088', name:'Mahachai', short:'Mahachai', zone:'Patranon' },
  { id:'092', name:'Cockpit Nakorn-in', short:'Nakorn-in', zone:'Salisa' },
  { id:'093', name:'Cockpit Phuket', short:'Phuket', zone:'Rungchai' },
  { id:'094', name:'Cockpit Srisaman', short:'Srisaman', zone:'Salisa' },
  { id:'097', name:'Cockpit Songkhla', short:'Songkhla', zone:'Rungchai' },
  { id:'098', name:'Cockpit Lampang', short:'Lampang', zone:'Siriya' },
  { id:'101', name:'Cockpit Mae Hia', short:'Mae Hia', zone:'Siriya' },
  { id:'102', name:'Cockpit Chiangmai Meechok', short:'Chiangmai Meechok', zone:'Siriya' },
  { id:'103', name:'Cockpit Borwin', short:'Borwin', zone:'Dutsanee' },
  { id:'104', name:'Cockpit Teparak km.2', short:'Teparak km.2', zone:'Phuthipat' },
  { id:'105', name:'Cockpit Viphavadee', short:'Viphavadee', zone:'Phuthipat' },
  { id:'106', name:'Cockpit Lardprow', short:'Lardprow', zone:'Klodbavorn' },
  { id:'108', name:'Cockpit Bangna Km.34', short:'Bangna Km.34', zone:'Dutsanee' },
  { id:'109', name:'Cockpit Maptaphut', short:'Maptaphut', zone:'Dutsanee' },
  { id:'111', name:'Cockpit Tiwanon', short:'Tiwanon', zone:'Salisa' },
  { id:'112', name:'Cockpit Amata', short:'Amata', zone:'Dutsanee' },
  { id:'113', name:'Cockpit Ratchapruk', short:'Ratchapruk', zone:'Salisa' },
  { id:'116', name:'Cockpit Lumlukka', short:'Lumlukka', zone:'Poonnarat' },
  { id:'118', name:'Cockpit Laksi', short:'Laksi', zone:'Salisa' },
  { id:'119', name:'Cockpit Hatyai', short:'Hatyai', zone:'Rungchai' },
  { id:'120', name:'Cockpit Rangsit', short:'Rangsit', zone:'Poonnarat' },
  { id:'123', name:'Cockpit Hathairat', short:'Hathairat', zone:'Poonnarat' },
  { id:'124', name:'Cockpit Jas Amata', short:'Jas Amata', zone:'Dutsanee' },
  { id:'125', name:'Cockpit khubon', short:'khubon', zone:'Phuthipat' },
  { id:'126', name:'Cockpit Salaya-Sai 5', short:'Salaya-Sai 5', zone:'Patranon' },
  { id:'127', name:'Cockpit Wanghin', short:'Wanghin', zone:'Klodbavorn' },
  { id:'128', name:'Cockpit Nawamin', short:'Nawamin', zone:'Phuthipat' },
  { id:'129', name:'Cockpit Borommaratchachonnani', short:'Borommaratchachonnani', zone:'Patranon' },
  { id:'130', name:'Cockpit Bangbo', short:'Bangbo', zone:'Dutsanee' },
  { id:'131', name:'Cockpit North Pattaya', short:'North Pattaya', zone:'Dutsanee' },
  { id:'132', name:'Cockpit Nakornsri Home Pro', short:'Nakornsri Home Pro', zone:'Rungchai' },
  { id:'133', name:'Cockpit Bangkhae', short:'Bangkhae', zone:'Patranon' },
  { id:'134', name:'Cockpit Bangkadi', short:'Bangkadi', zone:'Salisa' },
  { id:'135', name:'Cockpit Sathorn', short:'Sathorn', zone:'Klodbavorn' },
  { id:'136', name:'Cockpit Kingkaew 62/2', short:'Kingkaew 62/2', zone:'Dutsanee' },
  { id:'137', name:'Cockpit Barom 63/2', short:'Barom 63/2', zone:'Rungchai' },
  { id:'138', name:'Cockpit Rangsit Klong 2', short:'Rangsit Klong 2', zone:'Poonnarat' },
  { id:'139', name:'Cockpit Ramkhamhaeng 152', short:'Ramkhamhaeng 152', zone:'Klodbavorn' },
  { id:'141', name:'Cockpit Bangyai', short:'Bangyai', zone:'Salisa' },
  { id:'142', name:'Cockpit Saraphi', short:'Saraphi', zone:'Siriya' },
]

/* ALL_BRANCHES = สาขาทั้งบริษัทที่มี AM/เป้าแล้ว (86 สาขา, 9 เขต) — ตัวเดิม BRANCHES ถูก
   คำนวณใหม่แบบ dynamic ตามเขตที่เลือกไว้ใน App() (ดู selectedZone/visibleBranches) */
const ALL_BRANCHES = [...HOME_BRANCHES, ...OTHER_ZONE_BRANCHES]

/* รายชื่อเขต (เรียงตามจำนวนสาขา) ใช้ทำ dropdown เลือกเขต */
const ZONES = [...new Set(ALL_BRANCHES.map(b=>b.zone))]
  .map(z => ({ key:z, label:z, count: ALL_BRANCHES.filter(b=>b.zone===z).length }))
  .sort((a,b)=> a.key===HOME_ZONE ? -1 : b.key===HOME_ZONE ? 1 : b.count-a.count)

const SEED_T = {
  '003':{sales:2553704,tire:400,lube:650, battery:43,brake:36,shock:33,mp:150,cc:790},
  '009':{sales:2455797,tire:430,lube:514, battery:25,brake:37,shock:34,mp:154,cc:728},
  '010':{sales:2353415,tire:380,lube:447, battery:36,brake:34,shock:31,mp:142,cc:760},
  '012':{sales:2502610,tire:420,lube:862, battery:45,brake:37,shock:34,mp:155,cc:919},
  '014':{sales:2516970,tire:420,lube:726, battery:42,brake:38,shock:34,mp:156,cc:739},
  '048':{sales:1613513,tire:290,lube:273, battery:30,brake:26,shock:24,mp:107,cc:583},
  '050':{sales:2100540,tire:400,lube:726, battery:21,brake:35,shock:32,mp:146,cc:458},
  '096':{sales:1618298,tire:270,lube:301, battery:21,brake:24,shock:21,mp:98, cc:330},
  '107':{sales:1517936,tire:250,lube:344, battery:27,brake:23,shock:20,mp:92, cc:377},
  '143':{sales:903980, tire:150,lube:120, battery:10,brake:12,shock:11,mp:55, cc:200},
}

/* ── เป้า ก.ค. 2026 สาขาเขตอื่น (จากไฟล์ Target 1-31 Jul 2026) ──
   ⚠️ เป็นเป้าเดือนรวมเท่านั้น ไม่ใช่ SEED_H/ประวัติรายวัน — เขตนั้นๆ ต้องอัพโหลด Excel เองเพื่อดูยอดจริง/กราฟ */
const SEED_T_OTHER = {
  '001':{sales:1702890,tire:311,lube:355,battery:22,brake:24,shock:30,mp:104,cc:334},
  '002':{sales:3837610,tire:600,lube:840,battery:51,brake:55,shock:54,mp:246,cc:753},
  '004':{sales:2629520,tire:449,lube:548,battery:33,brake:36,shock:35,mp:161,cc:516},
  '005':{sales:2155394,tire:377,lube:449,battery:27,brake:30,shock:29,mp:132,cc:423},
  '006':{sales:2239543,tire:382,lube:467,battery:28,brake:31,shock:30,mp:137,cc:439},
  '007':{sales:2012487,tire:333,lube:420,battery:26,brake:28,shock:27,mp:123,cc:395},
  '011':{sales:2869988,tire:479,lube:598,battery:36,brake:39,shock:38,mp:175,cc:563},
  '013':{sales:2309515,tire:389,lube:481,battery:29,brake:32,shock:31,mp:141,cc:453},
  '018':{sales:2028435,tire:333,lube:423,battery:26,brake:28,shock:27,mp:124,cc:398},
  '019':{sales:2600000,tire:443,lube:542,battery:33,brake:36,shock:35,mp:159,cc:510},
  '020':{sales:2395319,tire:400,lube:499,battery:30,brake:33,shock:32,mp:146,cc:470},
  '021':{sales:2128612,tire:363,lube:444,battery:27,brake:30,shock:29,mp:130,cc:417},
  '022':{sales:2394550,tire:395,lube:499,battery:30,brake:33,shock:32,mp:146,cc:470},
  '025':{sales:1532056,tire:232,lube:319,battery:20,brake:21,shock:21,mp:94, cc:300},
  '032':{sales:1255574,tire:194,lube:262,battery:16,brake:17,shock:17,mp:77, cc:246},
  '034':{sales:3325918,tire:567,lube:693,battery:42,brake:46,shock:44,mp:203,cc:652},
  '035':{sales:2912191,tire:497,lube:607,battery:37,brake:40,shock:39,mp:178,cc:571},
  '041':{sales:2769394,tire:472,lube:577,battery:35,brake:38,shock:37,mp:169,cc:543},
  '043':{sales:2759104,tire:462,lube:575,battery:35,brake:38,shock:37,mp:168,cc:541},
  '047':{sales:1521744,tire:296,lube:317,battery:20,brake:21,shock:21,mp:93, cc:298},
  '049':{sales:1294361,tire:221,lube:270,battery:17,brake:18,shock:18,mp:79, cc:254},
  '052':{sales:2248711,tire:384,lube:469,battery:29,brake:31,shock:30,mp:137,cc:441},
  '054':{sales:2022182,tire:365,lube:422,battery:26,brake:28,shock:28,mp:124,cc:397},
  '058':{sales:5321531,tire:761,lube:1059,battery:67,brake:72,shock:60,mp:324,cc:1044},
  '060':{sales:1915751,tire:327,lube:399,battery:24,brake:26,shock:26,mp:117,cc:376},
  '062':{sales:1497504,tire:371,lube:312,battery:19,brake:21,shock:20,mp:92, cc:294},
  '069':{sales:2341329,tire:384,lube:488,battery:30,brake:32,shock:31,mp:143,cc:459},
  '070':{sales:2196391,tire:375,lube:458,battery:28,brake:30,shock:30,mp:134,cc:431},
  '074':{sales:1950000,tire:333,lube:407,battery:25,brake:27,shock:26,mp:119,cc:382},
  '077':{sales:2180067,tire:372,lube:454,battery:28,brake:30,shock:29,mp:133,cc:427},
  '078':{sales:2456000,tire:419,lube:512,battery:31,brake:34,shock:33,mp:150,cc:482},
  '079':{sales:3374098,tire:575,lube:703,battery:43,brake:46,shock:45,mp:206,cc:662},
  '080':{sales:3142983,tire:536,lube:655,battery:40,brake:43,shock:42,mp:192,cc:616},
  '082':{sales:2200000,tire:375,lube:459,battery:28,brake:30,shock:30,mp:134,cc:431},
  '083':{sales:1973424,tire:352,lube:411,battery:25,brake:27,shock:27,mp:121,cc:387},
  '087':{sales:3580000,tire:609,lube:746,battery:45,brake:49,shock:47,mp:218,cc:702},
  '088':{sales:1610191,tire:294,lube:335,battery:21,brake:21,shock:21,mp:99, cc:316},
  '092':{sales:1948795,tire:332,lube:405,battery:24,brake:26,shock:25,mp:119,cc:382},
  '093':{sales:1664080,tire:292,lube:346,battery:20,brake:22,shock:21,mp:102,cc:326},
  '094':{sales:3068178,tire:522,lube:638,battery:38,brake:41,shock:40,mp:187,cc:602},
  '097':{sales:1451255,tire:246,lube:302,battery:18,brake:19,shock:19,mp:89, cc:285},
  '098':{sales:2063574,tire:351,lube:429,battery:25,brake:27,shock:27,mp:126,cc:405},
  '101':{sales:1815956,tire:329,lube:378,battery:22,brake:24,shock:24,mp:110,cc:356},
  '102':{sales:1738390,tire:316,lube:361,battery:21,brake:23,shock:22,mp:105,cc:341},
  '103':{sales:2002132,tire:341,lube:416,battery:25,brake:27,shock:26,mp:121,cc:393},
  '104':{sales:1610793,tire:246,lube:335,battery:20,brake:21,shock:21,mp:98, cc:316},
  '105':{sales:1826889,tire:317,lube:380,battery:22,brake:24,shock:24,mp:111,cc:358},
  '106':{sales:1649675,tire:301,lube:343,battery:20,brake:22,shock:22,mp:100,cc:323},
  '108':{sales:1099098,tire:200,lube:228,battery:13,brake:14,shock:14,mp:66, cc:216},
  '109':{sales:1659121,tire:282,lube:345,battery:20,brake:22,shock:21,mp:100,cc:325},
  '111':{sales:2238158,tire:383,lube:468,battery:28,brake:30,shock:29,mp:136,cc:439},
  '112':{sales:2351329,tire:387,lube:489,battery:29,brake:31,shock:31,mp:143,cc:461},
  '113':{sales:3061600,tire:508,lube:615,battery:36,brake:40,shock:39,mp:179,cc:600},
  '116':{sales:1480000,tire:252,lube:308,battery:18,brake:20,shock:19,mp:90, cc:290},
  '118':{sales:1770790,tire:330,lube:366,battery:21,brake:23,shock:23,mp:107,cc:347},
  '119':{sales:1921592,tire:335,lube:400,battery:24,brake:26,shock:25,mp:116,cc:377},
  '120':{sales:1575000,tire:268,lube:327,battery:19,brake:21,shock:20,mp:95, cc:309},
  '123':{sales:1460000,tire:248,lube:303,battery:18,brake:19,shock:19,mp:88, cc:286},
  '124':{sales:1454165,tire:247,lube:302,battery:18,brake:19,shock:19,mp:88, cc:285},
  '125':{sales:1508264,tire:243,lube:314,battery:18,brake:20,shock:19,mp:91, cc:296},
  '126':{sales:1688913,tire:307,lube:351,battery:21,brake:22,shock:22,mp:102,cc:331},
  '127':{sales:1277167,tire:237,lube:265,battery:15,brake:16,shock:16,mp:77, cc:250},
  '128':{sales:1573025,tire:240,lube:327,battery:19,brake:21,shock:20,mp:95, cc:308},
  '129':{sales:1528933,tire:240,lube:318,battery:19,brake:20,shock:20,mp:93, cc:300},
  '130':{sales:1156350,tire:210,lube:240,battery:14,brake:15,shock:15,mp:70, cc:227},
  '131':{sales:1296817,tire:220,lube:270,battery:16,brake:17,shock:17,mp:78, cc:254},
  '132':{sales:1359382,tire:215,lube:283,battery:16,brake:18,shock:17,mp:82, cc:267},
  '133':{sales:1012252,tire:172,lube:210,battery:12,brake:13,shock:13,mp:61, cc:198},
  '134':{sales:1296404,tire:230,lube:254,battery:15,brake:16,shock:16,mp:74, cc:254},
  '135':{sales:1756105,tire:299,lube:415,battery:21,brake:24,shock:22,mp:106,cc:344},
  '136':{sales:1242181,tire:211,lube:258,battery:15,brake:16,shock:16,mp:75, cc:244},
  '137':{sales:993278, tire:204,lube:206,battery:12,brake:13,shock:13,mp:60, cc:195},
  '138':{sales:1475000,tire:251,lube:307,battery:18,brake:19,shock:19,mp:89, cc:289},
  '139':{sales:1277167,tire:217,lube:265,battery:15,brake:17,shock:19,mp:77, cc:250},
  '141':{sales:1349295,tire:256,lube:278,battery:16,brake:18,shock:17,mp:81, cc:265},
  '142':{sales:830211, tire:121,lube:173,battery:10,brake:11,shock:10,mp:50, cc:163},
}
Object.assign(SEED_T, SEED_T_OTHER)

const SEED_H = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */

const SEED_TIREQ = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */

const MAY_TIRE = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */
const MAY_SALES = {}  /* ว่างเปล่าในแอปนี้ — แต่ละเขตอัพโหลด Excel ของตัวเองผ่านแท็บ Upload */

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
/* เดิมเป็น array คงที่ 10 สี (พอดีกับ 10 สาขาเดิม) — ตอนนี้ขยายเขต/สาขาได้ถึง 86+ จึงสร้างพาเลตแบบ
   หมุนเฉดสี (HSL) ยาวพอสำหรับทุกสาขาที่อาจแสดงพร้อมกัน โดยสีของ 10 สาขาเดิม (index 0-9) คงเดิมไว้ */
const BCLR = [
  '#f59e0b','#3b82f6','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#e11d48','#84cc16','#ec4899',
  ...Array.from({length:90},(_,i)=>`hsl(${(i*47)%360},62%,55%)`)
]
const YRCLR = {2023:'#475569',2024:'#94a3b8',2025:'#E2231A',2026:'#FFFFFF'}
const DEFAULT_CFG = {year:2026, month:5, todayDay:15}

/* ── Cockpit CI palette — เหลือง/ดำ/แดง ตาม logo (ใช้ร่วมกับ MorningBrief.jsx) ── */
const CI = { yellow:'#FFEB00', black:'#15181C', ink:'#0D1117', red:'#E2231A', white:'#FFFFFF', paper:'#F4F4F2', line:'#E3E3DE' }

/* ════════════════════════════════════════════════════════
   AUTH HELPERS
   - รหัสผ่านแอป: เก็บเป็น SHA-256 hash บน Supabase (key 'cp_auth') ไม่เก็บตัวอักษรเปล่าๆ
   - รหัสกุญแจ (master key): ต้องใส่ให้ถูกก่อนจึงจะเปลี่ยนรหัสผ่านแอปได้ (เฉพาะผู้ดูแลระบบ)
════════════════════════════════════════════════════════ */
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}
const MASTER_KEY_HASH = '9542ebb0f6bcd4d194a7dcd55dba9f102491b7203921b91f3ae1da47ad1b2925'
const STATUS = { over:'#1A7F3E', near:'#B45309', push:CI.red }
const statusColor = p => (p>=100?STATUS.over:p>=90?STATUS.near:STATUS.push)

/* ── Helpers ── */
const N  = (n,d=0) => Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:d,maximumFractionDigits:d})
const fM = (n) => n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(0)+'K':N(n)
const P  = (a,b) => b?(a/b)*100:0
const dIM = (y,m) => new Date(y,m,0).getDate()
// ปัดจำนวนเส้นยางขึ้นเป็นทวีคูณของ 4 เสมอ (1-3→4, 5-7→8, 4→4, 8→8 ...)
const ceilTo4 = (n) => n>0 ? Math.ceil(n/4)*4 : 0

/* ── Entry field definitions ── */
const FIELDS = [
  {key:'totalSales', label:'ยอดขายรวมวัน (฿)',         tgt:null},   // ← เพิ่มใหม่
  {key:'tire',       label:'ยาง (เส้น)',                tgt:'tire'},
  {key:'tireSales',  label:'ยอดขายยาง (฿)',             tgt:null},
  {key:'bsTire',     label:'ยาง Bridgestone (เส้น)',    tgt:null},
  {key:'alloyWheel', label:'Alloy Wheel (วง)',           tgt:null},
  {key:'battery',    label:'Battery (ลูก)',              tgt:'battery'},
  {key:'brake',      label:'Brake (ชิ้น)',               tgt:'brake'},
  {key:'shockUp',    label:'Shock Up (ชิ้น)',            tgt:'shock'},
  {key:'mp',         label:'MP (ชุด)',                   tgt:'mp'},
  {key:'lubricant',  label:'Lubricant (ลิตร)',           tgt:'lube'},
  {key:'filter',     label:'Filter (ชิ้น)',              tgt:null},
  {key:'airFilter',  label:'Air Filter (ชิ้น)',          tgt:null},
  {key:'service',    label:'Service (฿)',                tgt:null},
  {key:'jobOrder',   label:'Job Order (ราย)',            tgt:'cc'},
]
const EMPTY_ROW = () => Object.fromEntries(FIELDS.map(f=>[f.key,0]))

/* ── Month-scoped manual entry (de) ──────────────────────────────────
   เก็บใน Supabase เป็น  de[สาขา]["YYYY-M"][วัน] = {field:val}
   เพื่อแยกยอดกรอกมือของแต่ละเดือนออกจากกัน — พอขึ้นเดือนใหม่ MTD เริ่มที่ 0
   ส่วนยอดเดือนที่ผ่านมาให้ดึงจาก Excel (EXCEL_MS/getH26) แทน             */
const deKey = (cfg) => `${cfg.year}-${cfg.month}`

// แปลงข้อมูลที่โหลดมาให้เป็นรูปแบบ namespaced เสมอ
// - รูปแบบใหม่ (key = "YYYY-M") → ใช้ตามเดิม
// - รูปแบบเก่า flat (key = เลขวัน) → ทิ้ง (เริ่มใหม่ทุกเดือน ตามที่ตั้งใจ; Excel เป็นตัวจริง)
function normalizeDe(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const [bid, branch] of Object.entries(raw)) {
    if (!branch || typeof branch !== 'object') { out[bid] = {}; continue }
    const keys = Object.keys(branch)
    const namespaced = keys.length === 0 || keys.every(k => /^\d{4}-\d{1,2}$/.test(k))
    out[bid] = namespaced ? branch : {}   // flat เก่า → drop
  }
  return out
}

function sumDays(de, bid) {
  const agg = Object.fromEntries(FIELDS.map(f=>[f.key,0]))
  Object.values(de[bid]||{}).forEach(r => FIELDS.forEach(f => { agg[f.key] += parseFloat(r[f.key])||0 }))
  return agg
}
// Sum days 1..toDay only (for dynamic daily target calculation)
function sumDaysUpTo(de, bid, toDay) {
  const agg = Object.fromEntries(FIELDS.map(f=>[f.key,0]))
  for (let d=1; d<=toDay; d++) {
    const r = de[bid]?.[d]
    if (r) FIELDS.forEach(f => { agg[f.key] += parseFloat(r[f.key])||0 })
  }
  return agg
}
function calcTS(agg) {
  // 1️⃣ ถ้ากรอก "ยอดขายรวมวัน (฿)" โดยตรง ใช้ค่านั้น
  if ((agg.totalSales||0) > 0) return Number(agg.totalSales)
  // 2️⃣ ถ้ากรอกยอดแยกรายการ รวมเฉพาะช่องที่เป็นเงิน (฿)
  // tireSales, service คือยอดเงินโดยตรง
  // battery/brake/shock/mp/alloy คูณราคาประมาณ
  const fromItems = (agg.tireSales||0)+(agg.service||0)+
    (agg.battery||0)*3500+(agg.brake||0)*800+
    (agg.shockUp||0)*800+(agg.mp||0)*2500+(agg.alloyWheel||0)*4500
  return fromItems
}

/* ── UI atoms ── */
function PBadge({value, threshold}) {
  const v = parseFloat(value)||0
  const c = statusColor(v)
  return <span style={{background:c+'22',color:c,borderRadius:4,padding:'2px 8px',fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",whiteSpace:'nowrap'}}>{v.toFixed(1)}%</span>
}

function Card({label,value,sub,target,color=CI.red,small}) {
  return (
    <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px'}}>
      <div style={{fontSize:9,color:'#777',textTransform:'uppercase',letterSpacing:1,marginBottom:2,fontFamily:'Barlow Condensed',fontWeight:700}}>{label}</div>
      <div style={{fontSize:small?16:20,fontWeight:800,color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>{value}</div>
      {target!=null && (
        <div style={{display:'flex',alignItems:'baseline',gap:4,marginTop:3}}>
          <span style={{fontSize:small?10:11,color:'#666',fontWeight:800,fontFamily:'Barlow Condensed'}}>เป้า</span>
          <span style={{fontSize:small?16:20,fontWeight:800,color:CI.black,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>{target}</span>
        </div>
      )}
      {sub&&<div style={{fontSize:10,color:'#888',marginTop:2}}>{sub}</div>}
    </div>
  )
}

/* ── Extra badge components (module-level to avoid TDZ) ── */
function GrowthBadge({pct, label, threshold}) {
  // สีตามกฎ 3 ระดับเดียวกันทั้งแอป: <90%=แดง, 90-99.99%=เหลือง, >=100%=เขียว
  const clr = statusColor(pct)
  return <span style={{fontSize:9,color:clr,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>vs{label} {pct.toFixed(0)}%</span>
}
function PctBadge({v}) {
  const c=statusColor(v)
  return <span style={{background:c+'22',color:c,borderRadius:4,padding:'1px 7px',fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{v.toFixed(0)}%</span>
}
function AchBadge({pct}) {
  if (pct===null||pct===undefined) return <span style={{fontSize:10,color:'#4b5563'}}>—</span>
  const c=statusColor(pct)
  return <span style={{background:c+'22',color:c,borderRadius:4,padding:'2px 6px',fontSize:10,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{pct.toFixed(0)}%</span>
}
/* ── Mascot footer — แบนเนอร์ปิดท้ายหน้า ใช้ร่วมกันได้ทุกแท็บ (รูปจาก /icons/) ── */
function MascotFooter({ compact }) {
  return (
    <div style={{background:CI.yellow,borderRadius:10,marginTop:12,display:'flex',alignItems:'flex-end',
                 justifyContent:'space-between',padding:'0 10px',overflow:'hidden'}}>
      <img src="/icons/cockpit-boy.png" alt="" style={{width:compact?60:80,height:'auto',objectFit:'contain'}}
           onError={e=>{e.target.style.display='none'}}/>
      <div style={{textAlign:'center',paddingBottom:compact?8:12}}>
        <div style={{fontWeight:700,fontSize:compact?10:11,color:CI.red,fontStyle:'italic'}}>
          รักษามาตรฐานที่ดีต่อเนื่อง! ปิดจุดอ่อน เพิ่มจุดแข็ง
        </div>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:compact?18:22,letterSpacing:-.5,color:CI.black}}>
          COCKPIT <span style={{color:CI.red}}>100%</span>
        </div>
      </div>
      <img src="/icons/cockpit-girl.png" alt="" style={{width:compact?60:80,height:'auto',objectFit:'contain',transform:'scaleX(-1)'}}
           onError={e=>{e.target.style.display='none'}}/>
    </div>
  )
}

/* ── Gauge bar — เกจเทียบเป้าแบบเส้นตรง ใช้ร่วมกันได้ทุกแท็บ ── */
function GaugeBar({ value, height=8 }) {
  const v = Math.max(0, Math.min(value, 100))
  return (
    <div style={{height,borderRadius:6,background:'#1e2538',overflow:'hidden',flex:1}}>
      <div style={{height:'100%',width:`${v}%`,background:statusColor(value),borderRadius:6,transition:'width .5s'}}/>
    </div>
  )
}

/* ── Gauge ครึ่งวงกลม — เทียบเป้าแบบสปีดมิเตอร์ ใช้ร่วมกันได้ทุกแท็บ ── */
function SemiGauge({ value, size=88, strokeWidth=10, color, trackColor='#E3E3DE' }) {
  const v = Math.max(0, Math.min(value ?? 0, 100))
  const c = color || statusColor(v)
  const cx = size/2, cy = size/2, r = size/2 - strokeWidth/2 - 2
  const pt = deg => {
    const rad = deg*Math.PI/180
    return [cx + r*Math.cos(rad), cy - r*Math.sin(rad)]
  }
  const [x1,y1] = pt(180)
  const [x2,y2] = pt(0)
  const angleV = 180 - 180*(v/100)
  const [xv,yv] = pt(angleV)
  const bgPath = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  const fgPath = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${xv} ${yv}`
  return (
    <svg width={size} height={size/2+strokeWidth/2+2} style={{display:'block',margin:'0 auto'}}>
      <path d={bgPath} fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round"/>
      {v>0 && <path d={fgPath} fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinecap="round"/>}
    </svg>
  )
}

/* สีกำกับตัวเลขจริง vs เป้า — เขียว=เกินเป้า, ดำ=มีตัวเลขแล้ว(กำลังทำ), แดง=ยังไม่มียอดเลย */
function actualColor(actualVal, pct) {
  // ใช้กฎสี 3 ระดับเดียวกันทั้งแอป: <90%=แดง, 90-99.99%=เหลือง, >=100%=เขียว
  return statusColor(pct)
}

/* ── Branch Selector (dropdown on mobile, sidebar on desktop) ── */
/* ── Ring — เกจวงกลมเทียบเป้า ใช้ร่วมกันได้ทุกแท็บ ── */
function Ring({ value, size=62, stroke=8, color }) {
  const v = Math.max(0, Math.min(value ?? 0, 100))
  const c = color || statusColor(v)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{display:'block',transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E3E3DE" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={stroke}
              strokeDasharray={`${(v/100)*circ} ${circ}`} strokeLinecap="round"/>
    </svg>
  )
}

function BranchSelect({sel, onSel, showAll=true, mobile, branches=ALL_BRANCHES}) {
  if (mobile) return (
    <div style={{marginBottom:12}}>
      <select value={sel} onChange={e=>onSel(e.target.value)}
        style={{width:'100%',background:'#1e2538',border:`1px solid ${CI.yellow}`,borderRadius:8,padding:'12px 14px',color:CI.yellow,fontFamily:'Barlow Condensed',fontWeight:700,fontSize:15,outline:'none'}}>
        {showAll && <option value="ALL">🌐 รวมทุกสาขา</option>}
        {branches.map(b=><option key={b.id} value={b.id}>{b.id} — {b.short}</option>)}
      </select>
    </div>
  )
  return (
    <div style={{width:165,flexShrink:0}}>
      <div style={{fontSize:10,color:'#6b7280',textTransform:'uppercase',letterSpacing:1,marginBottom:6,fontFamily:'Barlow Condensed'}}>เลือกสาขา</div>
      {showAll && <>
        <button onClick={()=>onSel('ALL')} style={{display:'block',width:'100%',textAlign:'left',padding:'8px 10px',marginBottom:5,borderRadius:6,cursor:'pointer',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,background:sel==='ALL'?'#1e2538':'transparent',border:sel==='ALL'?`1px solid ${CI.yellow}`:'1px solid #2d3548',color:sel==='ALL'?CI.yellow:'#9ca3af'}}>
          🌐 รวมทุกสาขา
        </button>
        <div style={{borderBottom:'1px solid #2d3548',marginBottom:5}}/>
      </>}
      {branches.map((b,i) => (
        <button key={b.id} onClick={()=>onSel(b.id)} style={{display:'block',width:'100%',textAlign:'left',padding:'7px 10px',marginBottom:3,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'Barlow',background:sel===b.id?'#1e2538':'transparent',border:sel===b.id?`1px solid ${BCLR[i]}`:'1px solid transparent',color:sel===b.id?BCLR[i]:'#9ca3af',transition:'all .15s'}}>
          <span style={{fontSize:9,marginRight:3,color:BCLR[i]}}>●</span><span style={{fontSize:9,color:'#4b5563',marginRight:3}}>{b.id}</span>{b.short}
        </button>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   LOCK SCREEN — ก่อนเข้าแอปต้องใส่รหัสผ่าน
   - authHash=null (ยังไม่มีใครตั้งรหัส) → โหมดตั้งรหัสผ่านครั้งแรก
   - authHash มีค่าแล้ว → โหมดใส่รหัสเข้าระบบ
   - รหัสเก็บเป็น SHA-256 hash บน Supabase (key 'cp_auth') ไม่เก็บตัวอักษรเปล่าๆ
   - เปลี่ยนรหัสได้ตลอดเวลาที่แท็บ "ตั้งค่า" โดยไม่ต้องแก้โค้ด/redeploy
════════════════════════════════════════════════════════ */
function LockScreen({authHash, setAuthHash, onUnlock, compact}) {
  const isSetup = !authHash
  const [pw, setPw]     = useState('')
  const [pw2, setPw2]   = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr]   = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    setErr('')
    if (isSetup) {
      if (pw.length < 4) return setErr('รหัสผ่านสั้นเกินไป — อย่างน้อย 4 ตัวอักษร')
      if (pw !== pw2)    return setErr('รหัสผ่านยืนยันไม่ตรงกัน')
      setBusy(true)
      try {
        const h = await sha256Hex(pw)
        const ok = await DB.set('cp_auth', h)
        setBusy(false)
        if (!ok) return setErr('บันทึกรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง')
        setAuthHash(h)
        onUnlock()
      } catch(e) { setBusy(false); setErr('เกิดข้อผิดพลาด: '+(e?.message||e)) }
    } else {
      if (!pw) return
      setBusy(true)
      try {
        const h = await sha256Hex(pw)
        setBusy(false)
        if (h === authHash) onUnlock()
        else { setErr('รหัสผ่านไม่ถูกต้อง'); setPw('') }
      } catch(e) { setBusy(false); setErr('เกิดข้อผิดพลาด: '+(e?.message||e)) }
    }
  }

  const fieldSt = {display:'flex',alignItems:'center',background:'#fff',borderRadius:12,padding:'0 16px',border:err?`1px solid ${CI.red}`:'1px solid transparent'}
  const inputSt = {flex:1,background:'transparent',border:'none',outline:'none',color:'#15181C',fontFamily:'Barlow Condensed',fontSize:16,padding:'15px 8px'}
  const eyeSt   = {cursor:'pointer',fontSize:18,userSelect:'none',padding:'0 2px'}
  const lockSt  = {fontSize:18,marginRight:2,flexShrink:0}

  return (
    <div style={{background:CI.yellow,minHeight:'100dvh',position:'relative',overflowX:'hidden'}}>

      {/* มาสคอต — ยึดมุมล่างซ้าย/ขวาของจอเสมอ ไม่เลื่อนตามเนื้อหา */}
      <img src="/icons/cockpit-boy-login.png" alt="" onError={e=>{e.target.style.display='none'}}
        style={{position:'fixed',left:0,bottom:0,width:compact?'42vw':280,maxWidth:compact?200:280,height:'auto',pointerEvents:'none',zIndex:0}}/>
      <img src="/icons/cockpit-girl-login.png" alt="" onError={e=>{e.target.style.display='none'}}
        style={{position:'fixed',right:0,bottom:0,width:compact?'42vw':280,maxWidth:compact?200:280,height:'auto',pointerEvents:'none',zIndex:0}}/>

      {/* เนื้อหา — เลื่อนดูได้อิสระถ้าจอเตี้ยเกิน (เช่น แนวนอน) โดยไม่กระทบตำแหน่งมาสคอต */}
      <div style={{position:'relative',zIndex:1,minHeight:'100dvh',overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',paddingTop:`max(${compact?28:44}px, calc(16px + env(safe-area-inset-top,0px)))`,paddingBottom:`max(20px, calc(20px + env(safe-area-inset-bottom,0px)))`,paddingLeft:20,paddingRight:20,boxSizing:'border-box'}}>

        {/* หัวเรื่อง — โลโก้ใหญ่ + ป้าย sale intelligence */}
        <div style={{textAlign:'center',marginBottom:compact?20:28}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:compact?34:52,color:CI.black,letterSpacing:2,lineHeight:1}}>COCKPIT</div>
          <div style={{display:'inline-block',marginTop:8,background:CI.black,borderRadius:8,padding:compact?'5px 16px':'7px 22px'}}>
            <span style={{fontFamily:'Barlow Condensed',fontStyle:'italic',fontWeight:800,fontSize:compact?15:20,color:CI.yellow}}>sale intelligence</span>
          </div>
        </div>

        {/* การ์ดเข้าสู่ระบบ */}
        <div style={{width:'100%',maxWidth:360,background:CI.black,borderRadius:20,padding:compact?'26px 22px':'32px 28px',boxShadow:'0 16px 40px rgba(0,0,0,.35)',textAlign:'center',flexShrink:0}}>
          <div style={{fontFamily:'Barlow Condensed',fontSize:15,color:'#e5e7eb'}}>ยินดีต้อนรับสู่</div>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:28,color:CI.yellow,letterSpacing:1,lineHeight:1.15,marginTop:4}}>COCKPIT</div>
          <div style={{fontFamily:'Barlow Condensed',fontStyle:'italic',fontWeight:700,fontSize:15,color:CI.yellow,marginBottom:16}}>sale intelligence</div>
          <div style={{fontFamily:'Barlow Condensed',fontSize:14,color:'#e5e7eb',marginBottom:14}}>
            {isSetup ? 'ตั้งรหัสผ่านเข้าระบบครั้งแรก' : 'กรุณาใส่รหัสผ่าน'}
          </div>

          <div style={fieldSt}>
            <span style={lockSt}>🔒</span>
            <input type={show?'text':'password'} value={pw} onChange={e=>{setPw(e.target.value);setErr('')}}
              onKeyDown={e=>{if(e.key==='Enter'){ if(!isSetup) submit(); else if(pw2) submit() }}}
              placeholder="Password" autoFocus style={inputSt}/>
            <span onClick={()=>setShow(s=>!s)} style={eyeSt}>{show?'🙈':'👁'}</span>
          </div>

          {isSetup && (
            <div style={{...fieldSt,marginTop:10}}>
              <span style={lockSt}>🔒</span>
              <input type={show?'text':'password'} value={pw2} onChange={e=>{setPw2(e.target.value);setErr('')}}
                onKeyDown={e=>{if(e.key==='Enter') submit()}}
                placeholder="ยืนยันรหัสผ่านอีกครั้ง" style={inputSt}/>
            </div>
          )}

          {err && <div style={{color:CI.red,fontSize:12,marginTop:10,fontFamily:'Barlow Condensed',fontWeight:600}}>⚠️ {err}</div>}

          <button onClick={submit} disabled={busy}
            style={{width:'100%',marginTop:18,padding:'15px 0',background:busy?'#555':CI.yellow,color:CI.black,
                    border:'none',borderRadius:12,cursor:busy?'default':'pointer',fontFamily:'Barlow Condensed',fontWeight:900,fontSize:18,letterSpacing:1}}>
            {busy ? 'กำลังตรวจสอบ...' : (isSetup ? 'ตั้งรหัสผ่าน' : 'เข้าสู่ระบบ')}
          </button>
        </div>

        <div style={{marginTop:20,fontSize:11,color:'#5c5200',fontFamily:'Barlow Condensed'}}>COCKPIT ZONE INTELLIGENCE © {new Date().getFullYear()}</div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   TAB DEFINITIONS
════════════════════════════════════════════════════════ */
const TABS = [
  {id:'overview', label:'🏠 ภาพรวม',   mLabel:'🏠', mText:'หน้าหลัก'},
  {id:'morning',  label:'☀️ Morning',   mLabel:'☀️', mText:'Morning'},
  {id:'mtd',      label:'📊 MTD',        mLabel:'📊', mText:'MTD'},
  {id:'products', label:'🛍 สินค้า',    mLabel:'🛍', mText:'สินค้า'},
  {id:'daily',    label:'📅 รายวัน',    mLabel:'📅', mText:'รายวัน'},
  {id:'monthly',  label:'📈 รายเดือน',  mLabel:'📈', mText:'รายเดือน'},
  {id:'tracker',  label:'🎯 Tracker',    mLabel:'🎯', mText:'Tracker'},
  {id:'asp',      label:'💰 ASP & SPD',  mLabel:'💰', mText:'ASP'},
  {id:'entry',    label:'✏️ กรอกยอด',   mLabel:'✏️', mText:'กรอก'},
  {id:'upload',   label:'📁 Excel',      mLabel:'📁', mText:'Excel'},
  {id:'settings', label:'⚙️ ตั้งค่า',   mLabel:'⚙️', mText:'ตั้งค่า'},
]

/* ════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════ */
export default function App() {
  const mobile = useIsMobile()
  const compact = useViewportMobile()   // true เมื่อจอแคบ (มือถือ) · false บนจอกว้าง (PC/แท็บเล็ต)
  const [tab, setTab]   = useState('overview')

  /* ── เขต (AM) ที่กำลังดู — ค่าเริ่มต้น = เขตเดิม (Nopporn) เพื่อไม่กระทบการใช้งานปัจจุบัน
     เก็บไว้ที่เครื่อง (localStorage) เพราะแต่ละคน/แต่ละเขตอาจอยากเห็นคนละเขตกัน ── */
  const [selectedZone, setSelectedZoneRaw] = useState(() => {
    try { return localStorage.getItem('cp_zone') || 'ALL' } catch { return 'ALL' }
  })
  const setSelectedZone = (z) => {
    setSelectedZoneRaw(z)
    try { localStorage.setItem('cp_zone', z) } catch {}
    setSelBr('ALL')  // เปลี่ยนเขตแล้วรีเซ็ตสาขาที่เลือกไว้ กันเลือกสาขาข้ามเขต
  }
  /* BRANCHES = สาขาที่ "มองเห็น" ตอนนี้ (กรองตามเขต) — ใช้แทนตัวแปร BRANCHES เดิมทั้งไฟล์ */
  const BRANCHES = useMemo(
    () => selectedZone === 'ALL' ? ALL_BRANCHES : ALL_BRANCHES.filter(b => b.zone === selectedZone),
    [selectedZone]
  )

  const [selBr, setSelBr] = useState('ALL')
  const [ready, setReady] = useState(false)
  const [connErr, setConnErr] = useState(false)
  const contentRef = useRef(null)
  const [capturing, setCapturing] = useState(false)

  /* ── บันทึกภาพหน้านี้ทั้งหมด (รวมส่วนที่ต้องเลื่อนดู) เป็น PNG ── */
  const captureScreen = useCallback(async () => {
    const el = contentRef.current
    if (!el || capturing) return
    setCapturing(true)
    // 1) ปลดล็อก flex:1 ชั่วคราว — ปกติ contentRef ถูกยืดให้เต็มจอด้วย flex-grow แม้เนื้อหาสั้นกว่าจอ
    //    ทำให้ภาพที่บันทึกมีพื้นที่ว่างเปล่าด้านล่างเท่ากับส่วนที่ยืดเกินเนื้อหาจริง
    const elPrev = { flex: el.style.flex, height: el.style.height, minHeight: el.style.minHeight }
    el.style.flex = '0 0 auto'
    el.style.height = 'auto'
    el.style.minHeight = '0'
    // 2) เปิด overflow ทุกชนิดที่ซ่อน/ตัดเนื้อหาไว้ชั่วคราว (auto/scroll/hidden) เช่น ตารางเลื่อนแนวนอน
    //    เพื่อให้บันทึกภาพได้ครบทุกคอลัมน์ ไม่ใช่แค่ส่วนที่มองเห็นบนจอ
    const touched = []
    const nodes = [el, ...el.querySelectorAll('*')]
    nodes.forEach(node => {
      const cs = window.getComputedStyle(node)
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        touched.push({
          node,
          overflow: node.style.overflow, overflowX: node.style.overflowX, overflowY: node.style.overflowY,
          maxHeight: node.style.maxHeight, maxWidth: node.style.maxWidth,
        })
        node.style.overflow = 'visible'
        node.style.overflowX = 'visible'
        node.style.overflowY = 'visible'
        node.style.maxHeight = 'none'
        node.style.maxWidth = 'none'
      }
    })
    // รอเฟรมนึงให้ layout จัดใหม่ตามขนาดจริงหลังเปิด overflow แล้ว ก่อนวัดขนาด/บันทึกภาพ
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    // วัดขนาดเต็มจริงหลังเปิด overflow แล้ว — ต้องบอก html2canvas ตรงๆ ว่าภาพควรกว้าง/สูงเท่านี้
    // เพราะแค่เปิด overflow:visible ทำให้ "ไม่ถูกตัด" แต่ผืนภาพ (canvas) เดิมยังแคบเท่าตัวกล่องเดิมอยู่
    const fullWidth  = Math.max(el.scrollWidth,  el.getBoundingClientRect().width)
    const fullHeight = Math.max(el.scrollHeight, el.getBoundingClientRect().height)
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#0d1117',
        useCORS: true,
        scale: 2,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
      })
      const link = document.createElement('a')
      const stamp = new Date().toISOString().slice(0,10)
      link.download = `cockpit-${tab}-${stamp}.jpg`
      link.href = canvas.toDataURL('image/jpeg', 0.92)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      alert('บันทึกภาพไม่สำเร็จ: ' + (err?.message || err))
    } finally {
      touched.forEach(({node,overflow,overflowX,overflowY,maxHeight,maxWidth}) => {
        node.style.overflow = overflow
        node.style.overflowX = overflowX
        node.style.overflowY = overflowY
        node.style.maxHeight = maxHeight
        node.style.maxWidth = maxWidth
      })
      el.style.flex = elPrev.flex
      el.style.height = elPrev.height
      el.style.minHeight = elPrev.minHeight
      setCapturing(false)
    }
  }, [tab, capturing])

  /* ── App state (synced via Supabase) ── */
  const [deAll, setDeAll]   = useState(() => Object.fromEntries(ALL_BRANCHES.map(b=>[b.id,{}])))
  const [TARGET, setTARGET] = useState(SEED_T)
  const [HIST, setHIST]     = useState(SEED_H)
  const [cfg, setCfg]       = useState(DEFAULT_CFG)
  const [fcst, setFcst]     = useState({})
  const [upStat, setUpStat] = useState({})
  const [histDailySales, setHistDailySales] = useState({})  // { bid: {'YYYY-MM':{day:฿}} }
  const [histTireQ, setHistTireQ] = useState({})            // { bid: { 2024:[12], 2025:[12], 2026:[12] } }
  const [histDailyTire,  setHistDailyTire]  = useState({})  // { bid: {'YYYY-MM':{day:qty}} }
  const [uploadedMtAll,  setUploadedMtAll]  = useState({})  // {yr:{mo:qty}} Total sheet จาก Data_sale_by_Store

  /* ── Password gate — ต้องใส่รหัสใหม่ทุกวัน (จำไว้แค่ภายในวันเดียวกัน) ── */
  const [authHash, setAuthHash] = useState(null)   // SHA-256 hex ของรหัสผ่านปัจจุบัน (เก็บบน Supabase key 'cp_auth')
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem('cp_unlocked_date') === new Date().toDateString() } catch { return false }
  })
  const onUnlock = useCallback(() => {
    setUnlocked(true)
    try { localStorage.setItem('cp_unlocked_date', new Date().toDateString()) } catch {}
  }, [])
  const logout = useCallback(() => {
    try { localStorage.removeItem('cp_unlocked_date') } catch {}
    setUnlocked(false)
  }, [])
  // เผื่อเปิดแอปทิ้งไว้ข้ามคืน — เช็คทุก 1 นาทีว่าข้ามวันแล้วหรือยัง ถ้าข้ามวันให้ล็อกออกอัตโนมัติ
  useEffect(() => {
    const iv = setInterval(() => {
      let d = null
      try { d = localStorage.getItem('cp_unlocked_date') } catch {}
      if (d !== new Date().toDateString()) setUnlocked(false)
    }, 60000)
    return () => clearInterval(iv)
  }, [])

  /* ── Load all data & subscribe to realtime changes ── */
  useEffect(() => {
    let settled = false

    const finish = (isErr = false) => {
      if (settled) return
      settled = true
      if (isErr) setConnErr(true)
      setReady(true)
    }

    ;(async () => {
      try {
        const keys = ['cp_de','cp_tgt','cp_hist','cp_cfg','cp_fcst','cp_up','cp_hdsl','cp_hdtr','cp_tireq','cp_auth']
        const { data: rows, error } = await supabase
          .from('app_data').select('key,value').in('key', keys)

        if (error) throw error

        if (rows) {
          rows.forEach(r => {
            if (r.key==='cp_de')    setDeAll(normalizeDe(r.value))
            if (r.key==='cp_tgt')   setTARGET({...SEED_T, ...r.value})
            if (r.key==='cp_hist')  setHIST(r.value)
            if (r.key==='cp_cfg')   setCfg(r.value)
            if (r.key==='cp_fcst')  setFcst(r.value)
            if (r.key==='cp_up')    setUpStat(r.value)
            if (r.key==='cp_hdsl') setHistDailySales(r.value)
            if (r.key==='cp_hdtr') setHistDailyTire(r.value)
            if (r.key==='cp_tireq') setHistTireQ(r.value)
            if (r.key==='cp_auth')  setAuthHash(r.value)
          })
        }
        finish(false)  // ✅ โหลดสำเร็จ ไม่โชว์ banner

      } catch(e) {
        console.error('Supabase error:', e)
        finish(true)   // ❌ error จริง โชว์ banner
      }
    })()

    /* Realtime subscription */
    const ch = DB.listen(payload => {
      const r = payload.new
      if (!r?.key) return                                        // null guard
      if (r.key==='cp_de'   && r.value!=null) setDeAll(normalizeDe(r.value))
      if (r.key==='cp_tgt'  && r.value!=null) setTARGET({...SEED_T, ...r.value})
      if (r.key==='cp_hist' && r.value!=null) setHIST(r.value)
      if (r.key==='cp_cfg'  && r.value!=null) setCfg(r.value)
      if (r.key==='cp_fcst' && r.value!=null) setFcst(r.value)
      if (r.key==='cp_up'   && r.value!=null) setUpStat(r.value)
      if (r.key==='cp_hdsl' && r.value!=null) setHistDailySales(r.value)
      if (r.key==='cp_hdtr' && r.value!=null) setHistDailyTire(r.value)
      if (r.key==='cp_umtal'&& r.value!=null) setUploadedMtAll(r.value)
      if (r.key==='cp_tireq'&& r.value!=null) setHistTireQ(r.value)
      if (r.key==='cp_auth' && r.value!=null) setAuthHash(r.value)
    })

    // Timeout 10s — แสดง app แต่ไม่โชว์ banner (ช้าไม่ใช่ error)
    const t = setTimeout(() => finish(false), 10000)

    /* ── Fallback polling (ลด egress) ──────────────────────────────────
       เดิม: poll ทุก 3 วินาที ตลอดเวลา แม้แอปถูกพับไว้เบื้องหลัง
             → ดึงก้อน cp_de (ข้อมูลรายวันทุกสาขา) ซ้ำ ~1,200 ครั้ง/ชม./เครื่อง
             → egress พุ่งจนเกินโควต้า Supabase (Free Plan)
       ใหม่: - Realtime subscription เป็นช่องทางหลักในการรับอัปเดต (push, ไม่กิน egress ซ้ำ)
             - poll เป็นแค่ตาข่ายกันพลาด: ทุก 60 วินาที (ลดลง 20 เท่า)
             - หยุด poll ทั้งหมดเมื่อแอปไม่ได้อยู่บนหน้าจอ (แท็บพับ/สลับแอป)
             - พอกลับมาดูอีกครั้ง ดึงข้อมูลสดทันที 1 ครั้ง แล้วเริ่มจับเวลาใหม่
       ผลลัพธ์: egress ลดลงหลายสิบเท่า แต่ผู้ใช้ยังเห็นข้อมูลล่าสุดเสมอ            */
    const POLL_MS = 60000
    let poll = null

    const fetchDe = async () => {
      try {
        const fresh = await DB.get('cp_de')
        if (fresh != null) setDeAll(normalizeDe(fresh))
      } catch(e) { /* silent */ }
    }

    const startPoll = () => { if (!poll) poll = setInterval(fetchDe, POLL_MS) }
    const stopPoll  = () => { if (poll) { clearInterval(poll); poll = null } }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') { fetchDe(); startPoll() }
      else stopPoll()
    }

    if (document.visibilityState === 'visible') startPoll()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(t)
      stopPoll()
      document.removeEventListener('visibilitychange', onVisibility)
      supabase.removeChannel(ch)
    }
  }, [])

  /* ── Write helpers ── */
  // deAllRef holds the latest deAll state for DB.set outside state updater
  const deAllRef = useRef({})
  const saveDay = useCallback((bid, day, field, val) => {
    const mk = deKey(cfg)
    setDeAll(prev => {
      const branch = prev[bid] || {}
      const month  = branch[mk] || {}
      const next = {...prev, [bid]:{...branch, [mk]:{...month, [day]:{...(month[day]||EMPTY_ROW()), [field]:val}}}}
      deAllRef.current = next
      return next
    })
    // Save AFTER state update using a micro-task to avoid calling inside updater
    setTimeout(() => DB.set('cp_de', deAllRef.current), 0)
  }, [cfg.year, cfg.month])

  const delDay = useCallback((bid, day) => {
    const mk = deKey(cfg)
    setDeAll(prev => {
      const branch = {...(prev[bid]||{})}
      const month  = {...(branch[mk]||{})}; delete month[day]
      branch[mk] = month
      const next = {...prev, [bid]:branch}
      deAllRef.current = next
      return next
    })
    setTimeout(() => DB.set('cp_de', deAllRef.current), 0)
  }, [cfg.year, cfg.month])

  const saveCfg = (next) => { setCfg(next); DB.set('cp_cfg', next) }

  /* ── Derived date constants ── */
  const TODAY_D  = cfg.todayDay
  const TOTAL_D  = dIM(cfg.year, cfg.month)
  const DAYS_LEFT = Math.max(1, TOTAL_D - TODAY_D)
  const MTD_R    = TODAY_D / TOTAL_D
  const MONTH_TH = MONTHS_TH[cfg.month-1]
  const DATE_LABEL = `${TODAY_D} ${MONTH_TH} ${cfg.year}`

  /* ── de view เฉพาะเดือนปัจจุบัน ──
     deAll เก็บแยกเดือน (de[สาขา]["YYYY-M"][วัน]) แต่ทุก component อ่านผ่าน `de`
     ซึ่งเป็น flat {วัน:row} ของเดือนที่ cfg ชี้อยู่ → MTD รวมเฉพาะเดือนนี้      */
  const MKEY = deKey(cfg)
  const de = useMemo(() => {
    const out = {}
    BRANCHES.forEach(b => { out[b.id] = deAll[b.id]?.[MKEY] || {} })
    return out
  }, [deAll, MKEY])

  /* ── Computed ── */
  const getMTD    = (bid) => sumDays(de, bid)
  const getTS     = (bid) => calcTS(getMTD(bid))
  const getAllMTD  = () => { const agg=Object.fromEntries(FIELDS.map(f=>[f.key,0])); BRANCHES.forEach(b=>{const m=getMTD(b.id);FIELDS.forEach(f=>{agg[f.key]+=m[f.key]})}); return agg }
  const getAllTS   = () => BRANCHES.reduce((s,b)=>s+getTS(b.id),0)
  const getT      = (bid) => {
    const EMPTY_T = {sales:0,tire:0,lube:0,battery:0,brake:0,shock:0,mp:0,cc:0}
    const base = bid==='ALL'
      ? BRANCHES.reduce((a,b)=>{const t=TARGET[b.id]||SEED_T[b.id]||EMPTY_T;return {sales:a.sales+t.sales,tire:a.tire+t.tire,lube:a.lube+t.lube,battery:a.battery+t.battery,brake:a.brake+t.brake,shock:a.shock+t.shock,mp:a.mp+t.mp,cc:a.cc+t.cc}},{...EMPTY_T})
      : (TARGET[bid]||SEED_T[bid]||EMPTY_T)
    return {
      ...base,
      tireSalesTgt: base.tire * 3800,            // ยอดขายยาง เป้า = ยาง×3,800฿
      ccFormula: Math.round(base.sales / 5100),  // Job Order เป้า = ยอดขาย÷5,100฿
    }
  }

  const getH26 = (bid) => {
    // EXCEL_MS (ประวัติยอดขาย.xlsx) ก่อน HIST (Supabase) สำหรับทุกเดือนของปี 2026
    // Fallback: sum deAll entries ของเดือนนั้น (กรณียังไม่ได้ upload Excel รายเดือน เช่น เดือนที่ผ่านมา)
    const getMonthSales26 = (b, i) => {
      const ex = EXCEL_MS[b]?.['2026']?.[String(i+1)]
      if (ex > 0) return Math.round(ex/1000)
      const v = HIST[b]?.[2026]?.[i]
      if (v != null && v > 0) return v
      // fallback: sum deAll for this month
      const mk = `2026-${i+1}`
      const entries = deAll[b]?.[mk] || {}
      const sum = Object.values(entries).reduce((s,row)=>{
        const agg = Object.fromEntries(FIELDS.map(f=>[f.key,Number(row[f.key])||0]))
        return s + calcTS(agg)
      }, 0)
      return sum > 0 ? Math.round(sum/1000) : null
    }
    const base = bid==='ALL'
      ? Array(12).fill(0).map((_,i)=>{
          const vals=BRANCHES.map(b=>getMonthSales26(b.id,i)).filter(v=>v!=null)
          return vals.length>0 ? vals.reduce((a,v)=>a+v,0) : null
        })
      : Array(12).fill(0).map((_,i)=>getMonthSales26(bid,i))
    const mv = bid==='ALL'?getAllTS():getTS(bid)
    // ใช้ MTD (de entry) override เฉพาะเดือนปัจจุบันเมื่อมียอดกรอกมือมากกว่า Excel
    if (mv>0 && base[cfg.month-1]==null) base[cfg.month-1] = Math.round(mv/1000)
    return base
  }
  const getH = (bid) => {
    // ยอดขาย ฿ รายเดือน: EXCEL_MS (ประวัติยอดขาย.xlsx ฝัง) > HIST (Supabase, อาจเป็นค่าเก่า)
    // Data_sale_by_Store.xlsx ให้เฉพาะยาง (เส้น) เท่านั้น
    const getSales = (b, yr, i) => {
      // EXCEL_MS (จาก ประวัติยอดขาย.xlsx ล่าสุด) มาก่อน HIST (Supabase ค่าเก่า/อาจผิดจากการอัพโหลดครั้งก่อน)
      const ex = EXCEL_MS[b]?.[String(yr)]?.[String(i+1)]
      if (ex > 0) return Math.round(ex/1000)
      const v = HIST[b]?.[yr]?.[i]
      if (v != null && v > 0) return v
      return null  // ไม่มีข้อมูลเดือนนี้ — แสดงเป็นช่องว่างใน chart แทน 0
    }
    if (bid==='ALL') {
      const h={}
      ;[2023,2024,2025,2026].forEach(yr=>{
        h[yr]=Array(12).fill(0).map((_,i)=>{
          const vals=BRANCHES.map(b=>getSales(b.id,yr,i)).filter(v=>v!=null)
          return vals.length>0 ? vals.reduce((a,v)=>a+v,0) : null
        })
      })
      h[2026]=getH26('ALL')
      return h
    }
    const h={}
    ;[2023,2024,2025,2026].forEach(yr=>{
      h[yr]=Array(12).fill(0).map((_,i)=>getSales(bid,yr,i))
    })
    h[2026]=getH26(bid)
    return h
  }

  /* ── AI helpers ── */



  const ctx = {selBr,setSelBr,de,deAll,saveDay,delDay,getMTD,getTS,getAllMTD,getAllTS,getT,getH,TARGET,HIST,fcst,upStat,setUpStat,setTARGET,setHIST,cfg,saveCfg,TODAY_D,TOTAL_D,DAYS_LEFT,MTD_R,MONTH_TH,DATE_LABEL,mobile,FIELDS,histDailySales,setHistDailySales,histDailyTire,setHistDailyTire,histTireQ,setHistTireQ,uploadedMtAll,setUploadedMtAll,sumDaysUpTo,calcTS,BRANCHES,BCLR,ALL_BRANCHES,ZONES,selectedZone,setSelectedZone,HOME_ZONE,authHash,setAuthHash,logout}

  /* ── Loading screen ── */
  if (!ready) return (
    <div style={{background:'#0d1117',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:20}}>
      <img src="/icons/apple-touch-icon.png" alt="Cockpit" style={{width:80,height:80,borderRadius:16}}
        onError={e=>{e.target.style.display='none'}}/>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:22,color:CI.yellow,letterSpacing:3}}>COCKPIT</div>
      <div style={{fontFamily:'Barlow Condensed',fontSize:14,color:'#6b7280'}}>SALES INTELLIGENCE</div>
      <style>{`@keyframes slide{0%{width:0}60%{width:70%}100%{width:100%}}.bar{animation:slide 1.8s ease-in-out infinite}`}</style>
      <div style={{width:180,height:3,background:'#1e2538',borderRadius:2,overflow:'hidden'}}><div className="bar" style={{height:'100%',background:CI.yellow,borderRadius:2}}/></div>
      <div style={{fontSize:11,color:'#4b5563'}}>กำลังเชื่อมต่อ Supabase...</div>
    </div>
  )

  /* ── Lock screen — ต้องใส่รหัสผ่านก่อนเข้าแอป (จำไว้แค่วันเดียวกัน) ── */
  if (!unlocked) return <LockScreen authHash={authHash} setAuthHash={setAuthHash} onUnlock={onUnlock} compact={compact}/>

  /* ── Connection error banner (shown inside app) ── */
  const ConnBanner = connErr ? (
    <div style={{background:'#7c2d12',borderBottom:'1px solid #ea580c',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
      <div style={{fontSize:12,color:'#fed7aa'}}>
        ⚠️ Supabase ออฟไลน์ — ข้อมูลอาจไม่ sync · ไปที่{' '}
        <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
          style={{color:'#fb923c',fontWeight:700}}>supabase.com/dashboard</a>
        {' '}เพื่อ Resume project
      </div>
      <button onClick={()=>window.location.reload()}
        style={{padding:'4px 12px',background:'#ea580c',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,whiteSpace:'nowrap'}}>
        🔄 ลองใหม่
      </button>
    </div>
  ) : null

  return (
    <div style={{fontFamily:'Barlow,sans-serif',background:'#0d1117',height:'100dvh',display:'flex',flexDirection:'column',color:'#e5e7eb',overflow:'hidden'}}>

      {/* HEADER — safe area top */}
      <div style={{background:'linear-gradient(90deg,#161b25,#0d1117)',borderBottom:`2px solid ${CI.yellow}`,padding:`calc(${compact?'8px':'10px'} + env(safe-area-inset-top,0px)) ${compact?'12px':'20px'} ${compact?'8px':'10px'}`,display:'flex',alignItems:'center',gap:10,flexShrink:0,zIndex:50}}>
        <div style={{width:compact?30:38,height:compact?30:38,background:CI.yellow,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:compact?16:20,flexShrink:0}}>🏁</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:compact?13:20,letterSpacing:compact?1:3,color:CI.yellow,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>COCKPIT ZONE INTELLIGENCE</div>
          <div style={{fontSize:9,color:'#6b7280'}}>{DATE_LABEL} · เหลือ {DAYS_LEFT} วัน · {BRANCHES.length} สาขา</div>
        </div>
        {/* เลือกเขต (AM) — กรองสาขาที่แสดงทั้งแอปตามเขต */}
        <select value={selectedZone} onChange={e=>setSelectedZone(e.target.value)} title="เลือกเขต"
          style={{background:'#1e2538',border:`1px solid ${CI.yellow}`,borderRadius:6,padding:compact?'5px 6px':'6px 10px',color:CI.yellow,fontFamily:'Barlow Condensed',fontWeight:700,fontSize:compact?11:12,outline:'none',flexShrink:0,maxWidth:compact?90:160}}>
          <option value="ALL">🌐 ทุกเขต ({ALL_BRANCHES.length})</option>
          {ZONES.map(z=><option key={z.key} value={z.key}>{z.key} ({z.count})</option>)}
        </select>
        {/* บันทึกภาพหน้านี้ทั้งหมด */}
        <button onClick={captureScreen} disabled={capturing} title="บันทึกภาพหน้านี้ทั้งหมด"
          style={{display:'flex',alignItems:'center',gap:5,background:capturing?'#333':CI.yellow,
                  color:CI.black,border:'none',borderRadius:8,padding:compact?'6px 8px':'6px 12px',
                  cursor:capturing?'default':'pointer',flexShrink:0,fontFamily:'Barlow Condensed',fontWeight:700,fontSize:compact?11:12}}>
          {capturing ? '⏳' : '📸'}{!compact && <span>{capturing?'กำลังบันทึก...':'บันทึกภาพ'}</span>}
        </button>

        {/* LIVE badge — เขียว=เชื่อมต่อ, แดง=หลุดการเชื่อมต่อ */}
        <div style={{display:'flex',alignItems:'center',gap:5,background:connErr?'#2a0d0d':'#0d2a1a',border:`1px solid ${connErr?'#E2231A':'#22c55e'}`,borderRadius:10,padding:'3px 8px',flexShrink:0}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:connErr?'#E2231A':'#22c55e',animation:'pulse 2s infinite'}}/>
          <span style={{fontSize:9,color:connErr?'#E2231A':'#22c55e',fontFamily:'Barlow Condensed',fontWeight:700}}>{connErr?'OFFLINE':'LIVE'}</span>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>

      {/* CONNECTION ERROR BANNER */}
      {ConnBanner}

      {/* NAV — อยู่ด้านบนเสมอ ทั้งมือถือและจอกว้าง (mobile ใช้ icon+label เล็ก, desktop ใช้ label เต็ม) */}
      <div style={{display:'flex',background:'#0d1117',borderBottom:'1px solid #1e2538',overflowX:'auto',WebkitOverflowScrolling:'touch',flexShrink:0,zIndex:50}}>
        {TABS.map(t => {
          const isActive = tab===t.id
          return compact ? (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:'0 0 auto',minWidth:52,padding:'7px 2px 5px',background:isActive?'#1a1f2e':'transparent',color:isActive?CI.red:'#4b5563',border:'none',borderBottom:isActive?`2px solid ${CI.red}`:'2px solid transparent',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
              <span style={{fontSize:18}}>{t.mLabel}</span>
              <span style={{fontSize:7.5,fontFamily:'Barlow Condensed',fontWeight:600,whiteSpace:'nowrap'}}>{t.mText}</span>
            </button>
          ) : (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'9px 14px',background:isActive?'#1e2538':'transparent',color:isActive?CI.red:'#6b7280',border:'none',borderBottom:isActive?`2px solid ${CI.red}`:'2px solid transparent',cursor:'pointer',fontFamily:'Barlow Condensed',fontWeight:600,fontSize:13,whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* CONTENT — scrollable */}
      <div ref={contentRef} style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',padding:compact?'10px 10px':'18px 20px',paddingBottom:`calc(${compact?'10px':'18px'} + env(safe-area-inset-bottom,0px))`,maxWidth:1440,margin:'0 auto',width:'100%'}}>
        {tab==='overview' && <Overview ctx={ctx}/>}
        {tab==='morning'  && <MorningBrief ctx={ctx} selBr={selBr} setSelBr={setSelBr}/>}
        {tab==='mtd'      && <MTDTab ctx={ctx}/>}
        {tab==='products' && <Products ctx={ctx}/>}
        {tab==='daily'    && <Daily ctx={ctx}/>}
        {tab==='monthly'  && <Monthly ctx={ctx}/>}
        {tab==='tracker'  && <Tracker ctx={ctx}/>}
        {tab==='asp'      && <ASP ctx={ctx}/>}
        {tab==='entry'    && <Entry ctx={ctx}/>}
        {tab==='upload'   && <Upload ctx={ctx}/>}
        {tab==='settings' && <Settings ctx={ctx}/>}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════
   OVERVIEW TAB
════════════════════════════════════════════════════════ */
function Overview({ctx}) {
  const {getMTD,getTS,TARGET,MTD_R,TODAY_D,MONTH_TH,cfg,mobile,de,HIST,selBr,setSelBr,BRANCHES} = ctx

  const rows = BRANCHES.map((b,i) => {
    const t=TARGET[b.id]||SEED_T[b.id], m=getMTD(b.id), ts=getTS(b.id)
    const py25Sales = (MAY_SALES[b.id]?.[2025]||0)*MTD_R
    const py24Sales = (MAY_SALES[b.id]?.[2024]||0)*MTD_R
    const py25Tire  = (MAY_TIRE[b.id]?.[2025]||0)*MTD_R
    const py24Tire  = (MAY_TIRE[b.id]?.[2024]||0)*MTD_R
    return {
      ...b, t, m, ts, idx:i,
      tgtSales: t.sales,       // Full monthly target (not prorated)
      tgtTire:  t.tire,        // Full monthly tire target
      py25Sales, py24Sales, py25Tire, py24Tire,
      vsPY25: P(ts,py25Sales), vsPY24: P(ts,py24Sales),
      tirePY25: P(m.tire,py25Tire), tirePY24: P(m.tire,py24Tire),
      tireAch: P(m.tire, t.tire),   // vs full monthly tire target
    }
  })

  const visibleRows = (!selBr || selBr==='ALL') ? rows : rows.filter(r => r.id === selBr)

  const totS     = visibleRows.reduce((s,r)=>s+r.ts,0)
  const totT     = visibleRows.reduce((s,r)=>s+r.tgtSales,0)
  const totTire  = visibleRows.reduce((s,r)=>s+r.m.tire,0)
  const totTireT = visibleRows.reduce((s,r)=>s+r.tgtTire,0)
  const totPY25  = visibleRows.reduce((s,r)=>s+r.py25Sales,0)
  const totPY24  = visibleRows.reduce((s,r)=>s+r.py24Sales,0)
  const totTirePY25 = visibleRows.reduce((s,r)=>s+r.py25Tire,0)
  const totTirePY24 = visibleRows.reduce((s,r)=>s+r.py24Tire,0)

  // สีป้ายสาขาที่อ่านชัดบนพื้นสว่าง (ตัวอ่อนเช่น lime/cyan จะถูกแทนด้วยโทนเข้มกว่า)
  const READCLR = ['#B45309','#1D4ED8','#047857','#B91C1C','#6D28D9','#C2410C','#0E7490','#BE123C','#4D7C0F','#BE185D']
  const gc = p => (p>=100?STATUS.over:p>=90?STATUS.near:STATUS.push)

  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1,minWidth:0}}>
      {/* Summary cards row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'#666',fontWeight:700,letterSpacing:.5,fontFamily:'Barlow Condensed'}}>ยอดขายรวม MTD</div>
            <div style={{fontSize:23,fontWeight:900,color:CI.red,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>{fM(totS)}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:5,marginTop:2}}>
              <span style={{fontSize:11,color:'#666',fontWeight:800,fontFamily:'Barlow Condensed'}}>เป้า</span>
              <span style={{fontSize:23,fontWeight:900,color:CI.black,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>{fM(Math.round(totT))}</span>
            </div>
            <div style={{display:'flex',gap:9,marginTop:5,flexWrap:'wrap',fontSize:10,fontWeight:700}}>
              <span style={{color:statusColor(P(totS,totT))}}>vsเป้า {P(totS,totT).toFixed(0)}%</span>
              <span style={{color:statusColor(P(totS,totPY25))}}>vsPY25 {P(totS,totPY25).toFixed(0)}%</span>
              <span style={{color:statusColor(P(totS,totPY24))}}>vsPY24 {P(totS,totPY24).toFixed(0)}%</span>
            </div>
          </div>
          <div style={{position:'relative',flexShrink:0,alignSelf:'center'}}>
            <Ring value={P(totS,totT)}/>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                         fontSize:13,fontWeight:900,color:statusColor(P(totS,totT))}}>{P(totS,totT).toFixed(0)}%</div>
          </div>
        </div>
        <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'#666',fontWeight:700,letterSpacing:.5,fontFamily:'Barlow Condensed'}}>ยางรวม MTD</div>
            <div style={{fontSize:23,fontWeight:900,color:'#15181C',fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>{N(totTire)} <span style={{fontSize:13}}>เส้น</span></div>
            <div style={{display:'flex',alignItems:'baseline',gap:5,marginTop:2}}>
              <span style={{fontSize:11,color:'#666',fontWeight:800,fontFamily:'Barlow Condensed'}}>เป้า</span>
              <span style={{fontSize:23,fontWeight:900,color:'#15181C',fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>{N(Math.round(totTireT))} <span style={{fontSize:13}}>เส้น</span></span>
            </div>
            <div style={{display:'flex',gap:9,marginTop:5,flexWrap:'wrap',fontSize:10,fontWeight:700}}>
              <span style={{color:statusColor(P(totTire,totTireT))}}>vsเป้า {P(totTire,totTireT).toFixed(0)}%</span>
              <span style={{color:statusColor(P(totTire,totTirePY25))}}>vsPY25 {P(totTire,totTirePY25).toFixed(0)}%</span>
              <span style={{color:statusColor(P(totTire,totTirePY24))}}>vsPY24 {P(totTire,totTirePY24).toFixed(0)}%</span>
            </div>
          </div>
          <div style={{position:'relative',flexShrink:0,alignSelf:'center'}}>
            <Ring value={P(totTire,totTireT)}/>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                         fontSize:13,fontWeight:900,color:statusColor(P(totTire,totTireT))}}>{P(totTire,totTireT).toFixed(0)}%</div>
          </div>
        </div>

        {/* PY25+PY24 รวมเป็นกล่องเดียว — ใช้พื้นที่ขวาที่ว่างแสดงยอดที่ขาดถึงเป้า */}
        <div style={{gridColumn:'1 / span 2',background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,
                     padding:'8px 12px',display:'flex',gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed'}}>PY25 MTD รวม</div>
            <div style={{fontSize:16,fontWeight:800,color:'#333',fontFamily:"'JetBrains Mono',monospace"}}>{fM(Math.round(totPY25))}</div>
            <div style={{fontSize:10,color:'#888',marginBottom:6}}>ยาง: {N(Math.round(totTirePY25))} เส้น</div>
            <div style={{height:1,background:CI.line,margin:'4px 0'}}/>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed',marginTop:6}}>PY24 MTD รวม</div>
            <div style={{fontSize:16,fontWeight:800,color:'#555',fontFamily:"'JetBrains Mono',monospace"}}>{fM(Math.round(totPY24))}</div>
            <div style={{fontSize:10,color:'#888'}}>ยาง: {N(Math.round(totTirePY24))} เส้น</div>
          </div>
          <div style={{width:1,background:CI.line}}/>
          <div style={{flex:1,textAlign:'right'}}>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed'}}>ขาดยอดขายอีก (ถึงเป้า)</div>
            <div style={{fontSize:18,fontWeight:900,color:CI.red,fontFamily:"'JetBrains Mono',monospace"}}>{fM(Math.max(0,Math.round(totT-totS)))}</div>
            <div style={{height:1,background:CI.line,margin:'8px 0'}}/>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed'}}>ขาดยางอีก (ถึงเป้า)</div>
            <div style={{fontSize:18,fontWeight:900,color:'#15181C',fontFamily:"'JetBrains Mono',monospace"}}>{N(Math.max(0,Math.round(totTireT-totTire)))} เส้น</div>
          </div>
        </div>
      </div>

      {/* Branch cards — fluid grid: 1 col on phones, auto 2/3/4 cols as the screen widens */}
      <div style={{marginBottom:8,fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:CI.red}}>
        📊 {(!selBr||selBr==='ALL') ? 'ภาพรวมทุกสาขา' : `สาขา ${visibleRows[0]?.id} ${visibleRows[0]?.short}`} — MTD 1-{TODAY_D} {MONTH_TH} {cfg.year}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:10}}>
        {visibleRows.map((r,i) => {
          const p = P(r.ts, r.tgtSales)
          const tp = r.tireAch
          return (
            <div key={r.id} style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'9px 12px'}}>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:READCLR[i%READCLR.length],marginBottom:5}}>{r.id} {r.short}</div>

              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:10.5,color:'#666',fontWeight:700,flexShrink:0,width:58}}>💰 ยอดขาย</span>
                <GaugeBar value={p} height={6}/>
                <span style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:CI.red,fontWeight:800}}>{fM(r.ts)}</span>
                  <span style={{width:6,height:6,borderRadius:'50%',background:statusColor(p)}}/>
                  <span style={{fontSize:11,fontWeight:800,color:statusColor(p),minWidth:30,textAlign:'right'}}>{p.toFixed(0)}%</span>
                </span>
              </div>
              <div style={{fontSize:9.5,color:'#999',textAlign:'right',marginTop:1}}>PY25 {r.vsPY25.toFixed(0)}% · PY24 {r.vsPY24.toFixed(0)}%</div>

              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5}}>
                <span style={{fontSize:10.5,color:'#666',fontWeight:700,flexShrink:0,width:58}}>🏷️ ยาง</span>
                <GaugeBar value={tp} height={6}/>
                <span style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#15181C',fontWeight:800}}>{r.m.tire} เส้น</span>
                  <span style={{width:6,height:6,borderRadius:'50%',background:statusColor(tp)}}/>
                  <span style={{fontSize:11,fontWeight:800,color:statusColor(tp),minWidth:30,textAlign:'right'}}>{tp.toFixed(0)}%</span>
                </span>
              </div>
              <div style={{fontSize:9.5,color:'#999',textAlign:'right',marginTop:1}}>PY25 {r.tirePY25.toFixed(0)}% · PY24 {r.tirePY24.toFixed(0)}%</div>
            </div>
          )
        })}
      </div>
      <MascotFooter compact={mobile}/>
      </div>
    </div>
  )
}

/* ════ MTD ════ */
function MTDTab({ctx}) {
  const {selBr,setSelBr,getMTD,getTS,getAllMTD,getAllTS,getT,getH,de,
         MTD_R,TODAY_D,TOTAL_D,MONTH_TH,cfg,mobile,HIST,FIELDS,BRANCHES} = ctx

  // Thai Buddhist year display (e.g. 2024 → "67", 2025 → "68", 2026 → "69")
  const BE2 = yr => String(yr+543).slice(-2)

  // ── All-branches summary data ──────────────────────────────────
  const allRows = BRANCHES.map((b,i) => {
    const t  = getT(b.id)
    const m  = getMTD(b.id)
    const ts = getTS(b.id)
    const tire24 = (MAY_TIRE[b.id]?.[2024]||0)*MTD_R
    const tire25 = (MAY_TIRE[b.id]?.[2025]||0)*MTD_R
    const sale25 = (MAY_SALES[b.id]?.[2025]||0)*MTD_R
    return {
      ...b, i, t, m, ts,
      tire24:Math.round(tire24), tire25:Math.round(tire25), tire26:m.tire,
      tireTgt:Math.round(t.tire*MTD_R), tirePct:P(m.tire,t.tire*MTD_R),
      sale25:Math.round(sale25), sale26:Math.round(ts),
      saleTgt:Math.round(t.sales*MTD_R), salePct:P(ts,t.sales*MTD_R),
    }
  })

  // Chart data per branch (for bar charts)
  const barData = allRows.map(r=>({
    name: r.short,
    'ยาง24':r.tire24, 'ยาง25':r.tire25, 'ยาง26':r.tire26,
    'เป้ายาง':r.tireTgt,
    'ยอด25':Math.round(r.sale25/1000), 'ยอด26':Math.round(r.sale26/1000),
    'เป้าขาย':Math.round(r.saleTgt/1000),
  }))

  const totTire24=allRows.reduce((s,r)=>s+r.tire24,0)
  const totTire25=allRows.reduce((s,r)=>s+r.tire25,0)
  const totTire26=allRows.reduce((s,r)=>s+r.tire26,0)
  const totTireTgt=allRows.reduce((s,r)=>s+r.tireTgt,0)
  const totSale25=allRows.reduce((s,r)=>s+r.sale25,0)
  const totSale26=allRows.reduce((s,r)=>s+r.sale26,0)
  const totSaleTgt=allRows.reduce((s,r)=>s+r.saleTgt,0)

  // ── Single branch data ─────────────────────────────────────────
  const isAll=selBr==='ALL'
  const t=getT(selBr), m=isAll?getAllMTD():getMTD(selBr)
  const ts=isAll?getAllTS():getTS(selBr)
  const h=getH(selBr)
  const pyMTD =(MAY_SALES[selBr]?.[2025]||0)*MTD_R
  const py2MTD=(MAY_SALES[selBr]?.[2024]||0)*MTD_R
  const t25   =(MAY_TIRE[selBr]?.[2025]||0)*MTD_R
  const t24   =(MAY_TIRE[selBr]?.[2024]||0)*MTD_R

  const [showMoYr,setShowMoYr]=useState({2023:false,2024:true,2025:true,2026:true})
  const mData=MONTHS_TH.map((mn,i)=>({month:mn,2023:h[2023]?.[i]??null,2024:h[2024]?.[i]??null,2025:h[2025]?.[i]??null,2026:h[2026]?.[i]??null}))

  const yrBtn = (yr, map, clrOvr) => {
    const clr = clrOvr || YRCLR[yr] || '#6b7280'
    return {padding:'4px 10px',borderRadius:4,cursor:'pointer',border:`1px solid ${clr}`,background:map[yr]?clr+'33':'transparent',color:map[yr]?clr:'#4b5563',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11}
  }

  const READCLR2 = ['#B45309','#1D4ED8','#047857','#B91C1C','#6D28D9','#C2410C','#0E7490','#BE123C','#4D7C0F','#BE185D']
  if (isAll) return (
    /* ══ ALL BRANCHES — white-card style เหมือนหน้าหลัก/Tracker/สินค้า ══ */
    <div style={{display:'flex',gap:14,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?14:18,color:CI.red,marginBottom:3}}>
          MTD VS เป้า — ทุกสาขา (1–{TODAY_D} {MONTH_TH} {cfg.year})
        </div>
        <div style={{background:'#1a1f2e',border:`1px solid ${CI.red}44`,borderRadius:6,padding:'6px 12px',marginBottom:10,fontSize:11,color:'#FFB199'}}>
          ⚡ เป้า MTD = เป้ารายเดือน × ({TODAY_D} ÷ {TOTAL_D}) คำนวณตามวันปฏิบัติการ
        </div>

        {/* ── Summary: compact rows สไตล์เดียวกับหน้าหลัก/Tracker/สินค้า ── */}
        <div style={{background:CI.black,borderRadius:10,overflow:'hidden',marginBottom:12}}>
          <div style={{padding:'8px 10px',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:CI.white}}>
            📊 ภาพรวมทุกสาขา — MTD 1-{TODAY_D} {MONTH_TH} {cfg.year}
          </div>
          {allRows.map((r,i) => (
            <div key={r.id} style={{background:CI.white,padding:'7px 10px',borderTop:i===0?'none':`1px solid ${CI.line}`,cursor:'pointer'}} onClick={()=>setSelBr(r.id)}>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:READCLR2[i],marginBottom:3}}>{r.id} {r.short}</div>

              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:10.5,color:'#666',fontWeight:700,flexShrink:0,width:58}}>💰 ยอดขาย</span>
                <GaugeBar value={r.salePct} height={6}/>
                <span style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',justifyContent:'flex-end',flexShrink:0}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:CI.red,fontWeight:800}}>{fM(r.sale26)}</span>
                  <span style={{width:6,height:6,borderRadius:'50%',background:statusColor(r.salePct)}}/>
                  <span style={{fontSize:11,fontWeight:800,color:statusColor(r.salePct),minWidth:30,textAlign:'right'}}>{r.salePct.toFixed(0)}%</span>
                  <span style={{fontSize:9.5,color:'#999'}}>PY{BE2(2025)} {fM(r.sale25)}</span>
                </span>
              </div>

              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                <span style={{fontSize:10.5,color:'#666',fontWeight:700,flexShrink:0,width:58}}>🏷️ ยาง</span>
                <GaugeBar value={r.tirePct} height={6}/>
                <span style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',justifyContent:'flex-end',flexShrink:0}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#222',fontWeight:800}}>{N(r.tire26)} เส้น</span>
                  <span style={{width:6,height:6,borderRadius:'50%',background:statusColor(r.tirePct)}}/>
                  <span style={{fontSize:11,fontWeight:800,color:statusColor(r.tirePct),minWidth:30,textAlign:'right'}}>{r.tirePct.toFixed(0)}%</span>
                  <span style={{fontSize:9.5,color:'#999'}}>PY{BE2(2025)} {N(r.tire25)} เส้น</span>
                </span>
              </div>
            </div>
          ))}

          {/* รวมทุกสาขา */}
          <div style={{background:'#FFF7D6',padding:'8px 10px',borderTop:`2px solid ${CI.red}`}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:13,color:CI.black,marginBottom:3}}>รวมทุกสาขา</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:10.5,color:'#666',fontWeight:700,flexShrink:0,width:58}}>💰 ยอดขาย</span>
              <GaugeBar value={P(totSale26,totSaleTgt)} height={6}/>
              <span style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',justifyContent:'flex-end',flexShrink:0}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:CI.red,fontWeight:900}}>{fM(totSale26)}</span>
                <span style={{fontSize:11,fontWeight:900,color:statusColor(P(totSale26,totSaleTgt))}}>{P(totSale26,totSaleTgt).toFixed(0)}%</span>
              </span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
              <span style={{fontSize:10.5,color:'#666',fontWeight:700,flexShrink:0,width:58}}>🏷️ ยาง</span>
              <GaugeBar value={P(totTire26,totTireTgt)} height={6}/>
              <span style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',justifyContent:'flex-end',flexShrink:0}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:'#222',fontWeight:900}}>{N(totTire26)} เส้น</span>
                <span style={{fontSize:11,fontWeight:900,color:statusColor(P(totTire26,totTireTgt))}}>{P(totTire26,totTireTgt).toFixed(0)}%</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Bar charts ── */}
        <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:12}}>
          {/* Tire by branch */}
          <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:'#FFFFFF',marginBottom:8}}>🏷️ ยาง MTD ปี {BE2(2024)}/{BE2(2025)}/{BE2(2026)}</div>
            <ResponsiveContainer width="100%" height={mobile?180:220}>
              <ComposedChart data={barData} margin={{top:4,right:4,left:0,bottom:30}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3548"/>
                <XAxis dataKey="name" tick={{fill:'#6b7280',fontSize:8}} angle={-35} textAnchor="end" interval={0}/>
                <YAxis tick={{fill:'#6b7280',fontSize:8}}/>
                <Tooltip contentStyle={{background:'#1e2538',border:'1px solid #2d3548',fontSize:11}} formatter={v=>[N(v)+' เส้น','']}/>
                <Legend wrapperStyle={{fontSize:9}}/>
                <Bar dataKey="ยาง24" fill="#475569" radius={[2,2,0,0]}/>
                <Bar dataKey="ยาง25" fill={CI.red} radius={[2,2,0,0]}/>
                <Bar dataKey="ยาง26" fill="#FFFFFF" radius={[2,2,0,0]}/>
                <Line type="monotone" dataKey="เป้ายาง" stroke="#6b7280" strokeWidth={2} strokeDasharray="4 2" dot={{r:3}}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Sale by branch */}
          <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:CI.red,marginBottom:8}}>💰 ยอดขาย MTD ปี {BE2(2025)}/{BE2(2026)} (฿000)</div>
            <ResponsiveContainer width="100%" height={mobile?180:220}>
              <ComposedChart data={barData} margin={{top:4,right:4,left:0,bottom:30}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3548"/>
                <XAxis dataKey="name" tick={{fill:'#6b7280',fontSize:8}} angle={-35} textAnchor="end" interval={0}/>
                <YAxis tick={{fill:'#6b7280',fontSize:8}}/>
                <Tooltip contentStyle={{background:'#1e2538',border:'1px solid #2d3548',fontSize:11}} formatter={v=>[fM(v*1000),'']}/>
                <Legend wrapperStyle={{fontSize:9}}/>
                <Bar dataKey="ยอด25" fill={CI.red} radius={[2,2,0,0]}/>
                <Bar dataKey="ยอด26" fill="#FFFFFF" radius={[2,2,0,0]}/>
                <Line type="monotone" dataKey="เป้าขาย" stroke="#6b7280" strokeWidth={2} strokeDasharray="4 2" dot={{r:3}}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <MascotFooter compact={mobile}/>
      </div>
    </div>
  )

  /* ══ SINGLE BRANCH — daily + monthly trend ══ */
  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?16:20,color:CI.red,letterSpacing:2,marginBottom:10}}>
          {selBr} — {BRANCHES.find(x=>x.id===selBr)?.name}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <Card label="ยอดขาย MTD" value={fM(ts)} target={fM(Math.round(t.sales*MTD_R))}/>
          <Card label="% เทียบเป้า" value={P(ts,t.sales*MTD_R).toFixed(1)+'%'} color={statusColor(P(ts,t.sales*MTD_R))}/>
          <Card label="ยาง MTD" value={N(m.tire)+' เส้น'} target={N(Math.round(t.tire*MTD_R))} color="#15181C"/>
          <Card label="% เทียบเป้ายาง" value={P(m.tire,t.tire*MTD_R).toFixed(1)+'%'} color={statusColor(P(m.tire,t.tire*MTD_R))}/>
        </div>
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:'#94a3b8'}}>📈 ยอดขายรายเดือน (฿000) 2023–2026</div>
            <div style={{display:'flex',gap:5}}>
              {[2023,2024,2025,2026].map(yr=>(<button key={yr} onClick={()=>setShowMoYr(p=>({...p,[yr]:!p[yr]}))} style={yrBtn(yr,showMoYr)}>{yr}</button>))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={mobile?150:200}>
            <LineChart data={mData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548"/>
              <XAxis dataKey="month" tick={{fill:'#6b7280',fontSize:8}}/>
              <YAxis tick={{fill:'#6b7280',fontSize:8}}/>
              <Tooltip contentStyle={{background:'#1e2538',border:'1px solid #2d3548',fontSize:11}} formatter={v=>[v!=null?N(v*1000)+'฿':'—','']}/>
              {[2023,2024,2025,2026].filter(yr=>showMoYr[yr]).map(yr=>(
                <Line key={yr} type="monotone" dataKey={yr} stroke={YRCLR[yr]} strokeWidth={yr===2026?3:1.5} dot={yr===2026?{r:3}:false} strokeDasharray={yr===2026?'6 3':'none'} connectNulls={false}/>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#0d1117'}}>
              {['ปี',`ยาง ${BE2(2024)}`,`ยาง ${BE2(2025)}`,`ยาง ${BE2(2026)}`,'เป้า %',`ยอด ${BE2(2025)}`,`ยอด ${BE2(2026)}`,'เป้าเดือน'].map(h=><th key={h} style={{padding:'7px 8px',textAlign:'right',color:'#6b7280',fontSize:10,fontFamily:'Barlow Condensed'}}>{h}</th>)}
            </tr></thead>
            <tbody>
              <tr style={{borderBottom:'1px solid #1e2538'}}>
                <td style={{padding:'8px 8px',color:'#9ca3af',fontSize:11}}>ข้อมูล</td>
                <td style={{padding:'8px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",color:'#475569'}}>{Math.round(t24)}</td>
                <td style={{padding:'8px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",color:'#94a3b8'}}>{Math.round(t25)}</td>
                <td style={{padding:'8px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:'#FFFFFF'}}>{m.tire}</td>
                <td style={{padding:'8px 8px',textAlign:'right'}}><PctBadge v={P(m.tire,t.tire*MTD_R)}/></td>
                <td style={{padding:'8px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",color:'#94a3b8'}}>{fM(Math.round(pyMTD))}</td>
                <td style={{padding:'8px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:CI.red}}>{fM(ts)}</td>
                <td style={{padding:'8px 8px',textAlign:'right',color:'#6b7280'}}>{fM(t.sales)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <MascotFooter compact={mobile}/>
      </div>
    </div>
  )
}

/* ════ PRODUCTS ════ */
function Products({ctx}) {
  const {selBr,setSelBr,getMTD,getAllMTD,getT,MTD_R,TODAY_D,TOTAL_D,MONTH_TH,cfg,mobile,FIELDS,BRANCHES} = ctx
  const isAll=selBr==='ALL', m=isAll?getAllMTD():getMTD(selBr), t=getT(selBr)

  const PCARDS = [
    {key:'tire',       label:'ยาง',         icon:'🏷️', unit:'เส้น', color:'#E2231A', tgt:()=>Math.round(t.tire*MTD_R)},
    {key:'bsTire',     label:'Bridgestone',  icon:'🔵', unit:'เส้น', color:'#FFFFFF', tgt:()=>Math.round(t.tire*0.35*MTD_R)},
    {key:'alloyWheel', label:'Alloy Wheel',  icon:'✨', unit:'วง',  color:'#94a3b8', tgt:()=>0},
    {key:'battery',    label:'Battery',      icon:'🔋', unit:'ลูก', color:'#FFFFFF', tgt:()=>Math.round(t.battery*MTD_R)},
    {key:'brake',      label:'Brake',        icon:'🔴', unit:'ชิ้น',color:'#f97316', tgt:()=>Math.round(t.brake*MTD_R)},
    {key:'shockUp',    label:'Shock UP',     icon:'⚡', unit:'ชิ้น',color:'#eab308', tgt:()=>Math.round(t.shock*MTD_R)},
    {key:'mp',         label:'MP',           icon:'🔧', unit:'ชุด', color:'#8b5cf6', tgt:()=>Math.round(t.mp*MTD_R)},
    {key:'lubricant',  label:'Lubricant',    icon:'🛢️', unit:'ลิตร',color:'#06b6d4', tgt:()=>Math.round(t.lube*MTD_R)},
    {key:'filter',     label:'Filter',       icon:'🔍', unit:'ชิ้น',color:'#64748b', tgt:()=>0},
    {key:'airFilter',  label:'Air Filter',   icon:'❄️', unit:'ชิ้น',color:'#67e8f9', tgt:()=>0},
    {key:'service',    label:'Service',      icon:'🔨', unit:'฿',   color:'#6b7280', tgt:()=>0, money:true},
    {key:'jobOrder',   label:'Job Order (ลูกค้า)', icon:'📋', unit:'ราย', color:'#84cc16', tgt:()=>Math.round(t.ccFormula*MTD_R)},
    {key:'tireSales',  label:'ยอดขายยาง',   icon:'💰', unit:'฿',   color:'#E2231A', tgt:()=>Math.round(t.tireSalesTgt*MTD_R), money:true},
  ]

  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?13:16,color:CI.red,marginBottom:10,letterSpacing:1}}>
          สินค้า MTD — {isAll?'ทุกสาขา':BRANCHES.find(x=>x.id===selBr)?.name}
          {' '}({TODAY_D}–{TODAY_D} {MONTH_TH} {cfg.year})
          <span style={{color:'#6b7280',fontSize:10,fontWeight:400,marginLeft:8}}>เป้า = รายเดือน×{TODAY_D}/{TOTAL_D}</span>
        </div>
        <div style={{background:CI.black,borderRadius:10,overflow:'hidden'}}>
          {PCARDS.map((p,i) => {
            const actual = m[p.key]||0
            const tgt = p.tgt()
            const pct = tgt>0?(actual/tgt)*100:0
            const has = tgt>0
            return (
              <div key={p.key} style={{background:CI.white,padding:'8px 10px',borderTop:i===0?'none':`1px solid ${CI.line}`,
                                        display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:mobile?12:13,color:'#222',flexShrink:0}}>
                  {p.icon} {p.label}
                </span>
                <span style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?12:13,fontWeight:800,color:'#222'}}>
                    {p.money&&actual>0?fM(actual):N(actual)}{has?` / ${p.money?fM(tgt):N(tgt)}`:''} {has?p.unit:''}
                  </span>
                  {has
                    ? <>
                        <span style={{width:7,height:7,borderRadius:'50%',background:statusColor(pct)}}/>
                        <span style={{fontSize:11.5,fontWeight:800,color:statusColor(pct),minWidth:38,textAlign:'right'}}>{pct.toFixed(1)}%</span>
                      </>
                    : <span style={{fontSize:11,color:'#999'}}>—</span>}
                </span>
              </div>
            )
          })}
        </div>
        <MascotFooter compact={mobile}/>
      </div>
    </div>
  )
}

/* ════ DAILY ════ */
function Daily({ctx}) {
  const {selBr,setSelBr,de,getTS,getAllTS,getT,HIST,FIELDS,histDailySales,histDailyTire,histTireQ,fcst,
         TODAY_D,TOTAL_D,DAYS_LEFT,MTD_R,cfg,MONTH_TH,mobile,BRANCHES} = ctx

  // ── useState FIRST (React rules of hooks) ─────────────────────
  const [showYrS,setShowYrS] = useState({2024:true,2025:true,2026:true})
  const [showYrT,setShowYrT] = useState({2024:true,2025:true,2026:true})

  // ── Derived values ─────────────────────────────────────────────
  const isAll = selBr==='ALL'
  const t  = getT(selBr)
  const ts = isAll ? getAllTS() : getTS(selBr)

  const histSales = (yr) => {
    const sy=String(yr),sm=String(cfg.month)
    if(isAll) return BRANCHES.reduce((s,b)=>{const ex=EXCEL_MS[b.id]?.[sy]?.[sm];return s+(ex>0?ex:(HIST[b.id]?.[yr]?.[cfg.month-1]||0)*1000)},0)
    const ex=EXCEL_MS[selBr]?.[sy]?.[sm]; return ex>0?ex:(HIST[selBr]?.[yr]?.[cfg.month-1]||0)*1000
  }

  // EXCEL_MT > histTireQ upload > SEED_TIREQ fallback
  const histTire = (yr) => {
    const sy=String(yr),sm=String(cfg.month)
    if(isAll) return BRANCHES.reduce((s,b)=>{
      const ex=EXCEL_MT[b.id]?.[sy]?.[sm]; if(ex>0) return s+ex
      const upl=histTireQ[b.id]?.[yr]?.[cfg.month-1]
      return s+(upl>0?upl:(SEED_TIREQ[b.id]?.[yr]?.[cfg.month-1]||0))
    },0)
    const ex=EXCEL_MT[selBr]?.[sy]?.[sm]; if(ex>0) return ex
    const upl=histTireQ[selBr]?.[yr]?.[cfg.month-1]
    return upl>0?upl:(SEED_TIREQ[selBr]?.[yr]?.[cfg.month-1]||0)
  }

  const py25SalesMo = histSales(2025)
  const py24SalesMo = histSales(2024)
  const py25TireMo  = histTire(2025)
  const py24TireMo  = histTire(2024)
  const avgSales    = TODAY_D>0 ? ts/TODAY_D : 0
  const avg25S      = TOTAL_D>0 ? py25SalesMo/TOTAL_D : 0
  const avg24S      = TOTAL_D>0 ? py24SalesMo/TOTAL_D : 0
  const tgtSalesD   = t.sales/TOTAL_D
  const mtdTire = isAll
    ? BRANCHES.reduce((s,b)=>s+Object.values(de[b.id]||{}).reduce((a,r)=>a+(Number(r.tire)||0),0),0)
    : Object.values(de[selBr]||{}).reduce((s,r)=>s+(Number(r.tire)||0),0)
  const avgTire = TODAY_D>0 ? mtdTire/TODAY_D : 0
  const avg25T   = TOTAL_D>0 ? py25TireMo/TOTAL_D : 0
  const avg24T   = TOTAL_D>0 ? py24TireMo/TOTAL_D : 0
  const tgtTireD = t.tire/TOTAL_D

  // ── Real historical daily data helpers ────────────────────────
  function getRealSales(bid,yr,mo,day) {
    const key=`${yr}-${String(mo).padStart(2,'0')}`,d=String(day)
    if(bid==='ALL'){let s=0;BRANCHES.forEach(b=>{s+=(EXCEL_DS[b.id]?.[key]?.[d]||histDailySales[b.id]?.[key]?.[d]||0)});return s>0?s:null}
    return EXCEL_DS[bid]?.[key]?.[d]||histDailySales[bid]?.[key]?.[d]||null
  }
  function getRealTire(bid,yr,mo,day) {
    const key=`${yr}-${String(mo).padStart(2,'0')}`,d=String(day)
    if(bid==='ALL'){let s=0;BRANCHES.forEach(b=>{s+=(EXCEL_DT[b.id]?.[key]?.[d]||histDailyTire[b.id]?.[key]?.[d]||0)});return s>0?s:null}
    return EXCEL_DT[bid]?.[key]?.[d]||histDailyTire[bid]?.[key]?.[d]||null
  }

  // ── Forecast: MA7 × DOW ratio (MAE ~24 vs DOW×scale MAE ~68, ดีกว่า 61%) ──
  function pyDOW(yr,mo,day){const j=new Date(yr,mo-1,day).getDay();return j===0?6:j-1}
  function getDowAvgS(bid,mo){
    const sm=String(mo)
    if(bid==='ALL'){
      const a={}
      BRANCHES.forEach(b=>{
        const src=EXCEL_DOWS[b.id]?.[sm]&&Object.keys(EXCEL_DOWS[b.id][sm]).length>0?EXCEL_DOWS[b.id][sm]:EXCEL_DOWS_G[b.id]||{}
        Object.entries(src).forEach(([k,v])=>{a[k]=(a[k]||0)+v})
      })
      return a
    }
    const m=EXCEL_DOWS[bid]?.[sm]
    return (m&&Object.keys(m).length>0)?m:(EXCEL_DOWS_G[bid]||{})
  }
  function getDowAvgT(bid,mo){
    const sm=String(mo)
    if(bid==='ALL'){
      const a={}
      BRANCHES.forEach(b=>{
        const src=EXCEL_DOWT[b.id]?.[sm]&&Object.keys(EXCEL_DOWT[b.id][sm]).length>0?EXCEL_DOWT[b.id][sm]:EXCEL_DOWT_G[b.id]||{}
        Object.entries(src).forEach(([k,v])=>{a[k]=(a[k]||0)+v})
      })
      return a
    }
    const m=EXCEL_DOWT[bid]?.[sm]
    return (m&&Object.keys(m).length>0)?m:(EXCEL_DOWT_G[bid]||{})
  }
  const dowAvgS=getDowAvgS(selBr,cfg.month), dowAvgT=getDowAvgT(selBr,cfg.month)
  const modelAvgS=Object.values(dowAvgS).length?Object.values(dowAvgS).reduce((a,v)=>a+v,0)/Object.values(dowAvgS).length:tgtSalesD
  const modelAvgT=Object.values(dowAvgT).length?Object.values(dowAvgT).reduce((a,v)=>a+v,0)/Object.values(dowAvgT).length:tgtTireD

  // known actual arrays (day 1..TOTAL_D) — วันที่ <= TODAY_D มีข้อมูลจริง, วันที่เกิน = null
  // ต้องขนาด TOTAL_D เพื่อให้ MA7 window rolling ถูกต้องตลอดเดือน
  const knownS=Array.from({length:TOTAL_D},(_,i)=>{
    const d=i+1
    if(d>TODAY_D) return null
    if(!isAll){const dr=de[selBr]?.[d];if(dr){const v=calcTS(Object.fromEntries(FIELDS.map(f=>[f.key,Number(dr[f.key])||0])));if(v>0)return v}}
    else{const tot=BRANCHES.reduce((s,b)=>{const dr=de[b.id]?.[d];return s+(dr?calcTS(Object.fromEntries(FIELDS.map(f=>[f.key,Number(dr[f.key])||0]))):0)},0);if(tot>0)return tot}
    const hv=getRealSales(isAll?'ALL':selBr,cfg.year,cfg.month,d);return hv&&hv>0?hv:null
  })
  const knownT=Array.from({length:TOTAL_D},(_,i)=>{
    const d=i+1
    if(d>TODAY_D) return null
    if(!isAll){const dr=de[selBr]?.[d];const v=Number(dr?.tire)||0;if(v>0)return v}
    else{const tot=BRANCHES.reduce((s,b)=>s+(Number(de[b.id]?.[d]?.tire)||0),0);if(tot>0)return tot}
    const hv=getRealTire(isAll?'ALL':selBr,cfg.year,cfg.month,d);return hv&&hv>0?hv:null
  })

  // MA7: mean ของ 7 ค่าล่าสุดที่ไม่ null จากทุกวันก่อน d → rolling ถูกต้องตลอดเดือน
  function ma7(arr,d){const all=arr.slice(0,d-1).filter(v=>v!=null);const w=all.slice(-7);return w.length>0?w.reduce((a,v)=>a+v,0)/w.length:null}
  // DOW ratio
  function dowRatioS(d){const b=dowAvgS[String(pyDOW(cfg.year,cfg.month,d))]||modelAvgS;return modelAvgS>0?b/modelAvgS:1}
  function dowRatioT(d){const b=dowAvgT[String(pyDOW(cfg.year,cfg.month,d))]||modelAvgT;return modelAvgT>0?b/modelAvgT:1}
  // Forecast = MA7 × DOW ratio (fallback DOW avg เมื่อ < 7 วัน)
  function fcstSalesDay(d){const ma=ma7(knownS,d);if(ma!=null&&ma>0)return Math.round(ma*dowRatioS(d));return Math.round(dowAvgS[String(pyDOW(cfg.year,cfg.month,d))]||modelAvgS)}
  function fcstTireDay(d){const ma=ma7(knownT,d);if(ma!=null&&ma>0)return Math.round(ma*dowRatioT(d));return Math.round(dowAvgT[String(pyDOW(cfg.year,cfg.month,d))]||modelAvgT)}

  // ── PY estimate: เมื่อไม่มีข้อมูลรายวัน (EXCEL_DS ยังไม่อัพ) → ประมาณจากยอดรายเดือน × DOW ratio
  // threshold: ยอดต้อง > 500K฿ / ยาง > 20 เส้น เพื่อกรองสาขาที่ยังไม่มีข้อมูลจริง (เช่น 143 ปี 2024/2025)
  function pyEstSales(yr, d) {
    const total = histSales(yr)
    if (!total || total < 500000) return null
    return Math.round((total / TOTAL_D) * dowRatioS(d))
  }
  function pyEstTire(yr, d) {
    const total = histTire(yr)
    if (!total || total < 20) return null
    return Math.round((total / TOTAL_D) * dowRatioT(d))
  }

  // ── Day-by-day chart data ─────────────────────────────────────
  const salesData = Array.from({length:TOTAL_D},(_,i)=>{
    const d=i+1, row={day:String(d)}
    const r24=getRealSales(selBr,2024,cfg.month,d) ?? pyEstSales(2024,d)
    const r25=getRealSales(selBr,2025,cfg.month,d) ?? pyEstSales(2025,d)
    if(r24!=null&&r24>0) row[2024]=Math.round(r24)
    if(r25!=null&&r25>0) row[2025]=Math.round(r25)
    if(!isAll&&d<=TODAY_D){
      const dr=de[selBr]?.[d]
      if(dr){const agg=Object.fromEntries(FIELDS.map(f=>[f.key,Number(dr[f.key])||0]));const v=calcTS(agg);if(v>0)row[2026]=v}
      // fallback: use histDailySales 2026 if available (uploaded data)
      if(!row[2026]){const hv=getRealSales(selBr,cfg.year,cfg.month,d);if(hv&&hv>0)row[2026]=hv}
    } else if(isAll&&d<=TODAY_D){
      const tot=BRANCHES.reduce((s,b)=>{const dr=de[b.id]?.[d];if(!dr)return s;return s+calcTS(Object.fromEntries(FIELDS.map(f=>[f.key,Number(dr[f.key])||0])))},0)
      if(tot>0)row[2026]=tot
      if(!row[2026]){const hv=getRealSales('ALL',cfg.year,cfg.month,d);if(hv&&hv>0)row[2026]=hv}
    }
    if(d>TODAY_D) row.forecast=fcstSalesDay(d)
    return row
  })

  const tireData = Array.from({length:TOTAL_D},(_,i)=>{
    const d=i+1, row={day:String(d)}
    const r24=getRealTire(selBr,2024,cfg.month,d) ?? pyEstTire(2024,d)
    const r25=getRealTire(selBr,2025,cfg.month,d) ?? pyEstTire(2025,d)
    if(r24!=null&&r24>0) row[2024]=r24
    if(r25!=null&&r25>0) row[2025]=r25
    if(!isAll&&d<=TODAY_D){
      const dr=de[selBr]?.[d]; const v=Number(dr?.tire)||0; if(v>0)row[2026]=v
      if(!row[2026]){const hv=getRealTire(selBr,cfg.year,cfg.month,d);if(hv&&hv>0)row[2026]=hv}
    } else if(isAll&&d<=TODAY_D){
      const tot=BRANCHES.reduce((s,b)=>s+(Number(de[b.id]?.[d]?.tire)||0),0)
      if(tot>0)row[2026]=tot
      if(!row[2026]){const hv=getRealTire('ALL',cfg.year,cfg.month,d);if(hv&&hv>0)row[2026]=hv}
    }
    if(d>TODAY_D) row.forecast=fcstTireDay(d)
    return row
  })

  // เช็คว่าเดือนนี้มีข้อมูลรายวันจริง (EXCEL_DS) หรือใช้ค่าประมาณ
  const hasDailyKey = (bid,yr) => {
    const key=`${yr}-${String(cfg.month).padStart(2,'0')}`
    return bid==='ALL'
      ? BRANCHES.some(b=>EXCEL_DS[b.id]?.[key]||histDailySales[b.id]?.[key])
      : !!(EXCEL_DS[bid]?.[key]||histDailySales[bid]?.[key])
  }
  const py25Label = hasDailyKey(selBr,2025)?'PY25 จริง':'PY25 ประมาณ'
  const py24Label = hasDailyKey(selBr,2024)?'PY24 จริง':'PY24 ประมาณ'
  const py25LabelT = hasDailyKey(selBr,2025)?'PY25 จริง':'PY25 ประมาณ'
  const py24LabelT = hasDailyKey(selBr,2024)?'PY24 จริง':'PY24 ประมาณ'
  const CHART_H = mobile?180:240
  const ttip    = {contentStyle:{background:'#1e2538',border:'1px solid #2d3548',fontSize:11}}
  function yrBtnSt(yr,active) {
    const clr = YRCLR[yr]||'#15181C'
    return {padding:'3px 9px',borderRadius:4,cursor:'pointer',border:`1px solid ${clr}`,
            background:active?clr+'33':'transparent',color:active?clr:'#4b5563',
            fontFamily:'Barlow Condensed',fontWeight:700,fontSize:10}
  }

  // ── Today's actual vs Forecast ───────────────────────────────
  const todaySales    = knownS[TODAY_D-1] || 0   // actual today (0 = ยังไม่กรอก)
  const todayTireEnt  = knownT[TODAY_D-1] || 0
  const todayFcstS    = fcstSalesDay(TODAY_D)
  const todayFcstT    = fcstTireDay(TODAY_D)
  const todaySalesPct = todayFcstS > 0 ? (todaySales / todayFcstS) * 100 : 0
  const todayTirePct  = todayFcstT > 0 ? (todayTireEnt / todayFcstT) * 100 : 0

  const pctClr = (p) => p >= 100 ? '#16a34a' : p >= 90 ? '#b45309' : '#dc2626'
  const pctBg  = (p) => p >= 100 ? '#dcfce7' : p >= 90 ? '#fef3c7' : '#fee2e2'

  function TodayCard({icon,label,actual,fcst,pct,unit,color}) {
    const diff = actual - fcst
    return (
      <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
          <div style={{fontSize:9,color:'#666',fontFamily:'Barlow Condensed',fontWeight:700,textTransform:'uppercase',letterSpacing:.5}}>{icon} ยอดขายวันที่ {TODAY_D} {label}</div>
          <div style={{background:pctBg(pct),color:pctClr(pct),borderRadius:6,padding:'2px 6px',fontSize:10,fontWeight:800,fontFamily:'Barlow Condensed',whiteSpace:'nowrap'}}>{Math.round(pct)}%</div>
        </div>
        <div style={{display:'flex',gap:0,alignItems:'stretch'}}>
          <div style={{flex:1,paddingRight:8}}>
            <div style={{fontSize:9,color:'#888',marginBottom:2}}>จริง</div>
            <div style={{fontSize:18,fontWeight:900,color,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>
              {unit==='฿'?fM(actual):N(actual)}<span style={{fontSize:10}}>{unit!=='฿'?' เส้น':''}</span>
            </div>
          </div>
          <div style={{width:1,background:CI.line,flexShrink:0}}/>
          <div style={{flex:1,paddingLeft:8}}>
            <div style={{fontSize:9,color:'#888',marginBottom:2}}>Forecast</div>
            <div style={{fontSize:18,fontWeight:900,color:'#555',fontFamily:"'JetBrains Mono',monospace",lineHeight:1.1}}>
              {unit==='฿'?fM(Math.round(fcst)):N(Math.round(fcst))}<span style={{fontSize:10}}>{unit!=='฿'?' เส้น':''}</span>
            </div>
          </div>
        </div>
        <div style={{fontSize:9,color:'#aaa',marginTop:4,textAlign:'right'}}>
          {actual>0 ? `${diff>=0?'+':''}${unit==='฿'?fM(Math.round(diff)):N(Math.round(diff))}` : `−${unit==='฿'?fM(Math.round(fcst)):N(Math.round(fcst))}`}
        </div>
      </div>
    )
  }

  // ── JSX ────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?16:20,color:CI.red}}>
            รายวัน — {isAll?'รวม':BRANCHES.find(x=>x.id===selBr)?.short} ({MONTH_TH} {cfg.year})
          </div>

        </div>

        {/* ── Today actual vs Forecast ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <TodayCard icon="💰" label={MONTH_TH+'.'}
            actual={todaySales} fcst={todayFcstS} pct={todaySalesPct}
            unit="฿" color={CI.red}/>
          <TodayCard icon="🏷️" label={MONTH_TH+'.'}
            actual={todayTireEnt} fcst={todayFcstT} pct={todayTirePct}
            unit="เส้น" color="#15181C"/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <Card label="เฉลี่ย/วัน (ยอดขาย)"  value={fM(Math.round(avgSales))} color={CI.red} small/>
          <Card label="เป้า/วัน (ยอดขาย)"    value={fM(Math.round(tgtSalesD))} color="#555" small/>
          <Card label="เฉลี่ย/วัน (ยาง)"      value={N(Math.round(avgTire))+' เส้น'} color="#15181C" small/>
          <Card label="เป้า/วัน (ยาง)"        value={ceilTo4(Math.round(tgtTireD))+' เส้น'} color="#15181C" small/>
        </div>
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,flexWrap:'wrap',gap:4}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:CI.red}}>💰 ยอดขายรายวัน (฿) — วันที่ 1–{TODAY_D}</div>
            <div style={{display:'flex',gap:4}}>
              {[2024,2025,2026].map(yr=>(
                <button key={yr} onClick={()=>setShowYrS(p=>({...p,[yr]:!p[yr]}))} style={yrBtnSt(yr,showYrS[yr])}>{yr}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <LineChart data={salesData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548"/>
              <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:7}}/>
              <YAxis tick={{fill:'#6b7280',fontSize:8}} tickFormatter={v=>v?(v/1000).toFixed(0)+'k':''}/>
              <Tooltip {...ttip} formatter={(v,n)=>[v!=null?N(Math.round(v))+'฿':'—',n==='forecast'?'Forecast':n===2026?`${cfg.year} จริง`:`PY${String(n).slice(-2)}`]} labelFormatter={l=>`วันที่ ${l}`}/>
              <ReferenceLine y={tgtSalesD} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1.5}/>
              {showYrS[2024]&&<Line type="monotone" dataKey={2024} stroke={YRCLR[2024]} strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls={false}/>}
              {showYrS[2025]&&<Line type="monotone" dataKey={2025} stroke={YRCLR[2025]} strokeWidth={2}   dot={false} strokeDasharray="5 2" connectNulls={false}/>}
              {showYrS[2026]&&<Line type="monotone" dataKey={2026} stroke="#FFFFFF" strokeWidth={2.5} dot={{r:3,fill:'#FFFFFF'}} connectNulls={false}/>}
              <Line type="monotone" dataKey="forecast" stroke="#FFEB00" strokeWidth={2} dot={{r:2,fill:'#FFEB00'}} strokeDasharray="5 3" connectNulls={false}/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:12,fontSize:9,color:'#6b7280',marginTop:4,flexWrap:'wrap'}}>
            <span style={{color:'#FFFFFF'}}>● {cfg.year} จริง</span>
            <span style={{color:YRCLR[2025]}}>⟶ {py25Label}</span>
            <span style={{color:YRCLR[2024]}}>⟶ {py24Label}</span>
            <span style={{color:'#FFEB00'}}>⟶ Forecast</span>
            <span style={{color:'#6b7280'}}>-- เป้า/วัน</span>
          </div>
        </div>

        {/* ── Tire chart ── */}
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,flexWrap:'wrap',gap:4}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:'#FFFFFF'}}>🏷️ ยางรายวัน (เส้น) — วันที่ 1–{TODAY_D}</div>
            <div style={{display:'flex',gap:4}}>
              {[2024,2025,2026].map(yr=>(
                <button key={yr} onClick={()=>setShowYrT(p=>({...p,[yr]:!p[yr]}))} style={yrBtnSt(yr,showYrT[yr])}>{yr}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={mobile?150:200}>
            <LineChart data={tireData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548"/>
              <XAxis dataKey="day" tick={{fill:'#6b7280',fontSize:7}}/>
              <YAxis tick={{fill:'#6b7280',fontSize:8}}/>
              <Tooltip {...ttip} formatter={(v,n)=>[v!=null?N(Math.round(v))+' เส้น':'—',n==='forecast'?'Forecast':n===2026?`${cfg.year} จริง`:`PY${String(n).slice(-2)}`]} labelFormatter={l=>`วันที่ ${l}`}/>
              <ReferenceLine y={tgtTireD} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1.5}/>
              {showYrT[2024]&&<Line type="monotone" dataKey={2024} stroke={YRCLR[2024]} strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls={false}/>}
              {showYrT[2025]&&<Line type="monotone" dataKey={2025} stroke={YRCLR[2025]} strokeWidth={2}   dot={false} strokeDasharray="5 2" connectNulls={false}/>}
              {showYrT[2026]&&<Line type="monotone" dataKey={2026} stroke="#FFFFFF" strokeWidth={2.5} dot={{r:3,fill:'#FFFFFF'}} connectNulls={false}/>}
              <Line type="monotone" dataKey="forecast" stroke="#FFEB00" strokeWidth={2} dot={{r:2,fill:'#FFEB00'}} strokeDasharray="5 3" connectNulls={false}/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:12,fontSize:9,color:'#6b7280',marginTop:4,flexWrap:'wrap'}}>
            <span style={{color:'#FFFFFF'}}>● {cfg.year} จริง</span>
            <span style={{color:YRCLR[2025]}}>⟶ {py25LabelT}</span>
            <span style={{color:YRCLR[2024]}}>⟶ {py24LabelT}</span>
            <span style={{color:'#FFEB00'}}>⟶ Forecast</span>
            <span style={{color:'#6b7280'}}>-- เป้า/วัน</span>
          </div>
        </div>
        <MascotFooter compact={mobile}/>
      </div>
    </div>
  )
}

/* ════ MONTHLY ════ */
function Monthly({ctx}) {
  const {selBr,setSelBr,getH,getMTD,getAllMTD,mobile,cfg,HIST,FIELDS,histTireQ,histDailySales,uploadedMtAll,deAll,calcTS,BRANCHES} = ctx
  const isAll=selBr==='ALL', h=getH(selBr)
  const [showSales, setShowSales] = useState({2023:false,2024:true,2025:true,2026:true})
  const [showTire,  setShowTire]  = useState({2024:true,2025:true,2026:true})
  const toggleS = yr => setShowSales(p=>({...p,[yr]:!p[yr]}))
  const toggleT = yr => setShowTire(p=>({...p,[yr]:!p[yr]}))
  const yrBtn = (yr, map, clrOvr) => {
    const clr = clrOvr || YRCLR[yr] || '#6b7280'
    return {padding:'4px 10px',borderRadius:4,cursor:'pointer',border:`1px solid ${clr}`,background:map[yr]?clr+'33':'transparent',color:map[yr]?clr:'#4b5563',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11}
  }

  // Sales chart data — all 4 years
  const salesData = MONTHS_TH.map((mn,i) => ({
    month: mn,
    2023: h[2023]?.[i] ?? null,
    2024: h[2024]?.[i] ?? null,
    2025: h[2025]?.[i] ?? null,
    2026: h[2026]?.[i] ?? null,
  }))

  // Tire chart data — 2024, 2025, 2026
  // 2024/2025: from SEED_TIREQ
  // 2026: current month from de MTD, rest null
  // ยาง 2026: ใช้ upload/EXCEL_MT ก่อน ถ้าไม่มีให้ sum deAll ของเดือนนั้น
  const getDeMonthTire26 = (bid, mo) => {
    const mk = `2026-${mo}`
    if (bid === 'ALL') return BRANCHES.reduce((s,b)=>{
      return s + Object.values(deAll[b.id]?.[mk]||{}).reduce((ss,r)=>ss+(Number(r.tire)||0), 0)
    }, 0)
    return Object.values(deAll[bid]?.[mk]||{}).reduce((s,r)=>s+(Number(r.tire)||0), 0)
  }
  const mtd2026 = isAll ? getAllMTD() : getMTD(selBr)
  const tire2026 = Array(12).fill(null)
  // current month: from de MTD
  if (mtd2026.tire > 0) tire2026[cfg.month-1] = mtd2026.tire
  // past months of 2026: from deAll (กรณียังไม่ upload Data_sale_by_Store.xlsx รายเดือนล่าสุด)
  for (let i = 0; i < cfg.month - 1; i++) {
    const deT = getDeMonthTire26(isAll?'ALL':selBr, i+1)
    if (deT > 0) tire2026[i] = deT
  }

  // Use histTireQ from uploaded Data_sale_by_Store if available, else SEED_TIREQ
  const getTireQByMonth = (bid, yr, monthIdx) => {
    const sy=String(yr), sm=String(monthIdx+1)
    // ALL: uploadedMtAll (Total sheet upload) > EXCEL_MT_ALL (hardcode) > branch sum > fallback
    if (bid==='ALL') {
      const upl=uploadedMtAll?.[sy]?.[sm]; if(upl>0) return upl
      const ex=EXCEL_MT_ALL[sy]?.[sm]; if(ex>0) return ex
      const br=BRANCHES.reduce((s,b)=>{const v=EXCEL_MT[b.id]?.[sy]?.[sm];return s+(v>0?v:0)},0)
      if(br>0) return br
      return BRANCHES.reduce((s,b)=>s+(histTireQ[b.id]?.[yr]?.[monthIdx]||SEED_TIREQ[b.id]?.[yr]?.[monthIdx]||0),0)||null
    }
    // Single: EXCEL_MT (branch sheet) > histTireQ > SEED_TIREQ
    const ex=EXCEL_MT[bid]?.[sy]?.[sm]; if(ex>0) return ex
    const upl=histTireQ[bid]?.[yr]?.[monthIdx]; if(upl>0) return upl
    return SEED_TIREQ[bid]?.[yr]?.[monthIdx]??null
  }

  const tireData = MONTHS_TH.map((mn,i) => {
    const row = {month: mn}
    const bid = isAll ? 'ALL' : selBr
    // 2024/2025: getTireQByMonth ใช้ uploadedMtAll/EXCEL_MT_ALL (Total sheet) ก่อนเสมอ
    row[2024] = getTireQByMonth(bid, 2024, i)
    row[2025] = getTireQByMonth(bid, 2025, i)
    // 2026: uploadedMtAll (upload ล่าสุด) > EXCEL_MT_ALL > EXCEL_MT per branch > MTD de
    if (isAll) {
      const u=uploadedMtAll?.['2026']?.[String(i+1)]
      const e=EXCEL_MT_ALL['2026']?.[String(i+1)]
      if (u>0) row[2026]=u
      else if (e>0) row[2026]=e
      else { const f=BRANCHES.reduce((s,b)=>s+(histTireQ[b.id]?.[2026]?.[i]||0),0); row[2026]=f>0?f:tire2026[i] }
    } else {
      const e=EXCEL_MT[selBr]?.['2026']?.[String(i+1)]
      if (e>0) row[2026]=e
      else { const f=histTireQ[selBr]?.[2026]?.[i]; row[2026]=f>0?f:tire2026[i] }
    }
    return row
  })


  // Monthly tire sales (฿) from histDailySales upload
  const getMonthlyTireSales = (bid, yr, monthIdx) => {
    const moKey = `${yr}-${String(monthIdx+1).padStart(2,'0')}`
    if (bid === 'ALL') {
      let sum = 0
      BRANCHES.forEach(b => {
        const days = histDailySales[b.id]?.[moKey] || {}
        Object.values(days).forEach(v => { sum += (v || 0) })
      })
      return sum > 0 ? Math.round(sum / 1000) : null
    }
    const days = histDailySales[bid]?.[moKey] || {}
    const sum = Object.values(days).reduce((s, v) => s + (v || 0), 0)
    return sum > 0 ? Math.round(sum / 1000) : null
  }
  const tireSalesData = MONTHS_TH.map((mn,i) => ({
    month: mn,
    2024: getMonthlyTireSales(isAll?'ALL':selBr, 2024, i),
    2025: getMonthlyTireSales(isAll?'ALL':selBr, 2025, i),
    2026: getMonthlyTireSales(isAll?'ALL':selBr, 2026, i),
  }))
  const hasTireSalesData = tireSalesData.some(r => r[2024] || r[2025] || r[2026])

  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?16:20,color:CI.red,letterSpacing:2,marginBottom:12}}>
          รายเดือน — {isAll?'รวมทุกสาขา':BRANCHES.find(x=>x.id===selBr)?.name}
        </div>

        {/* ══ SALES CHART ══ */}
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12,marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
            <div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:CI.red}}>💰 ยอดขายรายเดือน (฿000)</div>
              <div style={{fontSize:9,color:'#6b7280'}}>เส้นประ 2026 = ม.ค.–{cfg.month<=12?'ปัจจุบัน':''} รวม MTD</div>
            </div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              {[2023,2024,2025,2026].map(yr=>(
                <button key={yr} onClick={()=>toggleS(yr)} style={yrBtn(yr,showSales)}>{yr}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={mobile?170:240}>
            <LineChart data={salesData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548"/>
              <XAxis dataKey="month" tick={{fill:'#6b7280',fontSize:8}}/>
              <YAxis tick={{fill:'#6b7280',fontSize:8}} tickFormatter={v=>v?(v/1000).toFixed(1)+'M':''}/>
              <Tooltip contentStyle={{background:'#1e2538',border:'1px solid #2d3548',fontSize:11}}
                formatter={v=>[v!=null?N(v*1000)+'฿':'—','']}/>
              <Legend wrapperStyle={{fontSize:9}}/>
              {showSales[2023]&&<Line type="monotone" dataKey={2023} stroke={YRCLR[2023]} strokeWidth={1.5} dot={false} connectNulls={false}/>}
              {showSales[2024]&&<Line type="monotone" dataKey={2024} stroke={YRCLR[2024]} strokeWidth={1.5} dot={false} connectNulls={false}/>}
              {showSales[2025]&&<Line type="monotone" dataKey={2025} stroke={YRCLR[2025]} strokeWidth={2} dot={{r:2}} connectNulls={false}/>}
              {showSales[2026]&&<Line type="monotone" dataKey={2026} stroke={YRCLR[2026]} strokeWidth={3} dot={{r:4,fill:YRCLR[2026]}} strokeDasharray="6 3" connectNulls={false}/>}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ══ TIRE CHART ══ */}
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
            <div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'#FFFFFF'}}>🏷️ ยางรายเดือน (เส้น)</div>
              <div style={{fontSize:9,color:Object.keys(histTireQ).length>0?'#FFFFFF':'#6b7280'}}>{Object.keys(histTireQ).length>0?`📊 ข้อมูลจาก Excel (${Object.keys(histTireQ).length} สาขา)`:"2026 = เฉพาะเดือนที่กรอกข้อมูลแล้ว"}</div>
            </div>
            <div style={{display:'flex',gap:5}}>
              {[2024,2025,2026].map(yr=>(
                <button key={yr} onClick={()=>toggleT(yr)} style={yrBtn(yr,showTire,yr===2026?'#15181C':yr===2025?'#E2231A':'#94a3b8')}>{yr}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={mobile?150:200}>
            <LineChart data={tireData} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3548"/>
              <XAxis dataKey="month" tick={{fill:'#6b7280',fontSize:8}}/>
              <YAxis tick={{fill:'#6b7280',fontSize:8}}/>
              <Tooltip contentStyle={{background:'#1e2538',border:'1px solid #2d3548',fontSize:11}}
                formatter={v=>[v!=null?N(v)+' เส้น':'—','']}/>
              <Legend wrapperStyle={{fontSize:9}}/>
              {showTire[2024]&&<Line type="monotone" dataKey={2024} stroke="#94a3b8" strokeWidth={1.5} dot={{r:2}} connectNulls={false}/>}
              {showTire[2025]&&<Line type="monotone" dataKey={2025} stroke="#E2231A" strokeWidth={2} dot={{r:3}} connectNulls={false}/>}
              {showTire[2026]&&<Line type="monotone" dataKey={2026} stroke="#FFFFFF" strokeWidth={3} dot={{r:6,fill:'#FFFFFF',strokeWidth:2,stroke:'#0d1117'}} connectNulls={false}/>}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <MascotFooter compact={mobile}/>
      </div>
    </div>
  )
}

function Tracker({ctx}) {
  const {getMTD,getTS,getT,fcst,de,MTD_R,TODAY_D,TOTAL_D,DAYS_LEFT,MONTH_TH,cfg,mobile,FIELDS,selBr,setSelBr,BRANCHES,BCLR} = ctx

  // Build per-branch data with today's entry vs dynamic daily target
  const rows = BRANCHES.map((b,i) => {
    const t = getT(b.id)
    const m = getMTD(b.id)              // cumulative MTD all days
    const ts = getTS(b.id)             // MTD total sales

    // Sum days BEFORE today (1..TODAY_D-1) for dynamic target
    const beforeToday = sumDaysUpTo(de, b.id, TODAY_D - 1)
    const tsBeforeToday = calcTS(beforeToday)
    const tireBeforeToday = beforeToday.tire || 0

    // Days remaining including today
    const daysInclToday = TOTAL_D - TODAY_D + 1

    // Dynamic daily target = (remaining_target) / (remaining_days_incl_today)
    const salesDayTgt = Math.max(0, Math.round((t.sales - tsBeforeToday) / daysInclToday))
    const tireDayTgt  = Math.max(0, Math.round((t.tire  - tireBeforeToday) / daysInclToday))

    // Today's actual from entry
    const todayRow = de[b.id]?.[TODAY_D] || {}
    const todayAgg = Object.fromEntries(FIELDS.map(f=>[f.key, Number(todayRow[f.key])||0]))
    const todaySales = calcTS(todayAgg)
    const todayTire  = todayAgg.tire || 0
    const hasToday   = todaySales > 0 || todayTire > 0

    const salesAch = salesDayTgt > 0 ? P(todaySales, salesDayTgt) : null
    const tireAch  = tireDayTgt  > 0 ? P(todayTire,  tireDayTgt)  : null

    // AI forecast reference
    const fT = fcst[b.id]?.dailyForecast?.[0] || salesDayTgt

    return {
      ...b, t, m, ts, idx:i, hasToday,
      tsBeforeToday, tireBeforeToday,
      salesDayTgt, tireDayTgt,
      todaySales, todayTire,
      salesAch, tireAch,
      fT,
      mtdSalesPct: P(ts, t.sales*MTD_R),
      mtdTirePct:  P(m.tire, t.tire*MTD_R),
    }
  })

  const visibleRows = (!selBr || selBr==='ALL') ? rows : rows.filter(r => r.id === selBr)

  const totTS    = visibleRows.reduce((s,r)=>s+r.ts,0)
  const totTgt   = visibleRows.reduce((s,r)=>s+r.t.sales*MTD_R,0)
  const totTire  = visibleRows.reduce((s,r)=>s+r.m.tire,0)
  const totTireT = visibleRows.reduce((s,r)=>s+r.t.tire*MTD_R,0)
  const todayTotSales = visibleRows.reduce((s,r)=>s+r.todaySales,0)
  const todayTotTire  = visibleRows.reduce((s,r)=>s+r.todayTire,0)
  const todayTotTgt   = visibleRows.reduce((s,r)=>s+r.salesDayTgt,0)
  const todayTotTireT = visibleRows.reduce((s,r)=>s+r.tireDayTgt,0)



  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1,minWidth:0}}>
      <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?16:22,color:CI.red,letterSpacing:2,marginBottom:6}}>
        🎯 TRACKER — {TODAY_D} {MONTH_TH} {cfg.year}
      </div>
      <div style={{fontSize:10,color:'#6b7280',marginBottom:12}}>
        เป้าวัน = (เป้าเดือน − ยอด MTD วันก่อนหน้า) ÷ {TOTAL_D - TODAY_D + 1} วันที่เหลือ (รวมวันนี้)
      </div>

      {/* Summary cards — สไตล์เดียวกับหน้าหลัก (การ์ดขาว + เกจวงกลม) */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:.5}}>วันนี้รวม (ยอดขาย)</div>
            <div style={{fontSize:21,fontWeight:900,color:todayTotSales>0?CI.red:'#999',fontFamily:"'JetBrains Mono',monospace"}}>{fM(todayTotSales)}</div>
            <div style={{fontSize:10,color:'#777'}}>เป้า/วัน {fM(todayTotTgt)}</div>
          </div>
          <div style={{position:'relative',flexShrink:0,alignSelf:'center'}}>
            <Ring value={todayTotTgt>0?P(todayTotSales,todayTotTgt):0} size={56} stroke={7}/>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                         fontSize:11.5,fontWeight:900,color:statusColor(todayTotTgt>0?P(todayTotSales,todayTotTgt):0)}}>
              {todayTotTgt>0?P(todayTotSales,todayTotTgt).toFixed(0):0}%
            </div>
          </div>
        </div>
        <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:.5}}>วันนี้รวม (ยาง)</div>
            <div style={{fontSize:21,fontWeight:900,color:todayTotTire>0?'#15181C':'#999',fontFamily:"'JetBrains Mono',monospace"}}>{N(todayTotTire)} <span style={{fontSize:12}}>เส้น</span></div>
            <div style={{fontSize:10,color:'#777'}}>เป้า/วัน {N(todayTotTireT)} เส้น</div>
          </div>
          <div style={{position:'relative',flexShrink:0,alignSelf:'center'}}>
            <Ring value={todayTotTireT>0?P(todayTotTire,todayTotTireT):0} size={56} stroke={7}/>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                         fontSize:11.5,fontWeight:900,color:statusColor(todayTotTireT>0?P(todayTotTire,todayTotTireT):0)}}>
              {todayTotTireT>0?P(todayTotTire,todayTotTireT).toFixed(0):0}%
            </div>
          </div>
        </div>

        {/* MTD ยอดขาย / ยาง — แยก 2 กล่องซ้ายขวา */}
        <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed'}}>MTD ยอดขายรวม</div>
            <div style={{fontSize:18,fontWeight:900,color:CI.red,fontFamily:"'JetBrains Mono',monospace"}}>{fM(totTS)}</div>
          </div>
          <div style={{position:'relative',flexShrink:0,alignSelf:'center'}}>
            <Ring value={P(totTS,totTgt)} size={54} stroke={7}/>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                         fontSize:11,fontWeight:900,color:statusColor(P(totTS,totTgt))}}>{P(totTS,totTgt).toFixed(0)}%</div>
          </div>
        </div>
        <div style={{background:CI.white,border:`1px solid ${CI.line}`,borderRadius:10,padding:'10px 12px',display:'flex',justifyContent:'space-between',gap:6}}>
          <div>
            <div style={{fontSize:10,color:'#666',fontWeight:700,fontFamily:'Barlow Condensed'}}>MTD ยางรวม</div>
            <div style={{fontSize:18,fontWeight:900,color:'#15181C',fontFamily:"'JetBrains Mono',monospace"}}>{N(totTire)} <span style={{fontSize:12}}>เส้น</span></div>
          </div>
          <div style={{position:'relative',flexShrink:0,alignSelf:'center'}}>
            <Ring value={P(totTire,totTireT)} size={54} stroke={7}/>
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                         fontSize:11,fontWeight:900,color:statusColor(P(totTire,totTireT))}}>{P(totTire,totTireT).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Per branch */}
      {mobile ? (
        <div style={{background:CI.black,borderRadius:10,overflow:'hidden'}}>
          {visibleRows.map((r,i) => {
            const READCLR=['#B45309','#1D4ED8','#047857','#B91C1C','#6D28D9','#C2410C','#0E7490','#BE123C','#4D7C0F','#BE185D']
            const sp = r.salesAch ?? 0, tp = r.tireAch ?? 0
            return (
            <div key={r.id} style={{background:CI.white,padding:'9px 11px',borderTop:i===0?'none':`1px solid ${CI.line}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,marginBottom:7}}>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:14,color:READCLR[i]}}>{r.id} {r.short}</span>
                {!r.hasToday && <span style={{fontSize:9.5,color:CI.red,fontWeight:700}}>⚠ ยังไม่กรอกวันนี้</span>}
              </div>

              {/* วันนี้ vs เป้าวันนี้ — กล่องคู่ ยอดขาย/ยาง พร้อมเกจครึ่งวงกลม */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {(() => {
                  const sCol = actualColor(r.todaySales, sp)
                  const tCol = actualColor(r.todayTire, tp)
                  return <>
                <div style={{background:CI.paper,border:`1px solid ${CI.line}`,borderRadius:10,padding:'8px 6px',textAlign:'center'}}>
                  <div style={{fontSize:10.5,color:'#666',fontWeight:700,marginBottom:2}}>💰 ยอดขายวันนี้</div>
                  <SemiGauge value={sp} color={sCol} size={74}/>
                  <div style={{fontSize:19,fontWeight:900,color:sCol,marginTop:1}}>{sp.toFixed(0)}%</div>
                  <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:4}}>
                    <div>
                      <div style={{fontSize:8.5,color:'#999',fontWeight:700}}>ทำได้</div>
                      <div style={{fontSize:13,fontWeight:800,color:sCol}}>{r.todaySales>0?fM(r.todaySales):'—'}</div>
                    </div>
                    <div style={{width:1,height:24,background:CI.line}}/>
                    <div>
                      <div style={{fontSize:8.5,color:'#999',fontWeight:700}}>เป้า</div>
                      <div style={{fontSize:13,fontWeight:700,color:'#555'}}>{fM(r.salesDayTgt)}</div>
                    </div>
                  </div>
                </div>
                <div style={{background:CI.paper,border:`1px solid ${CI.line}`,borderRadius:10,padding:'8px 6px',textAlign:'center'}}>
                  <div style={{fontSize:10.5,color:'#666',fontWeight:700,marginBottom:2}}>🏷️ ยางวันนี้</div>
                  <SemiGauge value={tp} color={tCol} size={74}/>
                  <div style={{fontSize:19,fontWeight:900,color:tCol,marginTop:1}}>{tp.toFixed(0)}%</div>
                  <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:4}}>
                    <div>
                      <div style={{fontSize:8.5,color:'#999',fontWeight:700}}>ทำได้</div>
                      <div style={{fontSize:13,fontWeight:800,color:tCol}}>{r.todayTire>0?r.todayTire:'—'} เส้น</div>
                    </div>
                    <div style={{width:1,height:24,background:CI.line}}/>
                    <div>
                      <div style={{fontSize:8.5,color:'#999',fontWeight:700}}>เป้า</div>
                      <div style={{fontSize:13,fontWeight:700,color:'#555'}}>{r.tireDayTgt} เส้น</div>
                    </div>
                  </div>
                </div>
                  </>
                })()}
              </div>
            </div>
          )})}
        </div>
      ) : (
        <div style={{background:'#161b25',borderRadius:10,border:'1px solid #2d3548',overflow:'auto'}}>
          <div style={{padding:'10px 14px',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:CI.red,borderBottom:'1px solid #2d3548'}}>
            เป้าวัน = (เป้าเดือน − MTD วันก่อน) ÷ {TOTAL_D - TODAY_D + 1} วัน — วันที่ {TODAY_D} {MONTH_TH} {cfg.year}
          </div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr style={{background:'#0d1117'}}>
                <th rowSpan={2} style={{padding:'6px 8px',textAlign:'left',color:'#6b7280',fontFamily:'Barlow Condensed',borderBottom:'1px solid #1e2538',verticalAlign:'bottom'}}>สาขา</th>
                <th colSpan={3} style={{padding:'5px 8px',textAlign:'center',color:STATUS.over,fontFamily:'Barlow Condensed',fontSize:10,borderBottom:'1px solid #2d3548',borderLeft:'1px solid #2d3548'}}>⚡ วันนี้ (ยอดขาย)</th>
                <th colSpan={3} style={{padding:'5px 8px',textAlign:'center',color:'#FFFFFF',fontFamily:'Barlow Condensed',fontSize:10,borderBottom:'1px solid #2d3548',borderLeft:'1px solid #2d3548'}}>🏷️ วันนี้ (ยาง)</th>
                <th colSpan={2} style={{padding:'5px 8px',textAlign:'center',color:CI.red,fontFamily:'Barlow Condensed',fontSize:10,borderBottom:'1px solid #2d3548',borderLeft:'1px solid #2d3548'}}>MTD ยอด</th>
                <th colSpan={2} style={{padding:'5px 8px',textAlign:'center',color:'#94a3b8',fontFamily:'Barlow Condensed',fontSize:10,borderBottom:'1px solid #2d3548',borderLeft:'1px solid #2d3548'}}>MTD ยาง</th>
              </tr>
              <tr style={{background:'#0d1117'}}>
                {['จริง','เป้า/วัน','%','จริง (เส้น)','เป้า/วัน','%','ยอด','%เป้า','เส้น','%เป้า'].map((h,i)=>(
                  <th key={i} style={{padding:'5px 8px',textAlign:'center',color:'#6b7280',fontFamily:'Barlow Condensed',fontSize:10,borderBottom:'1px solid #1e2538',borderLeft:i===0||i===3||i===6||i===8?'1px solid #1e2538':'none'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r,i) => (
                <tr key={r.id} style={{borderBottom:'1px solid #1e2538',background:r.hasToday?'#0d1a0d':i%2===0?'transparent':'#131820'}}>
                  <td style={{padding:'7px 8px',fontFamily:'Barlow Condensed',fontWeight:700,color:BCLR[r.idx],fontSize:12,whiteSpace:'nowrap'}}>{r.id} {r.short}{!r.hasToday&&<span style={{color:'#E2231A',fontSize:8,marginLeft:4}}>⚠</span>}</td>
                  {/* Today sales */}
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:r.todaySales>0?STATUS.over:'#374151',borderLeft:'1px solid #1e2538'}}>{r.todaySales>0?fM(r.todaySales):'—'}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",color:'#6b7280'}}>{fM(r.salesDayTgt)}</td>
                  <td style={{padding:'7px 8px',textAlign:'center'}}><AchBadge pct={r.salesAch}/></td>
                  {/* Today tire */}
                  <td style={{padding:'7px 8px',textAlign:'center',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:r.todayTire>0?'#FFFFFF':'#374151',borderLeft:'1px solid #1e2538'}}>{r.todayTire>0?N(r.todayTire):'—'}</td>
                  <td style={{padding:'7px 8px',textAlign:'center',color:'#6b7280'}}>{N(r.tireDayTgt)}</td>
                  <td style={{padding:'7px 8px',textAlign:'center'}}><AchBadge pct={r.tireAch}/></td>
                  {/* MTD */}
                  <td style={{padding:'7px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:CI.red,borderLeft:'1px solid #1e2538'}}>{fM(r.ts)}</td>
                  <td style={{padding:'7px 8px',textAlign:'center'}}><PBadge value={r.mtdSalesPct}/></td>
                  <td style={{padding:'7px 8px',textAlign:'center',fontFamily:"'JetBrains Mono',monospace",color:'#FFFFFF',fontWeight:700,borderLeft:'1px solid #1e2538'}}>{r.m.tire}</td>
                  <td style={{padding:'7px 8px',textAlign:'center'}}><PBadge value={r.mtdTirePct}/></td>
                </tr>
              ))}
              {/* Total */}
              <tr style={{background:'#1e2538',borderTop:`2px solid ${CI.red}`}}>
                <td style={{padding:'7px 8px',fontWeight:900,fontFamily:'Barlow Condensed',fontSize:13}}>รวม</td>
                <td style={{padding:'7px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:STATUS.over,borderLeft:'1px solid #2d3548'}}>{fM(todayTotSales)}</td>
                <td style={{padding:'7px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",color:'#6b7280'}}>{fM(todayTotTgt)}</td>
                <td style={{padding:'7px 8px',textAlign:'center'}}><AchBadge pct={todayTotTgt>0?P(todayTotSales,todayTotTgt):null}/></td>
                <td style={{padding:'7px 8px',textAlign:'center',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:'#FFFFFF',borderLeft:'1px solid #2d3548'}}>{N(todayTotTire)}</td>
                <td style={{padding:'7px 8px',textAlign:'center',color:'#6b7280'}}>{N(todayTotTireT)}</td>
                <td style={{padding:'7px 8px',textAlign:'center'}}><AchBadge pct={todayTotTireT>0?P(todayTotTire,todayTotTireT):null}/></td>
                <td style={{padding:'7px 8px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:900,color:CI.red,borderLeft:'1px solid #2d3548'}}>{fM(totTS)}</td>
                <td style={{padding:'7px 8px',textAlign:'center'}}><PBadge value={P(totTS,totTgt)}/></td>
                <td style={{padding:'7px 8px',textAlign:'center',fontFamily:"'JetBrains Mono',monospace",fontWeight:900,color:'#FFFFFF',borderLeft:'1px solid #2d3548'}}>{N(totTire)}</td>
                <td style={{padding:'7px 8px',textAlign:'center'}}><PBadge value={P(totTire,totTireT)}/></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <MascotFooter compact={mobile}/>
      </div>
    </div>
  )
}

/* ════ ASP & SPD ════ */
function ASP({ctx}) {
  const {selBr,setSelBr,getMTD,getAllMTD,getTS,getAllTS,mobile,BRANCHES,BCLR} = ctx
  const AT=3800,SPD_T=5100
  const rows=BRANCHES.map((b,i)=>{const m=getMTD(b.id),ts=getTS(b.id);return{...b,m,ts,asp:m.tire>0&&m.tireSales>0?m.tireSales/m.tire:0,spd:m.jobOrder>0?ts/m.jobOrder:0,idx:i}})
  const aM=getAllMTD(),aTS=getAllTS(),aASP=aM.tire>0&&aM.tireSales>0?aM.tireSales/aM.tire:0,aSPD=aM.jobOrder>0?aTS/aM.jobOrder:0
  const READCLR=['#B45309','#1D4ED8','#047857','#B91C1C','#6D28D9','#C2410C','#0E7490','#BE123C','#4D7C0F','#BE185D']
  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      <BranchSelect sel={selBr} onSel={setSelBr} mobile={mobile} branches={BRANCHES}/>
      <div style={{flex:1}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?16:20,color:CI.red,letterSpacing:2,marginBottom:10}}>💰 ASP & SPD</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <Card label="ASP threshold" value={'฿'+N(AT)} sub="ยอดยาง ÷ เส้น" color={CI.red}/>
          <Card label="SPD threshold" value={'฿'+N(SPD_T)} sub="ยอดรวม ÷ Job" color="#15181C"/>
          <Card label="ASP รวม" value={aASP>0?'฿'+N(Math.round(aASP)):'—'} color={aASP>=AT?STATUS.over:STATUS.push}/>
          <Card label="SPD รวม" value={aSPD>0?'฿'+N(Math.round(aSPD)):'—'} color={aSPD>=SPD_T?STATUS.over:STATUS.push}/>
        </div>
        {mobile ? (
          <div style={{background:CI.black,borderRadius:10,overflow:'hidden'}}>
            {rows.map((r,i)=>(
              <div key={r.id} style={{background:CI.white,padding:'7px 10px',borderTop:i===0?'none':`1px solid ${CI.line}`,
                                       display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,color:READCLR[i],flexShrink:0}}>{r.id} {r.short}</span>
                <span style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  <span style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{fontSize:10,color:'#888'}}>ASP</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:12,color:r.asp===0?'#999':r.asp>=AT?STATUS.over:STATUS.push}}>{r.asp>0?'฿'+N(Math.round(r.asp)):'—'}</span>
                  </span>
                  <span style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{fontSize:10,color:'#888'}}>SPD</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:12,color:r.spd===0?'#999':r.spd>=SPD_T?STATUS.over:STATUS.push}}>{r.spd>0?'฿'+N(Math.round(r.spd)):'—'}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,overflow:'hidden',marginBottom:14}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#0d1117'}}>{['สาขา','ยอดยาง','เส้น','ASP','✓','ยอดรวม','Job','SPD','✓'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'center',color:'#6b7280',fontSize:11,fontFamily:'Barlow Condensed',borderBottom:'1px solid #1e2538'}}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r,i)=>(
                <tr key={r.id} style={{borderBottom:'1px solid #1e2538',background:i%2===0?'transparent':'#131820'}}>
                  <td style={{padding:'8px 10px',fontWeight:600,color:BCLR[r.idx],fontSize:11}}>{r.short}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{N(r.m.tireSales)}</td>
                  <td style={{padding:'8px 10px',textAlign:'center',fontSize:11}}>{r.m.tire}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:r.asp>=AT?STATUS.over:r.asp>0?STATUS.push:'#6b7280',fontSize:11}}>{r.asp>0?'฿'+N(Math.round(r.asp)):'—'}</td>
                  <td style={{padding:'8px 10px',textAlign:'center',fontSize:13}}>{r.asp===0?'—':r.asp>=AT?'✅':'❌'}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{N(r.ts)}</td>
                  <td style={{padding:'8px 10px',textAlign:'center',fontSize:11}}>{r.m.jobOrder}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:r.spd>=SPD_T?STATUS.over:r.spd>0?STATUS.push:'#6b7280',fontSize:11}}>{r.spd>0?'฿'+N(Math.round(r.spd)):'—'}</td>
                  <td style={{padding:'8px 10px',textAlign:'center',fontSize:13}}>{r.spd===0?'—':r.spd>=SPD_T?'✅':'❌'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <MascotFooter compact={mobile}/>
      </div>
    </div>
  )
}

/* ════ ENTRY — กรอกยอดรายวัน ════ */
function Entry({ctx}) {
  const {de,saveDay,delDay,getMTD,getTS,getT,MTD_R,TODAY_D,TOTAL_D,MONTH_TH,cfg,mobile,BRANCHES,BCLR} = ctx
  const [selBr, setSelBr] = useState(BRANCHES[0]?.id || '009')
  useEffect(() => { if (!BRANCHES.some(b=>b.id===selBr)) setSelBr(BRANCHES[0]?.id || '009') }, [BRANCHES])
  const [selDay, setSelDay] = useState(TODAY_D)
  const t=getT(selBr), row=de[selBr]?.[selDay]||EMPTY_ROW(), mtd=getMTD(selBr), ts=getTS(selBr)
  const filled=Object.keys(de[selBr]||{}).map(Number).sort((a,b)=>a-b)
  return (
    <div style={{display:'flex',gap:16,flexDirection:mobile?'column':'row'}}>
      {/* Branch sidebar (no ALL) */}
      {mobile ? (
        <div style={{marginBottom:0}}>
          <select value={selBr} onChange={e=>setSelBr(e.target.value)}
            style={{width:'100%',background:'#1e2538',border:'1px solid #E2231A',borderRadius:8,padding:'11px 14px',color:'#E2231A',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:15,outline:'none',marginBottom:10}}>
            {BRANCHES.map(b=><option key={b.id} value={b.id}>{b.id} — {b.short}</option>)}
          </select>
        </div>
      ) : (
        <div style={{width:165,flexShrink:0}}>
          <div style={{fontSize:10,color:'#6b7280',textTransform:'uppercase',letterSpacing:1,marginBottom:6,fontFamily:'Barlow Condensed'}}>เลือกสาขา</div>
          {BRANCHES.map((b,i)=>(
            <button key={b.id} onClick={()=>setSelBr(b.id)} style={{display:'block',width:'100%',textAlign:'left',padding:'7px 10px',marginBottom:3,borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'Barlow',background:selBr===b.id?'#1e2538':'transparent',border:selBr===b.id?`1px solid ${BCLR[i]}`:'1px solid transparent',color:selBr===b.id?BCLR[i]:'#9ca3af'}}>
              <span style={{fontSize:9,color:BCLR[i],marginRight:4}}>●</span><span style={{fontSize:9,color:'#4b5563',marginRight:3}}>{b.id}</span>{b.short}
            </button>
          ))}
        </div>
      )}
      <div style={{flex:1}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?16:20,color:'#E2231A',letterSpacing:2,marginBottom:10}}>✏️ กรอกยอดรายวัน — {BRANCHES.find(x=>x.id===selBr)?.name}</div>
        {/* Day picker */}
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,padding:12,marginBottom:10}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12,color:'#e5e7eb',marginBottom:8}}>📅 เลือกวัน — {MONTH_TH} {cfg.year}</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:mobile?4:5}}>
            {Array.from({length:TOTAL_D},(_,i)=>{const d=i+1,has=!!(de[selBr]?.[d]),isTdy=d===TODAY_D,isSel=d===selDay;return(
              <button key={d} onClick={()=>setSelDay(d)} style={{width:mobile?33:36,height:mobile?33:36,borderRadius:6,border:isSel?'2px solid #E2231A':has?'1px solid #15181C':'1px solid #2d3548',background:isSel?'#E2231A':has?'#0d2a1a':'#0d1117',color:isSel?'#000':has?'#FFFFFF':d>TODAY_D?'#374151':'#e5e7eb',cursor:'pointer',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:mobile?12:13,position:'relative'}}>
                {d}{isTdy&&<div style={{position:'absolute',top:1,right:2,width:4,height:4,borderRadius:'50%',background:isSel?'#000':'#E2231A'}}/>}
              </button>
            )})}
          </div>
          <div style={{marginTop:6,display:'flex',gap:14,fontSize:10,color:'#6b7280'}}>
            <span><span style={{color:'#E2231A'}}>■</span> เลือก</span>
            <span><span style={{color:'#FFFFFF'}}>■</span> มีข้อมูล</span>
          </div>
        </div>
        {/* MTD summary */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          <Card label={`ยอด MTD (${filled.length}วัน)`} value={fM(ts)} target={fM(Math.round(t.sales*MTD_R))} small/>
          <Card label="% เป้า" value={P(ts,t.sales*MTD_R).toFixed(1)+'%'} color={statusColor(P(ts,t.sales*MTD_R))} small/>
          <Card label="ยาง MTD" value={N(mtd.tire)+' เส้น'} target={Math.round(t.tire*MTD_R)} color="#15181C" small/>
          <Card label="Job Order" value={N(mtd.jobOrder)} target={Math.round(t.cc*MTD_R)} color="#15181C" small/>
        </div>
        {/* Form */}
        <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:10,overflow:'hidden',marginBottom:10}}>
          <div style={{padding:'10px 14px',background:'#0d1117',borderBottom:'1px solid #2d3548',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'#E2231A'}}>
              {selDay} {MONTH_TH} {cfg.year}
              {selDay===TODAY_D&&<span style={{fontSize:11,color:'#FFFFFF',marginLeft:8}}>(วันนี้)</span>}
              {selDay<TODAY_D&&<span style={{fontSize:11,color:'#E2231A',marginLeft:8}}>(ย้อนหลัง)</span>}
              {selDay>TODAY_D&&<span style={{fontSize:11,color:'#6b7280',marginLeft:8}}>(ยังไม่ถึง)</span>}
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <span style={{fontSize:10,color:'#FFFFFF'}}>⚡ Supabase Realtime</span>
              {de[selBr]?.[selDay]&&<button onClick={()=>delDay(selBr,selDay)} style={{padding:'4px 10px',background:'#450a0a',border:'1px solid #E2231A',borderRadius:4,color:'#E2231A',cursor:'pointer',fontSize:11}}>🗑</button>}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr'}}>
            {FIELDS.map((f,i)=>{
              const tV=f.tgt?(t[f.tgt]||0):0
              const isTotalSales = f.key==='totalSales'
              return(
              <div key={f.key} style={{padding:'10px 12px',borderBottom:'1px solid #1e2538',borderRight:(!mobile&&i%2===0)?'1px solid #1e2538':'none',background:isTotalSales?'#1a1228':i%4<2?'transparent':'#0d1117',gridColumn:isTotalSales?'1 / -1':'auto'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <label style={{fontSize:isTotalSales?14:12,fontWeight:700,color:isTotalSales?'#E2231A':'#9ca3af'}}>{isTotalSales?'💰 ':''}{f.label}</label>
                  {tV>0&&<span style={{fontSize:9,color:'#4b5563'}}>เป้า/วัน≈{Math.round(tV/TOTAL_D)}</span>}
                  {isTotalSales&&<span style={{fontSize:10,color:'#6b7280'}}>← กรอกตรงนี้ก่อน ถ้ามีตัวเลขรวม</span>}
                </div>
                <input type="number" inputMode="numeric" value={row[f.key]||''} placeholder={isTotalSales?"0":"0"}
                  onChange={e=>saveDay(selBr,selDay,f.key,e.target.value)}
                  style={{width:'100%',boxSizing:'border-box',background:'#0d1117',border:isTotalSales?'2px solid #E2231A':'1px solid #2d3548',borderRadius:5,padding:mobile?'10px 12px':'7px 10px',color:'#E2231A',fontFamily:"'JetBrains Mono',monospace",fontSize:mobile?18:isTotalSales?18:15,fontWeight:700,outline:'none'}}/>
              </div>
            )})}
          </div>
        </div>
        {/* History */}
        {filled.length>0&&(
          <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:8,overflow:'hidden'}}>
            <div style={{padding:'8px 12px',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:'#FFFFFF',borderBottom:'1px solid #2d3548'}}>📋 ประวัติ {filled.length} วัน (คลิกแถวเพื่อแก้ไข)</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'#0d1117'}}>{['วัน','ยอดรวม','ยาง','ยอดยาง','Battery','Brake','MP','Job',''].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'center',color:'#6b7280',fontSize:10,fontFamily:'Barlow Condensed',borderBottom:'1px solid #1e2538',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                <tbody>{filled.map((d,i)=>{const r=de[selBr][d]||{};const ts=r.totalSales>0?+r.totalSales:calcTS(Object.fromEntries(FIELDS.map(f=>[f.key,+r[f.key]||0])));return(
                  <tr key={d} onClick={()=>setSelDay(d)} style={{borderBottom:'1px solid #1e2538',background:d===selDay?'#1e2538':i%2===0?'transparent':'#131820',cursor:'pointer'}}>
                    <td style={{padding:'6px 8px',textAlign:'center',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:d===selDay?'#E2231A':'#e5e7eb'}}>{d} {MONTH_TH}</td>
                    <td style={{padding:'6px 8px',textAlign:'right',color:'#E2231A',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{ts>0?fM(ts):'—'}</td>
                    <td style={{padding:'6px 8px',textAlign:'center',color:'#FFFFFF',fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{r.tire||'—'}</td>
                    <td style={{padding:'6px 8px',textAlign:'right',color:'#E2231A',fontFamily:"'JetBrains Mono',monospace"}}>{r.tireSales?fM(+r.tireSales):'—'}</td>
                    <td style={{padding:'6px 8px',textAlign:'center'}}>{r.battery||'—'}</td>
                    <td style={{padding:'6px 8px',textAlign:'center'}}>{r.brake||'—'}</td>
                    <td style={{padding:'6px 8px',textAlign:'center'}}>{r.mp||'—'}</td>
                    <td style={{padding:'6px 8px',textAlign:'center'}}>{r.jobOrder||'—'}</td>
                    <td style={{padding:'6px 8px',textAlign:'center'}}><button onClick={e=>{e.stopPropagation();delDay(selBr,d)}} style={{background:'none',border:'none',color:'#E2231A',cursor:'pointer',fontSize:12}}>🗑</button></td>
                  </tr>
                )})}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════
   UPLOAD
═════════════════════════════════════════════════════════════ */

/* ── Parse ยอดขายรายวัน / ยอดขายยางรายวัน ──────────────────────
   File structure:
     Row 1: Year labels (2024 at col C, 2025 at col M)
     Row 3: CustGroupName → look for "Total" to find total columns
     Row 4: "Branch" | "DocDate" | ...
     Data: col1=branch name (on first row of each branch), col2=date, col12=2024 total amt, col22=2025 total amt
   Branch Map: "003-Cockpit Srinakarin" → bid "003"
─────────────────────────────────────────────────────────────── */
const DAILY_BID_MAP = {
  '003':'003','009':'009','010':'010','012':'012','014':'014',
  '048':'048','050':'050','096':'096','089':'143','107':'107','143':'143'
}

function parseDailyFile(wb, sheetHint, isAmountCol) {
  /* ── Handles TWO file formats:
     A) Simple 3-col format (ยอดขายรายวันBackup):
        Col A: Branch name or empty | Col B: Date | Col C: Amount/Qty
        Row 1: header ('Branch','DocDate','Amount'), Row 2+: branch header then data rows
     B) Full 24-col format:
        Col A: Branch, Col B: Date, Col W: Grand Total Qty, Col X: Grand Total Amount
        Rows 1-4: year/month/group headers, Row 5+: branch header then data rows
  ──────────────────────────────────────────────────────────────────── */
  try {
    // Find the sheet that actually contains branch data (has 'Cockpit' in col A)
    // Some files have the hint-named sheet as empty headers; 'Export' has the real data
    let sn = wb.SheetNames.find(s => {
      const ws2 = wb.Sheets[s]
      if (!ws2) return false
      // Quick scan: check first 20 rows of col A for branch names
      const rng2 = XLSX.utils.decode_range(ws2['!ref'] || 'A1')
      for (let rr = 0; rr <= Math.min(20, rng2.e.r); rr++) {
        const cell = ws2[XLSX.utils.encode_cell({r:rr, c:0})]
        const v = cell?.v != null ? String(cell.v) : (cell?.w || '')
        if (v.includes('Cockpit') || v.includes('cockpit')) return true
      }
      return false
    })
    // Fallback: sheet matching hint name, then first sheet
    if (!sn) sn = wb.SheetNames.find(s => s.includes(sheetHint)) || wb.SheetNames[0]
    if (!sn || !wb.Sheets[sn]) return {}

    const ws  = wb.Sheets[sn]
    const ref = ws['!ref']
    if (!ref) return {}
    const range = XLSX.utils.decode_range(ref)
    const nRows = range.e.r + 1
    const nCols = range.e.c + 1

    // ── Detect format ─────────────────────────────────────────────
    // Simple format: 3 cols. Full format: 24 cols.
    const isSimple = nCols <= 5
    // Data column to read from:
    // Simple: always the last col (col C = idx 2 = amount for sales, qty for tire)
    // Full: last col = Amount (X), second-to-last = Qty (W)
    const useCol = isSimple ? range.e.c : (isAmountCol ? range.e.c : range.e.c - 1)

    // ── Cell helpers ──────────────────────────────────────────────
    function cv(r, c) {
      const cell = ws[XLSX.utils.encode_cell({r, c})]
      if (!cell) return null
      return cell.v != null ? cell.v : (cell.w != null ? cell.w : null)
    }

    // Date from col B (idx 1) — prefer cell.w to avoid XLSX.js timezone shift
    function cellDate(r) {
      const cell = ws[XLSX.utils.encode_cell({r, c:1})]
      if (!cell) return null
      const w = String(cell.w || '')
      if (w.length >= 8) {
        const m1 = w.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
        if (m1) { const d=new Date(+m1[3],+m1[2]-1,+m1[1]); if(!isNaN(d.getTime())) return d }
        const m2 = w.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (m2) { const d=new Date(+m2[1],+m2[2]-1,+m2[3]); if(!isNaN(d.getTime())) return d }
      }
      const v = cell.v
      if (v instanceof Date) return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate())
      if (typeof v === 'number' && v > 40000 && v < 60000) {
        const d = new Date(Math.round((v - 25569) * 86400000))
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      }
      return null
    }

    function cellNum(r, c) {
      const v = cv(r, c)
      if (typeof v === 'number') return v
      if (v != null) { const n=parseFloat(String(v).replace(/,/g,'')); if(!isNaN(n)) return n }
      return null
    }

    // ── Parse rows (start from 0 to catch early branch headers) ──
    const result = {}
    let currentBid = null

    for (let r = 0; r < nRows; r++) {
      const s0 = String(cv(r, 0) || '')

      // Skip header row and grand-total rows
      if (s0 === 'Branch' || s0 === 'Total' || s0 === '') {
        // Check if it's actually an empty-A data row (daily row)
        if (s0 === '' && currentBid) {
          const dt = cellDate(r)
          if (dt && !isNaN(dt.getTime())) {
            const yr=dt.getFullYear(), mo=dt.getMonth()+1, day=dt.getDate()
            if (yr>=2020 && yr<=2030 && day>=1 && day<=31) {
              const val = cellNum(r, useCol)
              if (val != null && val > 0) {
                const key = `${yr}-${String(mo).padStart(2,'0')}`
                if (!result[currentBid][key]) result[currentBid][key] = {}
                result[currentBid][key][day] = Math.round(val)
              }
            }
          }
        }
        continue
      }

      // Branch header row (col A has branch name with ID prefix)
      if (s0.includes('Cockpit') || s0.includes('cockpit')) {
        const rawBid = s0.split('-')[0].trim()
        const bid = DAILY_BID_MAP[rawBid.padStart(3,'0')] || rawBid.padStart(3,'0')
        currentBid = bid
        if (!result[bid]) result[bid] = {}
        continue
      }

      // Data row with branch name in col A (shouldn't normally happen but handle)
      if (currentBid) {
        const dt = cellDate(r)
        if (dt && !isNaN(dt.getTime())) {
          const yr=dt.getFullYear(), mo=dt.getMonth()+1, day=dt.getDate()
          if (yr>=2020 && yr<=2030 && day>=1 && day<=31) {
            const val = cellNum(r, useCol)
            if (val != null && val > 0) {
              const key = `${yr}-${String(mo).padStart(2,'0')}`
              if (!result[currentBid][key]) result[currentBid][key] = {}
              result[currentBid][key][day] = Math.round(val)
            }
          }
        }
      }
    }

    return result
  } catch(e) {
    console.error('parseDailyFile error:', e)
    return {}
  }
}



/* ── Upload file type definitions ──────────────────────────────────── */
const FDEFS = [
  {
    key:   'target',
    label: 'เป้าเดือน (Jun/Jul...)',
    icon:  '🎯',
    hint:  'Sheet: For_BI'
  },
  {
    key:   'salesdata',
    label: 'Data_sale_by_Store.xlsx',
    icon:  '📊',
    hint:  'Sheet: 003-xxx, 009-xxx, Total → โหลด ยาง (เส้น) รายเดือน 2024/2025/2026'
  },
  {
    key:   'hist',
    label: 'ประวัติยอดขาย.xlsx',
    icon:  '📖',
    hint:  'Sheet: Data 009, Data 010... หรือ Sales History23-26 → โหลดยาง 2022-2024 รายเดือน'
  },
  {
    key:   'daily',
    label: 'ยอดขายรายวัน.xlsx',
    icon:  '📅',
    hint:  'Sheet: ยอดขายรายวัน → โหลดยอดขาย 2024/2025 รายวัน'
  },
  {
    key:   'tiredaily',
    label: 'ยอดขายยางรายวัน.xlsx',
    icon:  '🛞',
    hint:  'Sheet: ยอดขายยางรายวัน → โหลดยาง 2024/2025 รายวัน'
  },
]

function parseSalesData(wb) {
  // Data_sale_by_Store.xlsx → ยาง (เส้น) รายเดือน เท่านั้น
  // ยอดขาย ฿ รายเดือน → ดึงจาก ประวัติยอดขาย.xlsx (key='hist')
  const tireqOut = {}
  const parsed   = []

  const COL_START = { 2024: 4, 2025: 17, 2026: 30 }
  const MON_COUNT = { 2024: 12, 2025: 12, 2026: 12 }  // อ่านครบ 12 เดือน เดือนที่ยังไม่มีข้อมูลจะได้ 0
  const TIRE_ROW  = 24
  const JOB_ROW   = 3

  // Dynamically find the Tire Grand Total row
  // Searches for the row where Layer3='Total' and its parent section is '2. Tire'
  function findTireRow(rows) {
    let inTire = false
    for (let r = 0; r < rows.length; r++) {
      const c0 = String(rows[r]?.[0]||'')
      const c1 = String(rows[r]?.[1]||'')
      const c2 = String(rows[r]?.[2]||'')
      const c3 = String(rows[r]?.[3]||'')
      if (c0.includes('Tire') || c0==='2. Tire') inTire = true
      if (inTire && (c2==='Total'||c1==='Total') && (c3==='-'||!rows[r]?.[3])) return r
    }
    return TIRE_ROW
  }

  wb.SheetNames.forEach(sn => {
    const match = sn.match(/^(\d{3})/)
    if (!match) return
    const bid = match[1]

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 })
    const tireRowIdx = findTireRow(rows)

    tireqOut[bid] = {}
    ;[2024, 2025, 2026].forEach(yr => {
      const start  = COL_START[yr]
      const months = MON_COUNT[yr]
      const tireq  = []
      for (let m = 0; m < months; m++) {
        const col = start + m
        tireq.push(Number(rows[tireRowIdx]?.[col]) || 0)
      }
      while (tireq.length < 12) tireq.push(null)
      tireqOut[bid][yr] = tireq
    })

    // หาเดือนล่าสุดที่มีข้อมูลจริงใน 2026 (ไม่ใช่ 0)
    let lastNonZeroCol = COL_START[2026]
    for (let m = 0; m < 12; m++) {
      const col = COL_START[2026] + m
      if (Number(rows[tireRowIdx]?.[col]) > 0) lastNonZeroCol = col
    }
    const latestCol = lastNonZeroCol
    parsed.push({
      bid,
      name: sn,
      tire: Number(rows[tireRowIdx]?.[latestCol]) || 0,
      job:  Number(rows[JOB_ROW]?.[latestCol])   || 0,
    })
  })

  // ── Total sheet → monthly tire qty ──────────────────────────
  const totalMtAll = {}
  const totalSn = wb.SheetNames.find(s => s==='Total'||s.toLowerCase()==='total')
  if (totalSn) {
    const tRows = XLSX.utils.sheet_to_json(wb.Sheets[totalSn], {header:1})
    const MMAP = {January:1,February:2,March:3,April:4,May:5,June:6,
                  July:7,August:8,September:9,October:10,November:11,December:12}
    let tRow = null
    for (let r=0; r<tRows.length; r++) {
      if (String(tRows[r]?.[0]||'').includes('Tire') &&
          String(tRows[r]?.[1]||'').includes('Unit') &&
          String(tRows[r]?.[2]||'').toLowerCase()==='total') { tRow=r; break }
    }
    if (tRow !== null) {
      const hY=tRows[0]||[], hM=tRows[1]||[]
      for (let c=4; c<hY.length; c++) {
        const yr=hY[c], mo=hM[c], val=tRows[tRow]?.[c]
        if (!yr||!mo||mo==='Total'||val==null||isNaN(Number(val))) continue
        const sy=String(Math.round(yr)), sm=String(MMAP[mo]||0)
        if (!sm||sm==='0') continue
        if (!totalMtAll[sy]) totalMtAll[sy]={}
        totalMtAll[sy][sm]=Math.round(Number(val))
      }
    }
  }
  return { tireqOut, parsed, totalMtAll }
}

/* ── Parse ประวัติยอดขาย.xlsx → tire qty per branch per year ──────────
   Sheet types:
   A) "Data XXX" — rows: [bid, 'Tire', year, Jan, Feb, ..., Dec]
                  First 'Tire' row per year = total tire qty
   B) "XXX (2)" — Row 1: year at col E, Row 25: Tire Grand Total Jan-Dec
──────────────────────────────────────────────────────────────────────── */
function parseHistFile(wb) {
  const tireqOut = {}  // { bid: { yr: [12 monthly values] } }

  const BID_MAP = {'003':'003','009':'009','010':'010','012':'012',
                   '014':'014','048':'048','050':'050','078':'078',
                   '089':'143','096':'096','107':'107','143':'143'}

  wb.SheetNames.forEach(sn => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, raw:true})
    if (!rows || rows.length < 3) return

    // ── Type A: "Data XXX" sheets ──────────────────────────────────────
    if (/^Data\s+\d/i.test(sn)) {
      let bid = null
      const seenYr = {}

      for (let r = 0; r < rows.length; r++) {
        const c0 = String(rows[r]?.[0]||'')
        const c1 = String(rows[r]?.[1]||'')
        const c2 = rows[r]?.[2]
        const c3 = rows[r]?.[3]

        // Extract bid from branch name in col A
        if (!bid) {
          const m = c0.match(/(\d{3})-Cockpit/)
          if (m) bid = BID_MAP[m[1]] || m[1]
        }
        if (!bid) continue

        // Tire qty row: col1='Tire', col2=year(int), col3=small number (qty not ฿)
        const yr = typeof c2==='number' ? c2 : null
        const isQty = c1==='Tire' && yr && yr>2020 && yr<2030
          && typeof c3==='number' && c3 < 2000  // qty, not ฿
        if (isQty && !seenYr[yr]) {
          seenYr[yr] = true
          const monthly = []
          for (let m = 0; m < 12; m++) {
            const v = rows[r]?.[3+m]
            monthly.push(typeof v==='number' && v>0 ? Math.round(v) : null)
          }
          if (monthly.some(v => v!=null)) {
            if (!tireqOut[bid]) tireqOut[bid] = {}
            tireqOut[bid][yr] = monthly
          }
        }
      }
      return
    }

    // ── Type B: "XXX (2)" sheets ────────────────────────────────────────
    const bidMatch = sn.match(/^(\d{3})/)
    if (!bidMatch) return
    const bid = BID_MAP[bidMatch[1]] || bidMatch[1]

    // Row 1 (index 0): find year value
    let yearVal = null, yearCol = null
    for (let c = 0; c < (rows[0]?.length||0); c++) {
      const v = rows[0][c]
      if (typeof v==='number' && v>2020 && v<2030) {
        yearVal = v; yearCol = c; break
      }
    }
    if (!yearVal || yearCol==null) return

    // Find Tire Grand Total row: col2='Total', col3='-' or null, within Tire section
    let inTire = false, tireTotalRow = -1
    for (let r = 0; r < rows.length; r++) {
      const c0 = String(rows[r]?.[0]||'')
      const c2 = String(rows[r]?.[2]||'')
      const c3 = rows[r]?.[3]
      if (c0==='2. Tire' || c0.startsWith('2. Tire')) inTire = true
      if (inTire && c2==='Total' && (c3==='-'||c3==null)) {
        tireTotalRow = r; break
      }
    }
    if (tireTotalRow < 0) return

    const monthly = []
    for (let m = 0; m < 12; m++) {
      const v = rows[tireTotalRow]?.[yearCol+m]
      monthly.push(typeof v==='number' && v>0 ? Math.round(v) : null)
    }
    if (monthly.some(v => v!=null)) {
      if (!tireqOut[bid]) tireqOut[bid] = {}
      tireqOut[bid][yearVal] = monthly
    }
  })

  return { tireqOut }
}

function parseTgt(wb) {

  const sn =
    wb.SheetNames.find(
      s =>
        s.toLowerCase().includes('for_bi') ||
        s.includes('2026')
    ) || wb.SheetNames[0]

  const rows = XLSX.utils.sheet_to_json(
    wb.Sheets[sn],
    { header:1 }
  )

  const map = {
    '3':'003',
    '9':'009',
    '10':'010',
    '12':'012',
    '14':'014',
    '48':'048',
    '50':'050',
    '96':'096',
    '107':'107',
    '143':'143'
  }

  const res = {}

  rows.forEach(r => {

    const bid = map[String(r[0] || '').trim()]

    if (bid && r[3]) {

      res[bid] = {
        sales:   +r[3]  || 0,
        tire:    +r[4]  || 0,
        lube:    +r[5]  || 0,
        battery: +r[6]  || 0,
        brake:   +r[7]  || 0,
        shock:   +r[8]  || 0,
        mp:      +r[9]  || 0,
        cc:      +r[12] || 0
      }
    }
  })

  return res
}

function Upload({ ctx }) {

  const {
    upStat,
    setUpStat,
    setTARGET,
    setHIST,
    setHistDailySales,
    setHistDailyTire,
    setHistTireQ,
    setUploadedMtAll,
    mobile
  } = ctx

  const refs = {
    target:    useRef(),
    salesdata: useRef(),
    hist:      useRef(),
    daily:     useRef(),
    tiredaily: useRef()
  }

  /* ═════════════════════════════════════════════════════
     HANDLE UPLOAD
  ═════════════════════════════════════════════════════ */

  const handle = async (key, file) => {

    if (!file) return

    try {

      const buf = await file.arrayBuffer()

      const wb = XLSX.read(buf, { type: 'array', cellDates: true })

      /* ─────────────────────────────────────────────
         SALES DATA (Data_sale_by_Store.xlsx)
         อัพเดท HIST รายเดือน 2024-2026 ทุกสาขา
      ───────────────────────────────────────────── */

      if (key === 'salesdata') {

        const { tireqOut, parsed, totalMtAll } = parseSalesData(wb)

        // Update tire quantity history (2024/2025/2026 monthly)
        if (Object.keys(tireqOut).length > 0) {
          setHistTireQ(prev => {
            const n = { ...prev }
            Object.entries(tireqOut).forEach(([bid, years]) => {
              n[bid] = { ...(n[bid] || {}), ...years }
            })
            DB.set('cp_tireq', n)
            return n
          })
        }

        // อัพเดท uploadedMtAll (Total sheet monthly tire)
        if (Object.keys(totalMtAll).length > 0) {
          setUploadedMtAll(prev => {
            const n={...prev}
            Object.entries(totalMtAll).forEach(([yr,months])=>{n[yr]={...(n[yr]||{}),...months}})
            DB.set('cp_umtal',n)
            return n
          })
        }
        const summary = parsed.map(p => `${p.bid}: ยาง ${p.tire} เส้น`).join('\n')
        console.log('Tire data parsed:\n' + summary)
      }

      /* ─────────────────────────────────────────────
         TARGET
      ───────────────────────────────────────────── */

      if (key === 'target') {

        const p = parseTgt(wb)

        setTARGET(prev => {

          const n = {
            ...prev,
            ...p
          }

          DB.set('cp_tgt', n)

          return n
        })
      }

      /* ─────────────────────────────────────────────
         HISTORY
      ───────────────────────────────────────────── */

      if (key === 'hist') {
        const { tireqOut } = parseHistFile(wb)
        const branchCount = Object.keys(tireqOut).length
        if (branchCount > 0) {
          setHistTireQ(prev => {
            const n = {...prev}
            Object.entries(tireqOut).forEach(([bid, years]) => {
              n[bid] = {...(n[bid]||{}), ...years}
            })
            DB.set('cp_tireq', n)
            return n
          })
          console.log(`History parsed: ${branchCount} branches, years: ${[...new Set(Object.values(tireqOut).flatMap(y=>Object.keys(y)))].join(',')}`)
        }
      }

      /* ─────────────────────────────────────────────
         DAILY SALES — ยอดขายรายวัน.xlsx
      ───────────────────────────────────────────── */
      if (key === 'daily') {
        const parsed = parseDailyFile(wb, 'ยอดขายรายวัน', true)
        const bc = Object.keys(parsed).length
        if (bc > 0) {
          const td = Object.values(parsed).reduce((s,m)=>s+Object.values(m).reduce((a,d)=>a+Object.keys(d).length,0),0)
          setHistDailySales(prev => { const n={...prev}; Object.entries(parsed).forEach(([b,mo])=>{n[b]={...(n[b]||{}),...mo}}); DB.set('cp_hdsl',n); return n })
          alert(`✅ ยอดขายรายวัน: ${bc} สาขา, ${td} วันข้อมูล\nกราฟรายวันจะแสดงข้อมูลจริงแล้ว`)
          console.log('Daily sales OK:', bc, 'branches', td, 'days', Object.keys(parsed))
        } else {
          alert('⚠️ ยอดขายรายวัน: ไม่พบข้อมูล\nSheets: ' + wb.SheetNames.join(', '))
          console.warn('parseDailyFile empty. Sheets:', wb.SheetNames)
        }
      }

      /* ─────────────────────────────────────────────
         DAILY TIRE — ยอดขายยางรายวัน.xlsx
      ───────────────────────────────────────────── */
      if (key === 'tiredaily') {
        const parsed = parseDailyFile(wb, 'ยอดขายยาง', false)
        const bc = Object.keys(parsed).length
        if (bc > 0) {
          const td = Object.values(parsed).reduce((s,m)=>s+Object.values(m).reduce((a,d)=>a+Object.keys(d).length,0),0)
          setHistDailyTire(prev => { const n={...prev}; Object.entries(parsed).forEach(([b,mo])=>{n[b]={...(n[b]||{}),...mo}}); DB.set('cp_hdtr',n); return n })
          alert(`✅ ยอดขายยางรายวัน: ${bc} สาขา, ${td} วันข้อมูล\nกราฟยางจะแสดงข้อมูลจริงแล้ว`)
          console.log('Daily tire OK:', bc, 'branches', td, 'days')
        } else {
          alert('⚠️ ยอดขายยางรายวัน: ไม่พบข้อมูล\nSheets: ' + wb.SheetNames.join(', '))
          console.warn('parseDailyFile(tire) empty. Sheets:', wb.SheetNames)
        }
      }

      /* ─────────────────────────────────────────────
         STATUS
      ───────────────────────────────────────────── */

      const ns = {
        ...upStat,
        [key]: {
          name: file.name,
          time: new Date().toLocaleTimeString('th-TH'),
          ok: true
        }
      }

      setUpStat(ns)

      DB.set('cp_up', ns)

    } catch (e) {

      console.error(e)

      const ns = {
        ...upStat,
        [key]: {
          name: file.name,
          ok: false,
          err: e.message
        }
      }

      setUpStat(ns)
    }
  }

  return (

    <div>

      <div style={{
        fontFamily:'Barlow Condensed',
        fontWeight:900,
        fontSize:mobile ? 18 : 22,
        color:'#E2231A',
        letterSpacing:2,
        marginBottom:6
      }}>
        📁 อัพโหลด Excel
      </div>

      <div style={{
        fontSize:12,
        color:'#6b7280',
        marginBottom:16
      }}>
        อัพโหลดครั้งเดียว — ทุกเครื่องเห็นข้อมูลใหม่ทันที
        (Supabase Realtime)
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:mobile ? '1fr' : '1fr 1fr',
        gap:12,
        marginBottom:20
      }}>

        {FDEFS.map(fd => {

          const st = upStat[fd.key]

          return (

            <div
              key={fd.key}
              style={{
                background:'#1a1f2e',
                border:`1px solid ${
                  st?.ok
                    ? '#15181C'
                    : st?.ok === false
                    ? '#E2231A'
                    : '#2d3548'
                }`,
                borderRadius:10,
                padding:14
              }}
            >

              <div style={{
                fontFamily:'Barlow Condensed',
                fontWeight:700,
                fontSize:14,
                marginBottom:2
              }}>
                {fd.icon} {fd.label}
              </div>

              <div style={{
                fontSize:10,
                color:'#6b7280',
                marginBottom:10
              }}>
                {fd.hint}
              </div>

              {st && (

                <div style={{
                  fontSize:11,
                  marginBottom:8,
                  color:st.ok ? '#FFFFFF' : '#E2231A',
                  background:st.ok ? '#0d2a1a' : '#2a0d0d',
                  padding:'4px 8px',
                  borderRadius:4
                }}>
                  {st.ok ? '✅' : '❌'} {st.name}
                </div>
              )}

              <input
                ref={refs[fd.key]}
                type="file"
                accept=".xlsx,.xls"
                style={{ display:'none' }}
                onChange={e =>
                  handle(fd.key, e.target.files[0])
                }
              />

              <button
                onClick={() =>
                  refs[fd.key].current?.click()
                }
                style={{
                  width:'100%',
                  padding:'10px 0',
                  background:'#15181C',
                  color:'#fff',
                  border:'none',
                  borderRadius:6,
                  cursor:'pointer',
                  fontFamily:'Barlow Condensed',
                  fontWeight:700,
                  fontSize:13
                }}
              >
                📂 {st?.ok ? 'อัพโหลดใหม่' : 'เลือกไฟล์'}
              </button>

            </div>
          )
        })}

      </div>

    </div>
  )
}
/* ════ SETTINGS ════ */
function Settings({ctx}) {
  const {cfg,saveCfg,TODAY_D,TOTAL_D,DAYS_LEFT,MTD_R,MONTH_TH,mobile,authHash,setAuthHash,logout} = ctx
  const [form,setForm]=useState({year:cfg.year,month:cfg.month,todayDay:cfg.todayDay})
  const [saved,setSaved]=useState(false)
  const totalDP=dIM(form.year,form.month), daysLP=Math.max(1,totalDP-form.todayDay)
  const IS={width:'100%',boxSizing:'border-box',background:'#0d1117',border:'1px solid #2d3548',borderRadius:6,padding:'11px 10px',color:'#E2231A',fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,outline:'none',textAlign:'center'}
  const pwInputSt={boxSizing:'border-box',background:'#0d1117',border:'1px solid #2d3548',borderRadius:6,padding:'11px 10px',color:'#e5e7eb',fontFamily:'Barlow Condensed',fontSize:14,outline:'none'}

  /* ── เปลี่ยนรหัสผ่าน — ต้องใส่ "รหัสกุญแจ" ให้ถูกก่อนจึงแก้ได้ (เฉพาะผู้ดูแลระบบ) ── */
  const [mkInput, setMkInput] = useState('')
  const [mkOk, setMkOk]       = useState(false)
  const [mkErr, setMkErr]     = useState('')
  const [mkBusy, setMkBusy]   = useState(false)
  const verifyMk = async () => {
    setMkErr('')
    if (!mkInput) return
    setMkBusy(true)
    try {
      const h = await sha256Hex(mkInput)
      setMkBusy(false)
      if (h === MASTER_KEY_HASH) { setMkOk(true); setMkInput('') }
      else { setMkErr('รหัสกุญแจไม่ถูกต้อง'); setMkInput('') }
    } catch(e) { setMkBusy(false); setMkErr('เกิดข้อผิดพลาด: '+(e?.message||e)) }
  }

  const [newPw, setNewPw]     = useState('')
  const [newPw2, setNewPw2]   = useState('')
  const [pwErr, setPwErr]     = useState('')
  const [pwBusy, setPwBusy]   = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const changePw = async () => {
    setPwErr('')
    if (newPw.length < 4) return setPwErr('รหัสผ่านสั้นเกินไป — อย่างน้อย 4 ตัวอักษร')
    if (newPw !== newPw2)  return setPwErr('รหัสผ่านยืนยันไม่ตรงกัน')
    setPwBusy(true)
    try {
      const h = await sha256Hex(newPw)
      const ok = await DB.set('cp_auth', h)
      setPwBusy(false)
      if (!ok) return setPwErr('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
      setAuthHash(h)
      setNewPw(''); setNewPw2('')
      setPwSaved(true); setTimeout(()=>setPwSaved(false),3000)
    } catch(e) { setPwBusy(false); setPwErr('เกิดข้อผิดพลาด: '+(e?.message||e)) }
  }

  const handleSave = () => {
    saveCfg({year:Number(form.year),month:Number(form.month),todayDay:Number(form.todayDay)})
    setSaved(true); setTimeout(()=>setSaved(false),3000)
  }

  return (
    <div style={{maxWidth:560,margin:'0 auto'}}>
      {/* ── ความปลอดภัย: เปลี่ยนรหัสผ่าน (ล็อกด้วยรหัสกุญแจ) / ออกจากระบบ ── */}
      <div style={{background:'#161b25',border:`1px solid ${CI.red}55`,borderRadius:10,padding:16,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:14,color:'#e5e7eb'}}>🔒 ความปลอดภัย — เปลี่ยนรหัสผ่าน</div>
          <button onClick={logout} style={{padding:'5px 12px',background:'transparent',border:`1px solid ${CI.red}`,color:CI.red,borderRadius:6,cursor:'pointer',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,whiteSpace:'nowrap'}}>
            🚪 ออกจากระบบ
          </button>
        </div>

        {!mkOk ? (
          <>
            <div style={{fontSize:11,color:'#9ca3af',marginBottom:8}}>🔑 ต้องใส่รหัสกุญแจก่อนจึงจะเปลี่ยนรหัสผ่านได้ (เฉพาะผู้ดูแลระบบ)</div>
            <div style={{display:'flex',gap:8}}>
              <input type="password" value={mkInput} onChange={e=>setMkInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter') verifyMk()}}
                placeholder="รหัสกุญแจ" style={{...pwInputSt,flex:1}}/>
              <button onClick={verifyMk} disabled={mkBusy} style={{padding:'0 18px',background:mkBusy?'#555':CI.yellow,color:CI.black,border:'none',borderRadius:6,cursor:mkBusy?'default':'pointer',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13,whiteSpace:'nowrap'}}>
                {mkBusy?'...':'ยืนยัน'}
              </button>
            </div>
            {mkErr && <div style={{color:CI.red,fontSize:11,marginTop:8,fontFamily:'Barlow Condensed',fontWeight:600}}>⚠️ {mkErr}</div>}
          </>
        ) : (
          <>
            <div style={{display:'grid',gridTemplateColumns:mobile?'1fr':'1fr 1fr',gap:8,marginBottom:10}}>
              <input type="password" value={newPw} onChange={e=>{setNewPw(e.target.value);setPwErr('')}}
                placeholder="รหัสผ่านใหม่" style={pwInputSt}/>
              <input type="password" value={newPw2} onChange={e=>{setNewPw2(e.target.value);setPwErr('')}}
                onKeyDown={e=>{if(e.key==='Enter') changePw()}}
                placeholder="ยืนยันรหัสผ่านใหม่" style={pwInputSt}/>
            </div>
            {pwErr && <div style={{color:CI.red,fontSize:11,marginBottom:8,fontFamily:'Barlow Condensed',fontWeight:600}}>⚠️ {pwErr}</div>}
            <button onClick={changePw} disabled={pwBusy} style={{width:'100%',padding:11,background:pwSaved?'#1A7F3E':(pwBusy?'#555':CI.yellow),color:pwSaved?'#fff':CI.black,border:'none',borderRadius:6,cursor:pwBusy?'default':'pointer',fontFamily:'Barlow Condensed',fontWeight:800,fontSize:13}}>
              {pwSaved?'✅ เปลี่ยนรหัสผ่านสำเร็จ':(pwBusy?'กำลังบันทึก...':'💾 เปลี่ยนรหัสผ่าน')}
            </button>
          </>
        )}
      </div>

      <div style={{fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?20:26,color:'#6b7280',marginBottom:4}}>⚙️ ตั้งค่าเดือน</div>
      <div style={{fontSize:12,color:'#6b7280',marginBottom:14}}>เปลี่ยนจากหน้านี้ได้เลย — กด "บันทึก" <strong style={{color:'#FFFFFF'}}>ทุกเครื่องเห็นพร้อมกัน</strong> (Supabase Realtime)</div>

      {/* Current */}
      <div style={{background:'#1e2538',border:'1px solid #6b7280',borderRadius:10,padding:14,marginBottom:14}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:11,color:'#6b7280',marginBottom:8}}>⚡ ค่าปัจจุบัน</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,textAlign:'center',marginBottom:8}}>
          {[{l:'วันที่',v:TODAY_D},{l:'วันในเดือน',v:TOTAL_D},{l:'เหลือ',v:DAYS_LEFT+' วัน'},{l:'% MTD',v:(MTD_R*100).toFixed(1)+'%'}].map(c=>(
            <div key={c.l}><div style={{fontSize:9,color:'#6b7280'}}>{c.l}</div><div style={{fontSize:20,fontWeight:700,color:'#6b7280',fontFamily:"'JetBrains Mono',monospace"}}>{c.v}</div></div>
          ))}
        </div>
        <div style={{textAlign:'center',fontSize:14,color:'#e5e7eb',fontFamily:'Barlow Condensed',fontWeight:700}}>📅 {TODAY_D} {MONTH_TH} {cfg.year}</div>
      </div>

      {/* Edit */}
      <div style={{background:'#161b25',border:'1px solid #2d3548',borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:'#e5e7eb',marginBottom:12}}>✏️ เปลี่ยนเป็น</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
          <div><div style={{fontSize:9,color:'#6b7280',marginBottom:4,fontFamily:'Barlow Condensed'}}>ปี</div><input type="number" value={form.year} min="2024" max="2030" onChange={e=>setForm(p=>({...p,year:e.target.value}))} style={IS}/></div>
          <div><div style={{fontSize:9,color:'#6b7280',marginBottom:4,fontFamily:'Barlow Condensed'}}>เดือน</div>
            <select value={form.month} onChange={e=>setForm(p=>({...p,month:Number(e.target.value),todayDay:Math.min(p.todayDay,dIM(p.year,Number(e.target.value)))}))}
              style={{...IS,fontSize:13,padding:'13px 8px'}}>
              {MONTHS_TH.map((mn,i)=><option key={i+1} value={i+1}>{i+1}. {mn}</option>)}
            </select>
          </div>
          <div><div style={{fontSize:9,color:'#6b7280',marginBottom:4,fontFamily:'Barlow Condensed'}}>วันที่วันนี้</div><input type="number" value={form.todayDay} min="1" max={totalDP} onChange={e=>setForm(p=>({...p,todayDay:Math.min(Number(e.target.value),totalDP)}))} style={IS}/></div>
        </div>
        <div style={{background:'#0d1117',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#FFFFFF',fontFamily:'Barlow Condensed',fontWeight:600}}>
          Preview: {form.todayDay} {MONTHS_TH[form.month-1]} {form.year} | {totalDP} วัน | เหลือ {daysLP} วัน | {(form.todayDay/totalDP*100).toFixed(1)}%
        </div>
        <button onClick={handleSave} style={{width:'100%',padding:14,background:saved?CI.black:CI.red,color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'Barlow Condensed',fontWeight:900,fontSize:mobile?16:18,letterSpacing:2,transition:'all .3s'}}>
          {saved?'✅ บันทึกแล้ว — ทุกเครื่องอัพเดท!':'💾 บันทึก (ทุกเครื่องเห็นพร้อมกัน)'}
        </button>
      </div>

      {/* Quick month */}
      <div style={{background:'#131820',border:'1px solid #2d3548',borderRadius:10,padding:14}}>
        <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:'#e5e7eb',marginBottom:10}}>⚡ เปลี่ยนเดือนด่วน</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {MONTHS_TH.map((mn,i)=>{const mo=i+1,isA=cfg.month===mo&&cfg.year===Number(form.year);return(
            <button key={mo} onClick={()=>{const nf={year:Number(form.year),month:mo,todayDay:1};setForm(nf);saveCfg(nf);setSaved(true);setTimeout(()=>setSaved(false),2000)}}
              style={{padding:'7px 11px',background:isA?CI.red:'#1e2538',color:isA?'#fff':'#9ca3af',border:isA?'1px solid #6b7280':'1px solid #2d3548',borderRadius:6,cursor:'pointer',fontFamily:'Barlow Condensed',fontWeight:700,fontSize:12}}>
              {mo}. {mn}
            </button>
          )})}
        </div>
        <div style={{marginTop:8,fontSize:11,color:'#6b7280'}}>💡 กดเดือน → แก้วันที่ด้านบน → บันทึก</div>

        {/* Supabase setup guide */}
        <div style={{marginTop:16,background:'#0d1117',borderRadius:8,padding:14}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:13,color:'#FFFFFF',marginBottom:10}}>🚀 ขั้นตอนเชื่อม Supabase (ทำครั้งเดียว)</div>
          {[
            {n:'1',t:'สร้าง Project',b:'ไปที่ supabase.com → New project → ตั้งชื่อ → Create'},
            {n:'2',t:'รัน SQL Setup',b:'SQL Editor → New query → วาง code จาก supabase_setup.sql → Run'},
            {n:'3',t:'Copy API Keys',b:'Settings → API → Copy "Project URL" และ "anon/public key"'},
            {n:'4',t:'ใส่ใน supabase.js',b:'แก้ไฟล์ src/supabase.js บน GitHub → ใส่ URL และ Key → Commit'},
          ].map(s=>(
            <div key={s.n} style={{display:'flex',gap:10,marginBottom:10}}>
              <div style={{width:22,height:22,background:'#FFFFFF',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:12,color:'#fff',flexShrink:0}}>{s.n}</div>
              <div><div style={{fontWeight:700,fontSize:12,marginBottom:2}}>{s.t}</div><div style={{fontSize:11,color:'#6b7280',lineHeight:1.5}}>{s.b}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
