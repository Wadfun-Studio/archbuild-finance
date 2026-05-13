import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";

const API = "https://script.google.com/macros/s/AKfycbzCUVLVzXjRWSQri8XTjOrFh373mp_dU3PkCTODGPhyX1bsYNMWf1CxhS79ntUDer5IwA/exec";

const CATS_IN = ["ค่าออกแบบ","ค่าก่อสร้าง","ค่าที่ปรึกษา","ค่างวดโครงการ","รายได้อื่น ๆ"];
const CATS_EX = ["ค่าวัสดุก่อสร้าง","ค่าแรงงาน","ค่าเช่าเครื่องจักร","ค่าสาธารณูปโภค","เงินเดือนพนักงาน","ค่าเช่าออฟฟิศ","ค่าซอฟต์แวร์/ใบอนุญาต","ค่าการตลาด","ค่าเดินทาง","ค่าใช้จ่ายอื่น ๆ"];
const OVERHEAD_CATS = new Set(["เงินเดือนพนักงาน","ค่าเช่าออฟฟิศ","ค่าซอฟต์แวร์/ใบอนุญาต","ค่าสาธารณูปโภค","ค่าการตลาด"]);
const isOverhead = (cat: string) => OVERHEAD_CATS.has(cat);
const VAT_RATE = 0.07;
const WHT_RATE = 0.03;

const fmt = (n: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 }).format(n);
const fmtDate = (d: string) => { if (!d) return ""; return new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }); };
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);

// Format a raw numeric string with thousands separators while preserving trailing decimal entry.
// e.g. "1234"   -> "1,234"
//      "1234."  -> "1,234."
//      "1234.5" -> "1,234.5"
function formatThousand(s: string): string {
  if (!s) return "";
  const [intPart = "", decPart] = s.split(".");
  const formattedInt = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}
function parseThousand(s: string): string { return s.replace(/,/g, ""); }

// PIN gate (CEO-only access) — initial PIN 1202, hash stored in localStorage
const DEFAULT_PIN = "1202";
const PIN_HASH_KEY = "wf_pin_hash";
const PIN_NOTIFY_EMAIL = "a.athiwat29@gmail.com";

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getStoredPinHash(): Promise<string> {
  let hash = localStorage.getItem(PIN_HASH_KEY);
  if (!hash) {
    hash = await sha256Hex(DEFAULT_PIN);
    localStorage.setItem(PIN_HASH_KEY, hash);
  }
  return hash;
}

async function verifyPin(input: string): Promise<boolean> {
  const stored = await getStoredPinHash();
  const inputHash = await sha256Hex(input);
  return inputHash === stored;
}

async function setPinHash(newPin: string) {
  const h = await sha256Hex(newPin);
  localStorage.setItem(PIN_HASH_KEY, h);
}

function genCode6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Thai number-to-words (baht)
function bahtText(num: number): string {
  const digits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const readSix = (n: number): string => {
    if (n === 0) return "";
    const s = String(n).padStart(6, "0");
    let r = "";
    for (let i = 0; i < 6; i++) {
      const d = +s[i];
      const pos = 5 - i;
      if (d === 0) continue;
      let dg = digits[d];
      if (pos === 0 && d === 1 && i < 5) dg = "เอ็ด";
      else if (pos === 1 && d === 1) dg = "";
      else if (pos === 1 && d === 2) dg = "ยี่";
      r += dg + positions[pos];
    }
    return r;
  };
  const readAll = (n: number): string => {
    if (n === 0) return "";
    const million = Math.floor(n / 1000000);
    const rem = n % 1000000;
    let r = "";
    if (million > 0) r += readAll(million) + "ล้าน";
    if (rem > 0) r += readSix(rem);
    return r;
  };
  const abs = Math.abs(num);
  const baht = Math.floor(abs);
  const satang = Math.round((abs - baht) * 100);
  if (baht === 0 && satang === 0) return "ศูนย์บาทถ้วน";
  let r = "";
  if (baht > 0) r += readAll(baht) + "บาท";
  if (satang > 0) r += readAll(satang) + "สตางค์";
  else if (baht > 0) r += "ถ้วน";
  return r;
}

// Running number with prefix, stored in localStorage
function nextRunningNumber(prefix: string, storageKey: string): string {
  const n = parseInt(localStorage.getItem(storageKey) || "0", 10) + 1;
  localStorage.setItem(storageKey, String(n));
  return `${prefix}${String(n).padStart(3, "0")}`;
}

// Company info constant
const COMPANY = {
  name: "WADFUN STUDIO CO.,LTD.",
  branch: "(Head office)",
  address: "168/62 Moo 7 Bangrakpattana Bangbuathong Nonthaburi",
  email: "Wadfunstudio@gmail.com",
  taxId: "0125568023564",
  tel: "065-659-4263",
  bankName: "SCB BANK",
  accName: "Wadfun studio limited",
  accNo: "413-230927-7",
  approver: "นายอธิวัฒน์ กองชัย",
};

// Build the document HTML for one page (ต้นฉบับ or สำเนา)
function buildDocHTML(opts: {
  kind: "invoice"|"receipt";
  copyLabel: "ต้นฉบับ"|"สำเนา";
  docNo: string;
  dateStr: string;
  customerName: string;
  itemName: string;
  description?: string;
  amount: number;
  hasVat?: boolean;
  hasWht?: boolean;
  whtRate?: number;
}): string {
  const isInv = opts.kind === "invoice";
  const titleEn = isInv ? "Invoice" : "TAX INVOICE/RECEIPT";
  const titleTh = isInv ? "ใบแจ้งหนี้" : "ใบกำกับภาษี/ใบเสร็จรับเงิน";
  const hasVat = !!opts.hasVat;
  const hasWht = !isInv && !!opts.hasWht;
  const whtRate = (opts.whtRate ?? 3) / 100;
  const vat = hasVat ? opts.amount * 0.07 : 0;
  const wht = hasWht ? opts.amount * whtRate : 0;
  const grandTotal = opts.amount + vat - wht;
  const signerLeftRole = isInv ? "ผู้อนุมัติ" : "ผู้รับเงิน";
  const signerLeftName = isInv ? `(${COMPANY.approver}) ตัวแทนขาย` : `(คุณ${COMPANY.approver.replace(/^นาย/,"")}) ตัวแทนขาย`;
  const signerRightRole = isInv ? "ผู้รับใบแจ้งหนี้" : "ผู้จ่ายเงิน";
  const signerRightName = `(${opts.customerName}) ผู้อนุมัติ`;

  return `
<div style="width:794px;background:#fff;padding:36px 44px;font-family:'Sarabun',sans-serif;color:#111;box-sizing:border-box;font-size:13px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:14px;">
    <div style="display:flex;align-items:center;gap:14px;">
      <img src="/logo.jpg" style="height:64px;width:auto;" crossorigin="anonymous" onerror="this.style.display='none'"/>
      <div>
        <div style="font-size:18px;font-weight:800;">${COMPANY.name}</div>
        <div style="font-size:11px;color:#666;">${COMPANY.branch}</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:24px;font-weight:800;letter-spacing:.04em;">${titleEn}</div>
      <div style="font-size:14px;font-weight:600;">${titleTh}</div>
      <div style="color:#c62828;font-weight:800;font-size:14px;margin-top:2px;">${opts.copyLabel}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;gap:20px;margin-top:14px;font-size:12px;">
    <div style="flex:1;">
      <div style="font-weight:700;margin-bottom:4px;">ผู้ออก</div>
      <div>${COMPANY.name} ${COMPANY.branch}</div>
      <div>${COMPANY.address}</div>
      <div>Email: ${COMPANY.email}</div>
      <div>เลขประจำตัวผู้เสียภาษี: ${COMPANY.taxId}</div>
      <div>โทร: ${COMPANY.tel}</div>
    </div>
    <div style="min-width:240px;text-align:right;">
      <div><b>เลขที่:</b> ${opts.docNo}</div>
      <div><b>วันที่:</b> ${opts.dateStr}</div>
      <div style="margin-top:10px;text-align:left;background:#f5f5f5;padding:8px 10px;border-radius:6px;">
        <div style="font-weight:700;font-size:11px;color:#666;">ลูกค้า / Customer</div>
        <div style="font-size:14px;font-weight:700;">${opts.customerName}</div>
      </div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:12px;">
    <thead>
      <tr style="background:#1565c0;color:#fff;">
        <th style="padding:8px;border:1px solid #1565c0;width:44px;">ลำดับ</th>
        <th style="padding:8px;border:1px solid #1565c0;text-align:left;">รายการ</th>
        <th style="padding:8px;border:1px solid #1565c0;width:60px;">จำนวน</th>
        <th style="padding:8px;border:1px solid #1565c0;width:110px;">ราคา/หน่วย</th>
        <th style="padding:8px;border:1px solid #1565c0;width:110px;">ราคารวม</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:8px;border:1px solid #ccc;text-align:center;vertical-align:top;">1</td>
        <td style="padding:8px;border:1px solid #ccc;vertical-align:top;">
          ${opts.description ? `<div style="white-space:pre-wrap;line-height:1.45;">${opts.description.replace(/</g,"&lt;")}</div>` : `${opts.itemName} — โครงการ ${opts.customerName}`}
          ${opts.description ? `<div style="color:#888;font-size:11px;margin-top:4px;">โครงการ ${opts.customerName} · ${opts.itemName}</div>` : ""}
        </td>
        <td style="padding:8px;border:1px solid #ccc;text-align:center;vertical-align:top;">1</td>
        <td style="padding:8px;border:1px solid #ccc;text-align:right;vertical-align:top;">${fmt(opts.amount)}</td>
        <td style="padding:8px;border:1px solid #ccc;text-align:right;vertical-align:top;">${fmt(opts.amount)}</td>
      </tr>
      ${Array.from({length:6}).map(()=>`
      <tr>
        <td style="padding:8px;border:1px solid #ccc;height:22px;">&nbsp;</td>
        <td style="padding:8px;border:1px solid #ccc;"></td>
        <td style="padding:8px;border:1px solid #ccc;"></td>
        <td style="padding:8px;border:1px solid #ccc;"></td>
        <td style="padding:8px;border:1px solid #ccc;"></td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div style="display:flex;gap:16px;margin-top:16px;font-size:12px;">
    <div style="flex:1;border:1px solid #ccc;border-radius:6px;padding:10px 12px;">
      <div style="font-weight:700;margin-bottom:6px;">จำนวนเงิน (ตัวอักษร)</div>
      <div style="font-style:italic;">( ${bahtText(grandTotal)} )</div>
    </div>
    <div style="width:240px;">
      <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>ราคารวม</span><span>${fmt(opts.amount)}</span></div>
      ${hasVat?`<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>VAT 7%</span><span>${fmt(vat)}</span></div>`:""}
      ${hasWht?`<div style="display:flex;justify-content:space-between;padding:4px 0;color:#c62828;"><span>หัก ณ ที่จ่าย ${(whtRate*100).toFixed(whtRate*100%1===0?0:1)}%</span><span>-${fmt(wht)}</span></div>`:""}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #111;font-weight:800;font-size:13px;">
        <span>เงินรวมทั้งสิ้น</span><span>${fmt(grandTotal)}</span>
      </div>
    </div>
  </div>

  <div style="margin-top:16px;display:flex;gap:16px;font-size:11.5px;">
    <div style="flex:1;border:1px solid #ccc;border-radius:6px;padding:10px 12px;">
      <div style="font-weight:700;margin-bottom:6px;">ช่องทางชำระเงิน / Payment</div>
      <div>ชื่อบัญชี: ${COMPANY.accName}</div>
      <div>ธนาคาร: ${COMPANY.bankName}</div>
      <div>เลขที่บัญชี: ${COMPANY.accNo}</div>
    </div>
    <div style="flex:1;border:1px solid #ccc;border-radius:6px;padding:10px 12px;">
      <div style="font-weight:700;margin-bottom:6px;">เงื่อนไข / Terms</div>
      <div>- Payment must be made within 7 days</div>
      <div>- Bank transfer only</div>
      <div>- Please send proof of payment via email</div>
    </div>
  </div>

  <div style="margin-top:38px;display:flex;gap:30px;font-size:12px;">
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px dotted #888;padding-top:6px;margin-top:34px;">
        <div style="font-weight:700;">${signerLeftRole}</div>
        <div>${signerLeftName}</div>
        <div style="color:#888;font-size:11px;margin-top:2px;">วันที่ ......./......./.......</div>
      </div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="border-top:1px dotted #888;padding-top:6px;margin-top:34px;">
        <div style="font-weight:700;">${signerRightRole}</div>
        <div>${signerRightName}</div>
        <div style="color:#888;font-size:11px;margin-top:2px;">วันที่ ......./......./.......</div>
      </div>
    </div>
  </div>
</div>`;
}

// Generate two-page PDF (ต้นฉบับ + สำเนา) and trigger download
async function generateDocPDF(kind: "invoice"|"receipt", opts: {
  docNo: string;
  customerName: string;
  itemName: string;
  description?: string;
  amount: number;
  hasVat?: boolean;
  hasWht?: boolean;
  whtRate?: number;
}) {
  const [{ default: html2canvas }, jsPDFmod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const jsPDF = jsPDFmod.jsPDF || jsPDFmod.default;

  const dateStr = new Date().toLocaleDateString("th-TH", { day:"2-digit", month:"long", year:"numeric" });
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (const copyLabel of ["ต้นฉบับ","สำเนา"] as const) {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-99999px;top:0;background:#fff;z-index:-1;";
    host.innerHTML = buildDocHTML({ kind, copyLabel, dateStr, ...opts });
    document.body.appendChild(host);
    // Wait for logo image to load (if present)
    const img = host.querySelector("img") as HTMLImageElement | null;
    if (img && !img.complete) {
      await new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(() => resolve(), 1500);
      });
    }
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    document.body.removeChild(host);

    const imgData = canvas.toDataURL("image/png");
    // Fit width to page, scale height proportionally, then if too tall, cap at page height
    let imgW = pageW;
    let imgH = (canvas.height * pageW) / canvas.width;
    if (imgH > pageH) { imgH = pageH; imgW = (canvas.width * pageH) / canvas.height; }
    const x = (pageW - imgW) / 2;
    const y = 0;
    if (copyLabel === "สำเนา") pdf.addPage();
    pdf.addImage(imgData, "PNG", x, y, imgW, imgH);
  }

  pdf.save(`${kind === "invoice" ? "Invoice" : "Receipt"}_${opts.docNo.replace("/","-")}.pdf`);
}

async function apiGet(action: string, params: Record<string,string> = {}) {
  const url = new URL(API);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  return (await fetch(url.toString())).json();
}
async function apiPost(action: string, body: object = {}) {
  const url = new URL(API);
  url.searchParams.set("action", action);
  return (await fetch(url.toString(), { method: "POST", body: JSON.stringify(body) })).json();
}

type VatType = "output"|"input";
type WhtType = "withheld"|"withhold";
interface Entry { id: number; date: string; type: string; category: string; project: string; description: string; amount: number; vat?: number; wht?: number; vatType?: VatType; whtType?: WhtType; }
type InstKind = "receivable"|"payable";
type InstStatus = "pending"|"received"|"paid";
type InstScope = "design"|"construction";

const SCOPES: { v: InstScope; l: string; icon: string }[] = [
  { v: "design", l: "งานออกแบบ", icon: "✏️" },
  { v: "construction", l: "งานก่อสร้าง/ตกแต่งภายใน", icon: "🏗️" },
];
const scopeLabel = (s: InstScope) => SCOPES.find(x=>x.v===s)?.l || s;
const WORK_CATS_BY_SCOPE: Record<InstScope, string[]> = {
  design: ["ค่าออกแบบ","ค่าที่ปรึกษา","ค่าเขียนแบบ","ค่าควบคุมงาน","อื่นๆ (งานออกแบบ)"],
  construction: ["ค่าตกแต่งภายใน","ค่าก่อสร้าง","ค่าวัสดุ/ค่าของ","ค่าแรงงาน","ค่าเช่าเครื่องจักร","อื่นๆ (งานก่อสร้าง)"],
};

interface ProjectScopeTax { hasVat: boolean; hasWht: boolean; whtRate: number; }
interface ProjectTaxSettings { design: ProjectScopeTax; construction: ProjectScopeTax; }
interface Installment { id: number; kind: InstKind; scope: InstScope; workCategory: string; project: string; name: string; description?: string; amount: number; dueDate: string; status: InstStatus; completedDate?: string; invoiceNo?: string; receiptNo?: string; hasVat?: boolean; hasWht?: boolean; whtRate?: number; }
interface FormState { date: string; type: string; category: string; project: string; description: string; amount: string; useVat: boolean; useWht: boolean; }
interface InstForm { kind: InstKind; scope: InstScope; workCategory: string; project: string; name: string; description: string; amount: string; dueDate: string; }

const defaultScopeTax: ProjectScopeTax = { hasVat: false, hasWht: false, whtRate: 3 };
const defaultTaxSettings: ProjectTaxSettings = { design: { ...defaultScopeTax }, construction: { ...defaultScopeTax } };

function normalizeTaxSettings(raw: unknown): ProjectTaxSettings {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const isScopeShape = (x: unknown): x is ProjectScopeTax =>
      !!x && typeof x === "object" && "hasVat" in (x as object);
    if (isScopeShape(r.design) && isScopeShape(r.construction)) {
      return { design: r.design, construction: r.construction };
    }
    // legacy flat shape — replicate to both scopes
    if ("hasVat" in r || "hasWht" in r || "whtRate" in r) {
      const flat: ProjectScopeTax = {
        hasVat: !!r.hasVat,
        hasWht: !!r.hasWht,
        whtRate: typeof r.whtRate === "number" ? r.whtRate : 3,
      };
      return { design: { ...flat }, construction: { ...flat } };
    }
  }
  return { design: { ...defaultScopeTax }, construction: { ...defaultScopeTax } };
}

const instLabel = (kind: InstKind) => kind==="payable" ? "งวดจ่าย" : "งวดเบิก";
const instDoneLabel = (kind: InstKind) => kind==="payable" ? "จ่ายเงินแล้ว" : "รับเงินแล้ว";
const instPendingLabel = (kind: InstKind) => kind==="payable" ? "รอจ่าย" : "รอรับ";
const instDoneStatus = (kind: InstKind): InstStatus => kind==="payable" ? "paid" : "received";

function Donut({ income, expense }: { income: number; expense: number }) {
  const total = income + expense;
  if (!total) return <div style={{ color:"#bbb", fontSize:13, padding:"20px 0", textAlign:"center" }}>ยังไม่มีข้อมูล</div>;
  const r=60, cx=75, cy=75, sw=20, c=2*Math.PI*r;
  const ip=income/total, id=c*ip, ed=c*(1-ip);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:20 }}>
      <svg width={150} height={150} style={{ flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f4ff" strokeWidth={sw}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef5350" strokeWidth={sw} strokeDasharray={`${ed} ${c}`} strokeDashoffset={0} transform={`rotate(-90 ${cx} ${cy})`}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#43a047" strokeWidth={sw} strokeDasharray={`${id} ${c}`} strokeDashoffset={-ed} transform={`rotate(-90 ${cx} ${cy})`}/>
        <text x={cx} y={cy-8} textAnchor="middle" fontSize={10} fill="#999" fontFamily="Sarabun">สุทธิ</text>
        <text x={cx} y={cy+9} textAnchor="middle" fontSize={12} fontWeight="700" fill={income>=expense?"#2e7d32":"#c62828"} fontFamily="Sarabun">
          {income>=expense?"+":"-"}฿{fmt(Math.abs(income-expense))}
        </text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {[{l:"รายรับ",v:income,p:ip,c:"#2e7d32",d:"#43a047"},{l:"รายจ่าย",v:expense,p:1-ip,c:"#c62828",d:"#ef5350"}].map(x=>(
          <div key={x.l}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
              <div style={{ width:10, height:10, borderRadius:3, background:x.d }}/>
              <span style={{ fontSize:12, color:"#666" }}>{x.l}</span>
            </div>
            <div style={{ fontWeight:700, fontSize:14, color:x.c }}>฿{fmt(x.v)}</div>
            <div style={{ fontSize:11, color:"#aaa" }}>{(x.p*100).toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [view, setView] = useState("dashboard");
  const [form, setForm] = useState<FormState>({ date:today(), type:"expense", category:CATS_EX[0], project:"", description:"", amount:"", useVat:false, useWht:false });
  const [editId, setEditId] = useState<number|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number|null>(null);
  const [showProjMgr, setShowProjMgr] = useState(false);
  const [newProj, setNewProj] = useState("");
  const [toast, setToast] = useState<{msg:string,type:string}|null>(null);
  const [showInstForm, setShowInstForm] = useState(false);
  const [instForm, setInstForm] = useState<InstForm>({ kind:"receivable", scope:"design", workCategory: WORK_CATS_BY_SCOPE.design[0], project:"", name:"งวดที่ 1", description:"", amount:"", dueDate:"" });
  const [instTab, setInstTab] = useState<InstKind>("receivable");
  const [activeScope, setActiveScope] = useState<InstScope>("design");
  const [deleteInstId, setDeleteInstId] = useState<number|null>(null);
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string|null>(null);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinChange, setPinChange] = useState<{ step:"old"|"new"|"verify"; oldPin:string; newPin:string; confirmPin:string; code:string; pendingHash:string; codeSent:boolean; codeExpires:number; codeInput:string }>(
    { step:"old", oldPin:"", newPin:"", confirmPin:"", code:"", pendingHash:"", codeSent:false, codeExpires:0, codeInput:"" }
  );
  const [showTaxSummary, setShowTaxSummary] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string|null>(null);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string,boolean>>({});
  const [sheetSetupDismissed, setSheetSetupDismissed] = useState<boolean>(()=>localStorage.getItem("wf_sheet_setup_dismissed")==="1");
  function dismissSheetSetup() { localStorage.setItem("wf_sheet_setup_dismissed","1"); setSheetSetupDismissed(true); }
  const [projectTax, setProjectTax] = useState<Record<string, ProjectTaxSettings>>({});
  const [pendingTaxPropagate, setPendingTaxPropagate] = useState<{ name: string; scope: InstScope; next: ProjectScopeTax }|null>(null);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(()=>localStorage.getItem("wf_notif_enabled")!=="0");
  const [alertDaysAhead, setAlertDaysAhead] = useState<number>(()=>{
    const v = parseInt(localStorage.getItem("wf_alert_days_ahead")||"7",10);
    return Number.isFinite(v)&&v>0 ? v : 7;
  });
  const [dateFormat, setDateFormat] = useState<"be"|"ce">(()=>(localStorage.getItem("wf_date_format") as "be"|"ce")||"be");
  const [deleteProj, setDeleteProj] = useState<string|null>(null);
  const [deleteProjConfirm, setDeleteProjConfirm] = useState("");

  const fmtDate = useCallback((d: string|Date) => {
    if (!d) return "";
    const date = d instanceof Date ? d : new Date(d);
    const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
    if (dateFormat === "ce") return date.toLocaleDateString("th-TH-u-ca-gregory", opts);
    return date.toLocaleDateString("th-TH", opts);
  }, [dateFormat]);

  function toggleGroup(key: string) {
    setCollapsedGroups(s => ({ ...s, [key]: !s[key] }));
  }

  const getProjectTax = useCallback((name: string): ProjectTaxSettings => projectTax[name] || defaultTaxSettings, [projectTax]);
  const getProjectScopeTax = useCallback((name: string, scope: InstScope): ProjectScopeTax => getProjectTax(name)[scope] || defaultScopeTax, [getProjectTax]);

  function saveProjectTax(map: Record<string, ProjectTaxSettings>) {
    setProjectTax(map);
    localStorage.setItem("wf_project_tax", JSON.stringify(map));
  }

  function updateProjectScopeTaxField(name: string, scope: InstScope, partial: Partial<ProjectScopeTax>) {
    const current = getProjectTax(name);
    const nextScope: ProjectScopeTax = { ...current[scope], ...partial };
    const nextFull: ProjectTaxSettings = { ...current, [scope]: nextScope };
    saveProjectTax({ ...projectTax, [name]: nextFull });
    if (installments.some(i => i.project === name && i.scope === scope)) {
      setPendingTaxPropagate({ name, scope, next: nextScope });
    }
  }

  function propagateTaxToInstallments(name: string, scope: InstScope, t: ProjectScopeTax) {
    saveInstallments(installments.map(i => i.project === name && i.scope === scope ? { ...i, hasVat: t.hasVat, hasWht: t.hasWht, whtRate: t.whtRate } : i));
  }

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [eRes, pRes] = await Promise.all([apiGet("getAll"), apiGet("getProjects")]);
      if (eRes.ok) {
        const normalized: Entry[] = (eRes.entries as Entry[]).map(e => {
          const vat = Number(e.vat) || 0;
          const wht = Number(e.wht) || 0;
          const vatType: VatType | undefined = e.vatType
            ? (e.vatType as VatType)
            : (vat > 0 ? (e.type === "income" ? "output" : "input") : undefined);
          const whtType: WhtType | undefined = e.whtType
            ? (e.whtType as WhtType)
            : (wht > 0 ? (e.type === "income" ? "withheld" : "withhold") : undefined);
          return { ...e, amount: Number(e.amount) || 0, vat, wht, vatType, whtType };
        });
        setEntries(normalized);
      }
      if (pRes.ok) setProjects(pRes.projects);
      // load installments from localStorage (migrate older records)
      const saved = localStorage.getItem("wf_installments");
      if (saved) {
        const raw = JSON.parse(saved) as Array<Partial<Installment> & {kind?: InstKind; scope?: InstScope; workCategory?: string}>;
        const list: Installment[] = raw.map(i => ({
          id: i.id ?? Date.now(),
          kind: i.kind || "receivable",
          scope: i.scope || "construction",
          workCategory: i.workCategory || (i.scope === "design" ? WORK_CATS_BY_SCOPE.design[0] : WORK_CATS_BY_SCOPE.construction[0]),
          project: i.project || "",
          name: i.name || "",
          description: i.description,
          amount: typeof i.amount === "number" ? i.amount : Number(i.amount) || 0,
          dueDate: i.dueDate || today(),
          status: i.status || "pending",
          completedDate: i.completedDate,
          invoiceNo: i.invoiceNo,
          receiptNo: i.receiptNo,
          hasVat: i.hasVat,
          hasWht: i.hasWht,
          whtRate: i.whtRate,
        }));
        setInstallments(list);
      }
      // load per-project tax settings (migrate legacy flat shape to per-scope)
      const taxSaved = localStorage.getItem("wf_project_tax");
      if (taxSaved) {
        const parsed = JSON.parse(taxSaved) as Record<string, unknown>;
        const migrated: Record<string, ProjectTaxSettings> = {};
        for (const [k,v] of Object.entries(parsed)) migrated[k] = normalizeTaxSettings(v);
        setProjectTax(migrated);
      }
    } catch { setError("เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-logout when navigating away from the dashboard — PIN required on every entry
  useEffect(() => {
    if (view !== "dashboard" && authenticated) {
      setAuthenticated(false);
      setPinInput("");
      setPinError(null);
    }
  }, [view, authenticated]);

  // Push notification setup
  useEffect(() => {
    if ("Notification" in window) {
      setNotifGranted(Notification.permission === "granted");
    }
  }, []);

  // Check installments and notify, honoring user-configured window
  useEffect(() => {
    if (!notifGranted || !notifEnabled || installments.length === 0) return;
    installments.filter(i => i.status === "pending").forEach(inst => {
      const days = daysUntil(inst.dueDate);
      if (days < 0 || days > alertDaysAhead) return;
      const icon = inst.kind === "payable" ? "💸" : "💰";
      new Notification(`${icon} ครบกำหนด${instLabel(inst.kind)}: ${inst.name}`, {
        body: `โครงการ ${inst.project} — ฿${fmt(inst.amount)} — อีก ${days} วัน (${fmtDate(inst.dueDate)})`,
        icon: "/favicon.ico"
      });
    });
  }, [notifGranted, notifEnabled, alertDaysAhead, installments, fmtDate]);

  async function requestNotifPermission() {
    if (!("Notification" in window)) { showToast("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน", "err"); return; }
    const result = await Notification.requestPermission();
    setNotifGranted(result === "granted");
    showToast(result === "granted" ? "เปิดการแจ้งเตือนแล้ว ✅" : "ไม่ได้รับอนุญาตแจ้งเตือน", result === "granted" ? "ok" : "err");
  }

  function saveInstallments(list: Installment[]) {
    setInstallments(list);
    localStorage.setItem("wf_installments", JSON.stringify(list));
  }

  function addInstallment() {
    if (!instForm.project || !instForm.name || !instForm.amount || !instForm.dueDate || !instForm.workCategory) { showToast("กรอกข้อมูลให้ครบ", "err"); return; }
    const t = getProjectScopeTax(instForm.project, instForm.scope);
    const newInst: Installment = {
      id: Date.now(),
      kind: instForm.kind,
      scope: instForm.scope,
      workCategory: instForm.workCategory,
      project: instForm.project,
      name: instForm.name,
      description: instForm.description.trim() || undefined,
      amount: +instForm.amount,
      dueDate: instForm.dueDate,
      status: "pending",
      hasVat: t.hasVat, hasWht: t.hasWht, whtRate: t.whtRate
    };
    saveInstallments([...installments, newInst]);
    setShowInstForm(false);
    setInstForm({ kind: instForm.kind, scope: instForm.scope, workCategory: WORK_CATS_BY_SCOPE[instForm.scope][0], project: projects[0]||"", name:"งวดที่ 1", description:"", amount:"", dueDate:"" });
    showToast(`เพิ่ม${instLabel(instForm.kind)}แล้ว`);
  }

  function toggleInstallment(inst: Installment) {
    const next: InstStatus = inst.status === "pending" ? instDoneStatus(inst.kind) : "pending";
    saveInstallments(installments.map(i => i.id === inst.id
      ? {...i, status: next, completedDate: next === "pending" ? undefined : today()}
      : i));
  }

  async function handleInvoice(inst: Installment) {
    let invoiceNo = inst.invoiceNo;
    if (!invoiceNo) {
      invoiceNo = nextRunningNumber("6905/", "wf_invoice_counter");
      saveInstallments(installments.map(i => i.id === inst.id ? { ...i, invoiceNo } : i));
    }
    showToast("กำลังสร้างใบวางบิล...");
    try {
      await generateDocPDF("invoice", { docNo: invoiceNo, customerName: inst.project, itemName: inst.name, description: inst.description, amount: inst.amount, hasVat: inst.hasVat, hasWht: inst.hasWht, whtRate: inst.whtRate });
      showToast("สร้างใบวางบิลสำเร็จ");
    } catch (e) { console.error(e); showToast("สร้าง PDF ไม่สำเร็จ", "err"); }
  }

  async function handleReceipt(inst: Installment) {
    let receiptNo = inst.receiptNo;
    if (!receiptNo) {
      receiptNo = nextRunningNumber("RE6905/", "wf_receipt_counter");
      saveInstallments(installments.map(i => i.id === inst.id ? { ...i, receiptNo } : i));
    }
    showToast("กำลังสร้างใบเสร็จ...");
    try {
      await generateDocPDF("receipt", { docNo: receiptNo, customerName: inst.project, itemName: inst.name, description: inst.description, amount: inst.amount, hasVat: inst.hasVat, hasWht: inst.hasWht, whtRate: inst.whtRate });
      showToast("สร้างใบเสร็จสำเร็จ");
    } catch (e) { console.error(e); showToast("สร้าง PDF ไม่สำเร็จ", "err"); }
  }

  function deleteInstallment(id: number) {
    saveInstallments(installments.filter(i => i.id !== id));
    showToast("ลบงวดงานแล้ว", "err");
  }

  function showToast(msg: string, type="ok") { setToast({msg, type}); setTimeout(()=>setToast(null), 2800); }

  function openEdit(e: Entry) { setEditId(e.id); setForm({...e, amount:String(e.amount), useVat:!!e.vat, useWht:!!e.wht}); setShowForm(true); }

  const calcTax = (amount: number, useVat: boolean, useWht: boolean) => ({
    vat: useVat ? amount * VAT_RATE : 0,
    wht: useWht ? amount * WHT_RATE : 0,
  });

  async function saveEntry() {
    if (!form.description.trim() || !form.amount || isNaN(+form.amount) || +form.amount <= 0) { showToast("กรุณากรอกข้อมูลให้ครบ", "err"); return; }
    setSaving(true);
    try {
      const { vat, wht } = calcTax(+form.amount, form.useVat, form.useWht);
      const vatType: VatType | undefined = vat > 0 ? (form.type === "income" ? "output" : "input") : undefined;
      const whtType: WhtType | undefined = wht > 0 ? (form.type === "income" ? "withheld" : "withhold") : undefined;
      // Build body without frontend-only flags (useVat/useWht)
      const body = {
        date: form.date,
        type: form.type,
        category: form.category,
        project: form.project,
        description: form.description,
        amount: +form.amount,
        vat, wht, vatType, whtType,
      };
      if (editId) {
        await apiPost("updateEntry", {...body, id:editId});
        setEntries(es => es.map(e => e.id===editId ? {...body, id:editId} : e));
        showToast("แก้ไขรายการสำเร็จ");
      } else {
        const res = await apiPost("addEntry", body);
        if (res.ok) setEntries(es => [...es, {...body, id:res.id}]);
        showToast("เพิ่มรายการสำเร็จ");
      }
      setShowForm(false);
    } catch { showToast("บันทึกไม่สำเร็จ", "err"); }
    setSaving(false);
  }

  async function doDelete() {
    setSaving(true);
    try { await apiGet("deleteEntry", {id:String(deleteId)}); setEntries(es=>es.filter(e=>e.id!==deleteId)); showToast("ลบรายการแล้ว","err"); }
    catch { showToast("ลบไม่สำเร็จ","err"); }
    setDeleteId(null); setSaving(false);
  }

  async function addProject() {
    if (!newProj.trim() || projects.includes(newProj.trim())) return;
    setSaving(true);
    try { await apiGet("addProject", {name:newProj.trim()}); setProjects(p=>[...p,newProj.trim()]); setNewProj(""); }
    catch { showToast("เพิ่มโครงการไม่สำเร็จ","err"); }
    setSaving(false);
  }

  async function doDeleteProject(p: string) {
    setSaving(true);
    try {
      const projEntries = entries.filter(e=>e.project===p);
      await Promise.all(projEntries.map(e=>apiGet("deleteEntry", { id: String(e.id) })));
      setEntries(es=>es.filter(e=>e.project!==p));
      saveInstallments(installments.filter(i=>i.project!==p));
      await apiGet("deleteProject", { name: p });
      setProjects(ps=>ps.filter(x=>x!==p));
      if (selectedProject===p) setSelectedProject(null);
      showToast(`ลบโครงการ "${p}" แล้ว`, "err");
    } catch { showToast("ลบโครงการไม่สำเร็จ", "err"); }
    setSaving(false);
  }

  // Real cash movement: income = received receivable installments only
  // Expense = paid payable installments + expense entries logged in projects
  const totalIncome = useMemo(()=>installments.filter(i=>i.status==="received").reduce((s,i)=>s+i.amount,0),[installments]);
  const totalExpense = useMemo(()=>{
    const paidInst = installments.filter(i=>i.status==="paid").reduce((s,i)=>s+i.amount,0);
    const expEntries = entries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
    return paidInst + expEntries;
  },[installments, entries]);
  const totalOverhead = useMemo(()=>entries.filter(e=>e.type==="expense"&&isOverhead(e.category)).reduce((s,e)=>s+e.amount,0),[entries]);
  const totalProjectExpense = totalExpense - totalOverhead;
  const overheadPct = totalIncome > 0 ? (totalOverhead/totalIncome)*100 : 0;
  const net = totalIncome - totalExpense;

  // Monthly cash flow with cumulative balance — from real cash movements
  const monthlyCashflow = useMemo(()=>{
    const map: Record<string,{inflow:number,outflow:number}> = {};
    const bucket = (dateStr: string) => {
      const m = String(dateStr).slice(0,7);
      if (!map[m]) map[m] = {inflow:0, outflow:0};
      return map[m];
    };
    installments.forEach(inst=>{
      if (inst.status === "received") bucket(inst.completedDate || inst.dueDate).inflow += inst.amount;
      else if (inst.status === "paid") bucket(inst.completedDate || inst.dueDate).outflow += inst.amount;
    });
    entries.filter(e=>e.type==="expense").forEach(e=>{
      bucket(String(e.date)).outflow += e.amount;
    });
    const list = Object.entries(map).sort(([a],[b])=>a.localeCompare(b));
    let cumulative = 0;
    return list.map(([month,v])=>{
      const n = v.inflow - v.outflow;
      cumulative += n;
      return { month, inflow:v.inflow, outflow:v.outflow, net:n, cumulative };
    });
  },[entries, installments]);

  // Per-month tax remittance: VAT net + WHT to remit to Revenue Department for each month
  const monthlyTax = useMemo(()=>{
    const map: Record<string,{outputVat:number;inputVat:number;whtCredit:number;whtRemit:number}> = {};
    const bucket = (dateStr: string) => {
      const m = String(dateStr).slice(0,7);
      if (!map[m]) map[m] = {outputVat:0,inputVat:0,whtCredit:0,whtRemit:0};
      return map[m];
    };
    installments.forEach(i=>{
      const vat = i.hasVat ? i.amount * VAT_RATE : 0;
      const wht = i.hasWht ? i.amount * ((i.whtRate ?? 3)/100) : 0;
      if (i.status === "received") {
        const b = bucket(i.completedDate || i.dueDate);
        b.outputVat += vat; b.whtCredit += wht;
      } else if (i.status === "paid") {
        const b = bucket(i.completedDate || i.dueDate);
        b.inputVat += vat; b.whtRemit += wht;
      }
    });
    entries.filter(e=>e.type==="expense").forEach(e=>{
      const b = bucket(String(e.date));
      b.inputVat += e.vat || 0;
      b.whtRemit += e.wht || 0;
    });
    return Object.entries(map)
      .map(([month,v])=>{
        const vatNet = v.outputVat - v.inputVat;
        const vatRemit = Math.max(0, vatNet);
        const totalRemit = vatRemit + v.whtRemit;
        return { month, ...v, vatNet, vatRemit, totalRemit };
      })
      .sort((a,b)=>a.month.localeCompare(b.month));
  },[entries, installments]);

  // All-time tax breakdown split by side — derived from real cash movements
  const taxBreakdown = useMemo(()=>{
    let outputVat = 0, inputVat = 0, whtCredit = 0, whtRemit = 0;
    installments.forEach(i=>{
      const vat = i.hasVat ? i.amount * VAT_RATE : 0;
      const wht = i.hasWht ? i.amount * ((i.whtRate ?? 3)/100) : 0;
      if (i.status === "received") { outputVat += vat; whtCredit += wht; }
      else if (i.status === "paid") { inputVat += vat; whtRemit += wht; }
    });
    entries.filter(e=>e.type==="expense").forEach(e=>{
      inputVat += e.vat || 0;
      whtRemit += e.wht || 0;
    });
    return {
      outputVat, inputVat, vatNet: outputVat - inputVat,
      whtCredit, whtRemit, whtNet: whtRemit - whtCredit,
    };
  },[entries, installments]);

  // VAT due based on 15th-of-next-month filing rule (Output - Input for target month)
  const vatDueInfo = useMemo(()=>{
    const now = new Date();
    const day = now.getDate();
    // VAT for month M is filed by 15th of M+1.
    const beforeCutoff = day < 15;
    const targetMonth = beforeCutoff
      ? new Date(now.getFullYear(), now.getMonth()-1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const dueDate = beforeCutoff
      ? new Date(now.getFullYear(), now.getMonth(), 15)
      : new Date(now.getFullYear(), now.getMonth()+1, 15);
    const monthStr = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth()+1).padStart(2,"0")}`;
    let outputVat = 0, inputVat = 0, whtCredit = 0, whtRemit = 0;
    installments.forEach(i=>{
      const dStr = String(i.completedDate || i.dueDate).slice(0,7);
      if (dStr !== monthStr) return;
      const vat = i.hasVat ? i.amount * VAT_RATE : 0;
      const wht = i.hasWht ? i.amount * ((i.whtRate ?? 3)/100) : 0;
      if (i.status === "received") { outputVat += vat; whtCredit += wht; }
      else if (i.status === "paid") { inputVat += vat; whtRemit += wht; }
    });
    entries.filter(e=>e.type==="expense"&&String(e.date).slice(0,7)===monthStr).forEach(e=>{
      inputVat += e.vat || 0;
      whtRemit += e.wht || 0;
    });
    const vatNet = outputVat - inputVat;
    const vatRemit = Math.max(0, vatNet); // negative = refundable, no remit due
    const totalRemit = vatRemit + whtRemit;
    const daysToDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    return { monthStr, dueDate, daysToDue, outputVat, inputVat, vatNet, vatRemit, whtCredit, whtRemit, totalRemit, isDueToday: day===15 };
  },[entries, installments]);

  // Near-due / overdue payables (3-day window)
  const urgentPayables = useMemo(()=>installments.filter(i=>i.kind==="payable"&&i.status==="pending"&&daysUntil(i.dueDate)<=3),[installments]);

  // 3-month cash flow forecast from pending installments (current month + next 2)
  const cashFlowForecast = useMemo(()=>{
    const now = new Date();
    const months: { key:string; label:string; inflow:number; outflow:number }[] = [];
    for (let i=0; i<3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label = d.toLocaleDateString("th-TH",{month:"short",year:"2-digit"});
      months.push({ key, label, inflow:0, outflow:0 });
    }
    installments.filter(i=>i.status==="pending").forEach(inst=>{
      const monthKey = String(inst.dueDate).slice(0,7);
      const m = months.find(x=>x.key===monthKey);
      if (!m) return;
      if (inst.kind==="receivable") m.inflow += inst.amount;
      else m.outflow += inst.amount;
    });
    return months;
  },[installments]);

  // VAT due notification on the 15th
  useEffect(() => {
    if (!notifGranted || !notifEnabled) return;
    if (!vatDueInfo.isDueToday || vatDueInfo.totalRemit <= 0) return;
    new Notification("🧾 วันนี้ครบกำหนดยื่นภาษี", {
      body: `เดือน ${vatDueInfo.monthStr} — นำส่ง VAT ฿${fmt(vatDueInfo.vatRemit)} + WHT ฿${fmt(vatDueInfo.whtRemit)} = ฿${fmt(vatDueInfo.totalRemit)}`,
      icon: "/favicon.ico"
    });
  }, [notifGranted, notifEnabled, vatDueInfo]);

  const cats = form.type==="income"?CATS_IN:CATS_EX;

  const pendingInst = installments.filter(i=>i.status==="pending");
  const urgentInst = pendingInst.filter(i=>daysUntil(i.dueDate)<=alertDaysAhead&&daysUntil(i.dueDate)>=0);

  if (loading) return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'Sarabun',sans-serif",color:"#aaa",gap:14 }}>
      <div style={{ width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#1565c0",borderRadius:"50%",animation:"spin .8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      กำลังโหลดข้อมูล...
    </div>
  );

  if (error) return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'Sarabun',sans-serif",gap:16,padding:24 }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ color:"#c62828",fontWeight:700,fontSize:16 }}>{error}</div>
      <button onClick={loadAll} style={{ background:"#1565c0",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer" }}>ลองใหม่</button>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",background:"#f4f6fb",minHeight:"100vh",color:"#1a1a2e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .card{background:#fff;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,.06),0 4px 18px rgba(0,0,0,.04)}
        .btn{border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:600;transition:all .15s;font-size:14px;-webkit-tap-highlight-color:transparent}
        .btn:active{transform:scale(.96)}
        .btn-primary{background:#1565c0;color:#fff;padding:12px 22px}.btn-primary:hover{background:#1976d2}
        .btn-green{background:#2e7d32;color:#fff;padding:12px 22px}.btn-green:hover{background:#388e3c}
        .btn-red{background:#c62828;color:#fff;padding:10px 16px;font-size:13px}.btn-red:hover{background:#d32f2f}
        .btn-ghost{background:transparent;border:1.5px solid #ddd;color:#666;padding:10px 16px;font-size:13px}.btn-ghost:hover{border-color:#999;color:#333}
        .btn-outline{background:transparent;border:1.5px solid #1565c0;color:#1565c0;padding:10px 16px;font-size:13px}
        .btn-orange{background:#e65100;color:#fff;padding:10px 16px;font-size:13px}.btn-orange:hover{background:#f57c00}
        input,select,textarea{background:#f8f9ff;border:1.5px solid #e0e4f0;border-radius:10px;color:#1a1a2e;font-family:inherit;padding:12px 14px;width:100%;font-size:16px;outline:none;transition:border-color .15s;-webkit-appearance:none}
        input:focus,select:focus{border-color:#1565c0;background:#fff}
        .badge{display:inline-block;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700}
        .badge-income{background:#e8f5e9;color:#2e7d32}.badge-expense{background:#ffebee;color:#c62828}
        .badge-pending{background:#fff3e0;color:#e65100}.badge-received{background:#e8f5e9;color:#2e7d32}
        .tag{font-size:11px;background:#eff1ff;color:#3949ab;padding:3px 9px;border-radius:6px;font-weight:600}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;z-index:200}
        .modal{background:#fff;border-radius:20px 20px 0 0;padding:28px 24px 40px;width:100%;max-width:600px;box-shadow:0 -8px 40px rgba(0,0,0,.12);max-height:92vh;overflow-y:auto}
        .toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:50px;font-size:14px;font-weight:600;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,.15);animation:slideUp .25s ease;white-space:nowrap}
        @keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .stitle{font-size:11px;font-weight:700;color:#bbb;letter-spacing:.09em;text-transform:uppercase;margin-bottom:14px}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #eee;display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom)}
        .bnav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 4px;border:none;background:none;cursor:pointer;font-family:inherit;color:#aaa;font-size:10px;gap:3px;-webkit-tap-highlight-color:transparent;transition:color .15s}
        .bnav-btn.active{color:#1565c0}
        .bnav-btn span{font-size:20px}
        .fab{position:fixed;bottom:72px;right:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#2e7d32,#43a047);color:#fff;border:none;font-size:28px;cursor:pointer;box-shadow:0 4px 16px rgba(46,125,50,.4);display:flex;align-items:center;justify-content:center;z-index:101;-webkit-tap-highlight-color:transparent}
        .fab:active{transform:scale(.92)}
        .urgent-badge{background:#ffebee;color:#c62828;border:1px solid #ef9a9a;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:8px}
        .checkbox-row{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8f9ff;border-radius:10px;border:1.5px solid #e0e4f0}
        .checkbox-row input[type=checkbox]{width:20px;height:20px;accent-color:#1565c0;cursor:pointer}
      `}</style>

      {/* HEADER */}
      <div style={{ background:"#fff",borderBottom:"1px solid #eee",position:"sticky",top:0,zIndex:100 }}>
        <div style={{ maxWidth:900,margin:"0 auto",padding:"0 16px" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",height:64 }}>
            <div style={{ display:"flex",alignItems:"center",gap:12 }}>
              <img src="/logo-cropped.jpg" alt="Wadfun" style={{ height:36,width:"auto",display:"block" }}/>
              <div style={{ borderLeft:"1px solid #eee",paddingLeft:12 }}>
                <div style={{ fontWeight:700,fontSize:13,color:"#1a1a2e" }}>Finance</div>
                <div style={{ fontSize:10,color:"#bbb" }}>ระบบบัญชีรายรับ-รายจ่าย</div>
              </div>
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <button className="btn btn-ghost" style={{ fontSize:13,padding:"6px 10px",position:"relative" }} onClick={()=>setShowNotifPopup(true)}>
                🔔{urgentInst.length>0&&<span style={{ position:"absolute",top:-2,right:-2,background:"#c62828",color:"#fff",borderRadius:50,minWidth:16,height:16,padding:"0 4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700 }}>{urgentInst.length}</span>}
              </button>
              <button className="btn btn-ghost" style={{ fontSize:12,padding:"8px 12px" }} onClick={loadAll}>🔄</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900,margin:"0 auto",padding:"20px 16px 140px" }}>

        {/* DASHBOARD — PIN required for CEO access */}
        {view==="dashboard"&&!authenticated&&(
          <div className="card" style={{ padding:"36px 24px",maxWidth:420,margin:"40px auto",textAlign:"center" }}>
            <img src="/logo-cropped.jpg" alt="Wadfun" style={{ height:40,width:"auto",display:"block",margin:"0 auto 14px" }}/>
            <div style={{ fontSize:30,marginBottom:6 }}>🔒</div>
            <div style={{ fontWeight:800,fontSize:17,marginBottom:6 }}>หน้าภาพรวม — เฉพาะ CEO</div>
            <div style={{ fontSize:12,color:"#888",marginBottom:22 }}>กรอก PIN เพื่อดูข้อมูลสรุปและภาษี</div>
            <form onSubmit={async (e)=>{
              e.preventDefault();
              const ok = await verifyPin(pinInput);
              if (ok) { setAuthenticated(true); setPinInput(""); setPinError(null); }
              else { setPinError("PIN ไม่ถูกต้อง"); setPinInput(""); }
            }}>
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                placeholder="• • • •"
                value={pinInput}
                onChange={e=>{ setPinInput(e.target.value.replace(/\D/g,"")); setPinError(null); }}
                style={{ width:"100%",padding:"16px 18px",fontSize:24,letterSpacing:"0.4em",textAlign:"center",border:`2px solid ${pinError?"#c62828":"#e0e4f0"}`,borderRadius:14,outline:"none",fontFamily:"inherit",background:"#f8f9ff" }}
              />
              {pinError&&<div style={{ color:"#c62828",fontSize:13,marginTop:10,fontWeight:600 }}>⚠️ {pinError}</div>}
              <button type="submit" disabled={pinInput.length<4} style={{ width:"100%",marginTop:16,padding:14,fontSize:15,fontWeight:700,fontFamily:"inherit",background:pinInput.length<4?"#bbb":"#1565c0",color:"#fff",border:"none",borderRadius:12,cursor:pinInput.length<4?"not-allowed":"pointer" }}>ดูหน้าภาพรวม</button>
            </form>
            <div style={{ marginTop:16,fontSize:11,color:"#aaa" }}>คุณสามารถดูแท็บอื่นได้โดยไม่ต้องใส่ PIN</div>
          </div>
        )}

        {/* DASHBOARD */}
        {view==="dashboard"&&authenticated&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            {/* Google Sheet setup notice */}
            {!sheetSetupDismissed&&(
              <div style={{ background:"#fffde7",border:"1.5px solid #fff59d",borderRadius:14,padding:"14px 16px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8 }}>
                  <div style={{ fontWeight:700,fontSize:13,color:"#827717" }}>⚙️ ตั้งค่า Google Sheet ก่อนใช้งานจริง</div>
                  <button onClick={dismissSheetSetup} aria-label="ปิด" style={{ width:24,height:24,borderRadius:"50%",border:"none",background:"#f0e68c",fontSize:13,fontWeight:700,cursor:"pointer",color:"#666",lineHeight:1 }}>✕</button>
                </div>
                <div style={{ fontSize:12,color:"#5d4037",marginBottom:8 }}>
                  เพื่อให้ VAT / WHT บันทึกถาวร เพิ่ม column ในชีต <b>Entries</b> ดังนี้:
                </div>
                <div style={{ fontFamily:"monospace",fontSize:12,background:"#fff8e1",borderRadius:8,padding:"8px 10px",marginBottom:8 }}>
                  H = vat<br/>
                  I = wht<br/>
                  J = vatType  <span style={{ color:"#888" }}>(output / input)</span><br/>
                  K = whtType  <span style={{ color:"#888" }}>(withheld / withhold)</span>
                </div>
                <div style={{ fontSize:11,color:"#777" }}>
                  ดูตัวอย่าง backend ที่ <b>Code.gs</b> ใน repo — copy ไปแทนใน Apps Script แล้ว Deploy เวอร์ชันใหม่
                </div>
              </div>
            )}

            {/* Urgent installments alert */}
            {urgentInst.length>0&&(
              <div style={{ background:"#fff3e0",border:"1.5px solid #ffb74d",borderRadius:14,padding:"14px 16px" }}>
                <div style={{ fontWeight:700,fontSize:13,color:"#e65100",marginBottom:8 }}>⚠️ งวดที่ใกล้ครบกำหนด ({urgentInst.length} งวด)</div>
                {urgentInst.map(i=>(
                  <div key={i.id} style={{ fontSize:13,color:"#bf360c",marginBottom:4 }}>
                    <span style={{ fontWeight:700,color:i.kind==="payable"?"#c62828":"#2e7d32" }}>[{instLabel(i.kind)}]</span> {i.name} — {i.project} — ฿{fmt(i.amount)} — อีก {daysUntil(i.dueDate)} วัน ({fmtDate(i.dueDate)})
                  </div>
                ))}
              </div>
            )}

            {/* VAT due alert */}
            {(vatDueInfo.totalRemit>0||vatDueInfo.vatNet<0)&&(
              <div style={{ background:vatDueInfo.isDueToday?"#ffebee":vatDueInfo.daysToDue<=3?"#fff3e0":"#e3f2fd",border:`1.5px solid ${vatDueInfo.isDueToday?"#ef9a9a":vatDueInfo.daysToDue<=3?"#ffb74d":"#90caf9"}`,borderRadius:14,padding:"12px 16px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10 }}>
                  <div style={{ minWidth:0,flex:1 }}>
                    <div style={{ fontWeight:700,fontSize:13,color:vatDueInfo.isDueToday?"#c62828":vatDueInfo.daysToDue<=3?"#e65100":"#0d47a1" }}>
                      🧾 {vatDueInfo.isDueToday?"วันนี้ครบกำหนดยื่นภาษี!":`ครบกำหนดยื่นภาษี ใน ${vatDueInfo.daysToDue} วัน`}
                    </div>
                    <div style={{ fontSize:11,color:"#666",marginTop:3 }}>เดือน {vatDueInfo.monthStr} · กำหนดยื่น {fmtDate(vatDueInfo.dueDate.toISOString().slice(0,10))}</div>
                    <div style={{ fontSize:11,color:"#666",marginTop:4 }}>VAT สุทธิ {vatDueInfo.vatNet>=0?"+":""}฿{fmt(vatDueInfo.vatNet)} · WHT นำส่ง ฿{fmt(vatDueInfo.whtRemit)}</div>
                  </div>
                  <div style={{ textAlign:"right",whiteSpace:"nowrap" }}>
                    <div style={{ fontSize:10,color:"#888",fontWeight:600 }}>นำส่ง</div>
                    <div style={{ fontSize:18,fontWeight:800,color:"#e65100" }}>฿{fmt(vatDueInfo.totalRemit)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Stat cards */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              {[{l:"รายรับรวม",v:totalIncome,c:"#2e7d32",bg:"#e8f5e9",i:"💰"},{l:"รายจ่ายรวม",v:totalExpense,c:"#c62828",bg:"#ffebee",i:"💸"}].map(x=>(
                <div key={x.l} className="card" style={{ padding:16,background:x.bg,border:"none" }}>
                  <div style={{ fontSize:18,marginBottom:6 }}>{x.i}</div>
                  <div style={{ fontSize:11,color:"#777",marginBottom:3 }}>{x.l}</div>
                  <div style={{ fontSize:18,fontWeight:800,color:x.c }}>฿{fmt(x.v)}</div>
                </div>
              ))}
            </div>

            {/* Expense breakdown: project vs overhead */}
            <div className="card" style={{ padding:16 }}>
              <div className="stitle" style={{ marginBottom:12 }}>ค่าใช้จ่ายแยกประเภท</div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div style={{ background:"#fce4ec",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:11,color:"#880e4f",marginBottom:3,fontWeight:600 }}>🏗️ ค่าโครงการ</div>
                  <div style={{ fontSize:16,fontWeight:800,color:"#880e4f" }}>฿{fmt(totalProjectExpense)}</div>
                  <div style={{ fontSize:10,color:"#aaa",marginTop:2 }}>{totalExpense>0?((totalProjectExpense/totalExpense)*100).toFixed(1):"0.0"}% ของรายจ่ายรวม</div>
                </div>
                <div style={{ background:"#ede7f6",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:11,color:"#4527a0",marginBottom:3,fontWeight:600 }}>🏢 Overhead</div>
                  <div style={{ fontSize:16,fontWeight:800,color:"#4527a0" }}>฿{fmt(totalOverhead)}</div>
                  <div style={{ fontSize:10,color:"#aaa",marginTop:2 }}>{overheadPct.toFixed(2)}% ของรายรับ</div>
                </div>
              </div>
              {overheadPct>30&&totalIncome>0&&(
                <div style={{ marginTop:10,fontSize:11,color:"#c62828",fontWeight:600 }}>⚠️ Overhead สูงเกิน 30% ของรายรับ</div>
              )}
            </div>

            <div className="card" style={{ padding:16,background:net>=0?"linear-gradient(135deg,#e8eaf6,#f3f4ff)":"linear-gradient(135deg,#ffebee,#fce4ec)",border:"none" }}>
              <div style={{ fontSize:12,color:"#777",marginBottom:4 }}>📈 กำไรสุทธิ</div>
              <div style={{ fontSize:26,fontWeight:800,color:net>=0?"#1565c0":"#c62828" }}>฿{fmt(Math.abs(net))}</div>
              <div style={{ fontSize:12,color:net>=0?"#2e7d32":"#c62828",marginTop:4,fontWeight:600 }}>{net>=0?"▲ กำไร":"▼ ขาดทุน"}</div>
            </div>

            {/* P&L per project */}
            <div className="card" style={{ padding:20 }}>
              <div className="stitle">📊 กำไรขาดทุนต่อโครงการ</div>
              <div style={{ fontSize:11,color:"#aaa",marginTop:-8,marginBottom:14 }}>คำนวณจากงวดเบิก/งวดจ่ายที่รับ/จ่ายเงินแล้ว</div>
              {projects.length===0 ? (
                <div style={{ color:"#bbb",textAlign:"center",padding:"24px 0",fontSize:14 }}>ยังไม่มีโครงการ</div>
              ) : (()=>{
                const rows = projects.map(p=>{
                  const projInst = installments.filter(i=>i.project===p);
                  const projExpEntries = entries.filter(e=>e.project===p&&e.type==="expense");
                  const designInc = projInst.filter(i=>i.scope==="design"&&i.kind==="receivable"&&i.status==="received").reduce((s,i)=>s+i.amount,0);
                  const designExp = projInst.filter(i=>i.scope==="design"&&i.kind==="payable"&&i.status==="paid").reduce((s,i)=>s+i.amount,0);
                  const constInc = projInst.filter(i=>i.scope==="construction"&&i.kind==="receivable"&&i.status==="received").reduce((s,i)=>s+i.amount,0);
                  const constExp = projInst.filter(i=>i.scope==="construction"&&i.kind==="payable"&&i.status==="paid").reduce((s,i)=>s+i.amount,0);
                  const legacyExp = projExpEntries.reduce((s,e)=>s+e.amount,0);
                  const inc = designInc + constInc;
                  const exp = designExp + constExp + legacyExp;
                  const n = inc - exp;
                  const m = inc>0 ? (n/inc)*100 : 0;
                  return { p, inc, exp, n, m, designInc, designExp, designNet: designInc-designExp, constInc, constExp, constNet: constInc-constExp };
                }).filter(r=>r.inc>0||r.exp>0)
                  .sort((a,b)=>b.n - a.n);
                if (rows.length===0) return <div style={{ color:"#bbb",textAlign:"center",padding:"24px 0",fontSize:14 }}>ยังไม่มีงวดที่รับ/จ่ายแล้ว</div>;
                return (
                  <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                    {rows.map(r=>(
                      <div key={r.p} style={{ borderLeft:`4px solid ${r.n>=0?"#2e7d32":"#c62828"}`,background:r.n>=0?"#f8fff8":"#fff5f5",borderRadius:10,padding:"12px 14px" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10 }}>
                          <span style={{ fontWeight:800,fontSize:15 }}>📁 {r.p}</span>
                          <span style={{ fontWeight:800,fontSize:17,color:r.n>=0?"#2e7d32":"#c62828",whiteSpace:"nowrap" }}>{r.n>=0?"+":"-"}฿{fmt(Math.abs(r.n))}</span>
                        </div>
                        <div style={{ display:"flex",gap:14,marginTop:6,fontSize:12,flexWrap:"wrap" }}>
                          <span style={{ color:"#2e7d32" }}>↑ รับ ฿{fmt(r.inc)}</span>
                          <span style={{ color:"#c62828" }}>↓ จ่าย ฿{fmt(r.exp)}</span>
                          <span style={{ color:"#888",marginLeft:"auto" }}>Margin <b style={{ color:r.m>=0?"#2e7d32":"#c62828" }}>{r.m.toFixed(1)}%</b></span>
                        </div>
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10 }}>
                          <div style={{ background:"#fff",borderRadius:8,padding:"8px 10px",border:"1px solid #eef0f8" }}>
                            <div style={{ fontSize:10,color:"#888",marginBottom:2,fontWeight:600 }}>✏️ งานออกแบบ</div>
                            <div style={{ fontWeight:700,fontSize:13,color:r.designNet>=0?"#2e7d32":"#c62828" }}>{r.designNet>=0?"+":"-"}฿{fmt(Math.abs(r.designNet))}</div>
                            <div style={{ fontSize:10,color:"#aaa",marginTop:1 }}>รับ {fmt(r.designInc)} · จ่าย {fmt(r.designExp)}</div>
                          </div>
                          <div style={{ background:"#fff",borderRadius:8,padding:"8px 10px",border:"1px solid #eef0f8" }}>
                            <div style={{ fontSize:10,color:"#888",marginBottom:2,fontWeight:600 }}>🏗️ งานก่อสร้าง</div>
                            <div style={{ fontWeight:700,fontSize:13,color:r.constNet>=0?"#2e7d32":"#c62828" }}>{r.constNet>=0?"+":"-"}฿{fmt(Math.abs(r.constNet))}</div>
                            <div style={{ fontSize:10,color:"#aaa",marginTop:1 }}>รับ {fmt(r.constInc)} · จ่าย {fmt(r.constExp)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ background:"linear-gradient(90deg,#eff3fb,#f8f9ff)",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4 }}>
                      <span style={{ fontSize:13,fontWeight:700,color:"#666" }}>รวมทุกโครงการ</span>
                      <span style={{ fontSize:16,fontWeight:800,color:rows.reduce((s,r)=>s+r.n,0)>=0?"#1565c0":"#c62828" }}>
                        {rows.reduce((s,r)=>s+r.n,0)>=0?"+":"-"}฿{fmt(Math.abs(rows.reduce((s,r)=>s+r.n,0)))}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Tax summary card */}
            <div className="card" style={{ padding:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <div className="stitle" style={{ margin:0 }}>สรุปภาษี (สะสม)</div>
                <button className="btn btn-ghost" style={{ fontSize:12,padding:"6px 10px" }} onClick={()=>setShowTaxSummary(true)}>ดูรายละเอียด</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div style={{ background:"#e3f2fd",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:10,color:"#0d47a1",marginBottom:3,fontWeight:700 }}>Output VAT (ขาย)</div>
                  <div style={{ fontSize:15,fontWeight:800,color:"#0d47a1" }}>฿{fmt(taxBreakdown.outputVat)}</div>
                </div>
                <div style={{ background:"#fff3e0",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:10,color:"#e65100",marginBottom:3,fontWeight:700 }}>Input VAT (ซื้อ)</div>
                  <div style={{ fontSize:15,fontWeight:800,color:"#e65100" }}>฿{fmt(taxBreakdown.inputVat)}</div>
                </div>
                <div style={{ background:"#ede7f6",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:10,color:"#4527a0",marginBottom:3,fontWeight:700 }}>WHT ถูกหัก (เครดิต)</div>
                  <div style={{ fontSize:15,fontWeight:800,color:"#4527a0" }}>฿{fmt(taxBreakdown.whtCredit)}</div>
                </div>
                <div style={{ background:"#fce4ec",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:10,color:"#c62828",marginBottom:3,fontWeight:700 }}>WHT หักจ่าย (นำส่ง)</div>
                  <div style={{ fontSize:15,fontWeight:800,color:"#c62828" }}>฿{fmt(taxBreakdown.whtRemit)}</div>
                </div>
              </div>
              <div style={{ marginTop:10,padding:"10px 12px",background:taxBreakdown.vatNet>=0?"#fff8e1":"#e8f5e9",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:12,fontWeight:700,color:taxBreakdown.vatNet>=0?"#827717":"#1b5e20" }}>VAT สุทธิ (Output - Input)</span>
                <span style={{ fontSize:15,fontWeight:800,color:taxBreakdown.vatNet>=0?"#e65100":"#1b5e20" }}>
                  {taxBreakdown.vatNet>=0?`฿${fmt(taxBreakdown.vatNet)}`:`ขอคืน ฿${fmt(-taxBreakdown.vatNet)}`}
                </span>
              </div>
            </div>

            {/* Monthly tax remittance to Revenue Department */}
            <div className="card" style={{ padding:20 }}>
              <div className="stitle">🧾 ภาษีต้องนำส่งสรรพากร (รายเดือน)</div>
              <div style={{ fontSize:11,color:"#aaa",marginTop:-8,marginBottom:12 }}>VAT สุทธิ (Output - Input) + WHT นำส่ง · คำนวณจากงวดที่รับ/จ่ายแล้ว</div>
              {monthlyTax.length===0?(
                <div style={{ color:"#bbb",fontSize:13,textAlign:"center",padding:"16px 0" }}>ยังไม่มีรายการ</div>
              ):(
                <div style={{ overflowX:"auto",marginTop:6 }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:620 }}>
                    <thead>
                      <tr style={{ borderBottom:"2px solid #e0e4f0" }}>
                        <th style={{ textAlign:"left",padding:"8px 6px",color:"#888",fontSize:11,fontWeight:700 }}>เดือน</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#0d47a1",fontSize:11,fontWeight:700 }}>Output VAT</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#e65100",fontSize:11,fontWeight:700 }}>Input VAT</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#888",fontSize:11,fontWeight:700 }}>VAT สุทธิ</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#c62828",fontSize:11,fontWeight:700 }}>WHT นำส่ง</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#b71c1c",fontSize:11,fontWeight:800 }}>รวมนำส่ง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyTax.slice(-12).map(r=>{
                        const [y,m] = r.month.split("-");
                        const label = new Date(+y,+m-1).toLocaleDateString("th-TH",{month:"short",year:"2-digit"});
                        const vatNeg = r.vatNet < 0;
                        const hasRemit = r.totalRemit > 0;
                        return (
                          <tr key={r.month} style={{ background:hasRemit?"#fff8e1":"transparent",borderBottom:"1px solid #f5f5f5" }}>
                            <td style={{ padding:"10px 6px",fontWeight:600 }}>{label}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",color:"#0d47a1",fontWeight:600 }}>฿{fmt(r.outputVat)}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",color:"#e65100",fontWeight:600 }}>฿{fmt(r.inputVat)}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:700,color:vatNeg?"#1b5e20":r.vatNet>0?"#bf360c":"#999" }}>
                              {vatNeg?`ขอคืน ฿${fmt(-r.vatNet)}`:`฿${fmt(r.vatNet)}`}
                            </td>
                            <td style={{ padding:"10px 6px",textAlign:"right",color:"#c62828",fontWeight:600 }}>฿{fmt(r.whtRemit)}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:800,color:hasRemit?"#b71c1c":"#999",whiteSpace:"nowrap" }}>
                              ฿{fmt(r.totalRemit)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop:"2px solid #e0e4f0",background:"#f5f9ff" }}>
                        <td style={{ padding:"10px 6px",fontWeight:700,fontSize:11,color:"#666" }}>รวม</td>
                        <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:800,color:"#0d47a1" }}>฿{fmt(monthlyTax.reduce((s,r)=>s+r.outputVat,0))}</td>
                        <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:800,color:"#e65100" }}>฿{fmt(monthlyTax.reduce((s,r)=>s+r.inputVat,0))}</td>
                        <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:800,color:"#666" }}>฿{fmt(monthlyTax.reduce((s,r)=>s+r.vatNet,0))}</td>
                        <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:800,color:"#c62828" }}>฿{fmt(monthlyTax.reduce((s,r)=>s+r.whtRemit,0))}</td>
                        <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:800,color:"#b71c1c",whiteSpace:"nowrap" }}>฿{fmt(monthlyTax.reduce((s,r)=>s+r.totalRemit,0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <div style={{ marginTop:10,fontSize:11,color:"#777",lineHeight:1.5 }}>
                • <b>VAT สุทธิ</b> = Output VAT - Input VAT (ถ้าบวก = นำส่ง, ถ้าลบ = ขอคืน/เครดิตเดือนถัดไป)<br/>
                • <b>WHT นำส่ง</b> = ภาษีหัก ณ ที่จ่าย ที่หักผู้รับเงิน ต้องนำส่งสรรพากรภายในวันที่ 7 เดือนถัดไป<br/>
                • <b>รวมนำส่ง</b> = ยอดที่ต้องโอนให้สรรพากรเดือนนั้น (กำหนดยื่น VAT วันที่ 15 ของเดือนถัดไป)
              </div>
            </div>

            <div className="card" style={{ padding:20 }}>
              <div className="stitle">สัดส่วนรายรับ-รายจ่าย</div>
              <Donut income={totalIncome} expense={totalExpense}/>
            </div>

            {/* Cash Flow table — historical from entries */}
            <div className="card" style={{ padding:20 }}>
              <div className="stitle">💧 กระแสเงินสดรายเดือน (ย้อนหลัง)</div>
              <div style={{ fontSize:11,color:"#aaa",marginTop:-8,marginBottom:12 }}>ข้อมูลจริงจากรายการรายรับ-รายจ่าย</div>
              {monthlyCashflow.length===0?(
                <div style={{ color:"#bbb",fontSize:13,textAlign:"center",padding:"16px 0" }}>ยังไม่มีข้อมูล</div>
              ):(
                <div style={{ overflowX:"auto",marginTop:6 }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:480 }}>
                    <thead>
                      <tr style={{ borderBottom:"2px solid #e0e4f0" }}>
                        <th style={{ textAlign:"left",padding:"8px 6px",color:"#888",fontSize:11,fontWeight:700 }}>เดือน</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#2e7d32",fontSize:11,fontWeight:700 }}>เงินเข้า</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#c62828",fontSize:11,fontWeight:700 }}>เงินออก</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#888",fontSize:11,fontWeight:700 }}>สุทธิ</th>
                        <th style={{ textAlign:"right",padding:"8px 6px",color:"#888",fontSize:11,fontWeight:700 }}>คงเหลือสะสม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyCashflow.slice(-12).map(r=>{
                        const [y,m] = r.month.split("-");
                        const label = new Date(+y,+m-1).toLocaleDateString("th-TH",{month:"short",year:"2-digit"});
                        const negRow = r.net<0;
                        return (
                          <tr key={r.month} style={{ background:negRow?"#ffebee":"transparent",borderBottom:"1px solid #f5f5f5" }}>
                            <td style={{ padding:"10px 6px",fontWeight:600 }}>{label}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",color:"#2e7d32",fontWeight:600 }}>+฿{fmt(r.inflow)}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",color:"#c62828",fontWeight:600 }}>-฿{fmt(r.outflow)}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:800,color:negRow?"#c62828":"#2e7d32" }}>{negRow?"":"+"}฿{fmt(r.net)}</td>
                            <td style={{ padding:"10px 6px",textAlign:"right",fontWeight:700,color:r.cumulative<0?"#c62828":"#1565c0" }}>฿{fmt(r.cumulative)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {monthlyCashflow.some(r=>r.net<0)&&(
                <div style={{ marginTop:8,fontSize:11,color:"#c62828",fontWeight:600 }}>⚠️ มีเดือนที่เงินติดลบ — ตรวจสอบการบริหารกระแสเงินสด</div>
              )}
            </div>

            {/* Cash Flow Forecast — 3 months ahead from pending installments */}
            <div className="card" style={{ padding:20 }}>
              <div className="stitle">🔮 Cash Flow Forecast (3 เดือนข้างหน้า)</div>
              <div style={{ fontSize:11,color:"#aaa",marginTop:-8,marginBottom:12 }}>คาดการณ์จากงวดเบิก/งวดจ่ายที่ยังค้าง</div>
              {(()=>{
                const totalIn = cashFlowForecast.reduce((s,m)=>s+m.inflow,0);
                const totalOut = cashFlowForecast.reduce((s,m)=>s+m.outflow,0);
                if (totalIn===0&&totalOut===0) return (
                  <div style={{ color:"#bbb",fontSize:13,textAlign:"center",padding:"20px 0" }}>ยังไม่มีงวดค้างใน 3 เดือนข้างหน้า</div>
                );
                let running = 0;
                return (
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    {cashFlowForecast.map(m=>{
                      const net = m.inflow - m.outflow;
                      running += net;
                      const isNeg = net < 0;
                      return (
                        <div key={m.key} style={{ background:isNeg?"#ffebee":"#f5f9ff",border:`1.5px solid ${isNeg?"#ef9a9a":"#cdd9f0"}`,borderRadius:12,padding:"12px 14px" }}>
                          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                            <span style={{ fontWeight:800,fontSize:14,color:isNeg?"#c62828":"#1565c0" }}>{m.label}</span>
                            <span style={{ fontSize:12,color:"#888" }}>สะสม <b style={{ color:running<0?"#c62828":"#1565c0" }}>฿{fmt(running)}</b></span>
                          </div>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12 }}>
                            <div>
                              <div style={{ color:"#777",fontSize:10 }}>คาดรับ</div>
                              <div style={{ fontWeight:700,color:"#2e7d32" }}>+฿{fmt(m.inflow)}</div>
                            </div>
                            <div>
                              <div style={{ color:"#777",fontSize:10 }}>คาดจ่าย</div>
                              <div style={{ fontWeight:700,color:"#c62828" }}>-฿{fmt(m.outflow)}</div>
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ color:"#777",fontSize:10 }}>สุทธิ</div>
                              <div style={{ fontWeight:800,color:isNeg?"#c62828":"#2e7d32" }}>{isNeg?"":"+"}฿{fmt(net)}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {cashFlowForecast.some(m=>m.inflow-m.outflow<0)&&(
                      <div style={{ fontSize:11,color:"#c62828",fontWeight:600,marginTop:2 }}>⚠️ มีเดือนที่คาดว่าเงินติดลบ — เตรียมกระแสเงินสด</div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="card" style={{ padding:20 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <div className="stitle" style={{ margin:0 }}>รายการล่าสุด</div>
                <span style={{ fontSize:11,color:"#aaa" }}>จากงวดที่รับ/จ่ายเงินแล้ว</span>
              </div>
              {(()=>{
                const completed = installments
                  .filter(i=>i.status!=="pending")
                  .map(i=>({ ...i, sortDate: i.completedDate || i.dueDate }))
                  .sort((a,b)=>String(b.sortDate).localeCompare(String(a.sortDate)))
                  .slice(0,10);
                if (completed.length===0) return <div style={{ textAlign:"center",color:"#ccc",padding:"32px 0",fontSize:14 }}>ยังไม่มีงวดที่รับ/จ่ายแล้ว</div>;
                return completed.map((inst,i)=>{
                  const isRecv = inst.kind==="receivable";
                  return (
                    <div key={inst.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderBottom:i<completed.length-1?"1px solid #f5f5f5":"none" }}>
                      <div style={{ width:34,height:34,borderRadius:10,background:isRecv?"#e8f5e9":"#ffebee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0 }}>{isRecv?"↑":"↓"}</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{inst.name}</div>
                        <div style={{ fontSize:11,color:"#bbb",marginTop:2 }}>📁 {inst.project} · {fmtDate(String(inst.sortDate).slice(0,10))}</div>
                      </div>
                      <div style={{ textAlign:"right",flexShrink:0 }}>
                        <div style={{ fontWeight:800,fontSize:14,color:isRecv?"#2e7d32":"#c62828" }}>{isRecv?"+":"-"}฿{fmt(inst.amount)}</div>
                        <div style={{ fontSize:10,color:"#aaa" }}>{isRecv?"รับเงินแล้ว":"จ่ายเงินแล้ว"}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* PROJECT VIEW (with P&L + installments) */}
        {view==="installments"&&(()=>{
          const proj = selectedProject && projects.includes(selectedProject) ? selectedProject : (projects[0] || "");
          if (!proj) return (
            <div className="card" style={{ padding:24,textAlign:"center" }}>
              <div style={{ fontSize:14,color:"#999",marginBottom:14 }}>ยังไม่มีโครงการ</div>
              <button className="btn btn-green" onClick={()=>setShowProjMgr(true)} style={{ padding:"10px 18px" }}>+ เพิ่มโครงการ</button>
            </div>
          );
          const projInstAll = installments.filter(i=>i.project===proj);
          // Filter by active scope (งานออกแบบ / งานก่อสร้าง)
          const projInst = projInstAll.filter(i=>i.scope===activeScope);
          // P&L: real cash movement — per scope (installments only)
          const pIncome = projInst.filter(i=>i.kind==="receivable"&&i.status==="received").reduce((s,i)=>s+i.amount,0);
          const pExpense = projInst.filter(i=>i.kind==="payable"&&i.status==="paid").reduce((s,i)=>s+i.amount,0);
          const pNet = pIncome - pExpense;
          const tabList = projInst.filter(i=>i.kind===instTab).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
          const tabPending = tabList.filter(i=>i.status==="pending");
          const tabDone = tabList.filter(i=>i.status!=="pending");
          const tabPendingTotal = tabPending.reduce((s,i)=>s+i.amount,0);
          const tabDoneTotal = tabDone.reduce((s,i)=>s+i.amount,0);
          const recvPending = projInst.filter(i=>i.kind==="receivable"&&i.status==="pending").reduce((s,i)=>s+i.amount,0);
          const payPending = projInst.filter(i=>i.kind==="payable"&&i.status==="pending").reduce((s,i)=>s+i.amount,0);
          const projectedNet = pNet + recvPending - payPending;
          const isRecv = instTab==="receivable";
          const accent = isRecv ? "#2e7d32" : "#c62828";
          const accentBg = isRecv ? "#e8f5e9" : "#ffebee";
          const scopeWorkCats = WORK_CATS_BY_SCOPE[activeScope];
          return (
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              {/* Project selector */}
              <div className="card" style={{ padding:14 }}>
                <label style={{ fontSize:11,color:"#aaa",fontWeight:700,display:"block",marginBottom:6,letterSpacing:".06em" }}>โครงการที่ต้องการดู</label>
                <select value={proj} onChange={e=>setSelectedProject(e.target.value)} style={{ fontSize:15,fontWeight:700 }}>
                  {projects.map(p=>{
                    const cnt = installments.filter(i=>i.project===p&&i.kind==="payable"&&i.status==="pending"&&daysUntil(i.dueDate)<=3).length;
                    return <option key={p} value={p}>{cnt>0?`🚨 (${cnt}) `:""}{p}</option>;
                  })}
                </select>
                {(()=>{
                  const projUrgentPay = urgentPayables.filter(i=>i.project===proj);
                  if (projUrgentPay.length===0) return null;
                  return (
                    <div style={{ marginTop:10,background:"#ffebee",border:"1.5px solid #ef9a9a",borderRadius:10,padding:"10px 12px" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:4 }}>
                        <span style={{ fontWeight:700,fontSize:13,color:"#c62828" }}>🚨 งวดจ่ายใกล้ครบกำหนด</span>
                        <span style={{ background:"#c62828",color:"#fff",fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20 }}>{projUrgentPay.length}</span>
                      </div>
                      {projUrgentPay.slice(0,3).map(i=>{
                        const d = daysUntil(i.dueDate);
                        return (
                          <div key={i.id} style={{ fontSize:12,color:"#b71c1c",marginTop:2 }}>
                            • {i.name} — ฿{fmt(i.amount)} — {d<0?`เลย ${Math.abs(d)} วัน`:d===0?"ครบกำหนดวันนี้":`อีก ${d} วัน`}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Scope tabs (Design / Construction) */}
              <div style={{ display:"flex",background:"#fff",borderRadius:12,padding:4,boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                {SCOPES.map(s=>{
                  const count = projInstAll.filter(i=>i.scope===s.v&&i.status==="pending").length;
                  const active = activeScope===s.v;
                  return (
                    <button key={s.v} onClick={()=>setActiveScope(s.v)} style={{ flex:1,padding:"12px 8px",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:active?"#1565c0":"transparent",color:active?"#fff":"#888" }}>
                      <span style={{ marginRight:6 }}>{s.icon}</span>{s.l}
                      {count>0&&<span style={{ marginLeft:6,background:active?"rgba(255,255,255,.25)":"#f0f0f0",padding:"1px 7px",borderRadius:10,fontSize:11 }}>{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Project tax settings (per scope) */}
              {(()=>{
                const pst = getProjectScopeTax(proj, activeScope);
                const checkboxRow = (checked: boolean, label: string, onClick: ()=>void, extra?: ReactNode) => (
                  <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:checked?"#e8f5e9":"#f8f9ff",borderRadius:10,border:`1.5px solid ${checked?"#2e7d32":"#e0e4f0"}`,cursor:"pointer" }} onClick={onClick}>
                    <div style={{ width:22,height:22,borderRadius:6,background:checked?"#2e7d32":"#fff",border:`2px solid ${checked?"#2e7d32":"#bbb"}`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,fontWeight:800,flexShrink:0 }}>
                      {checked?"✓":""}
                    </div>
                    <div style={{ flex:1,fontSize:14,fontWeight:600,color:checked?"#1b5e20":"#333" }}>{label}</div>
                    {extra}
                  </div>
                );
                return (
                  <div className="card" style={{ padding:14 }}>
                    <div className="stitle" style={{ marginBottom:10 }}>⚙️ ภาษีของ{scopeLabel(activeScope)}</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {checkboxRow(pst.hasVat, "VAT 7%", ()=>updateProjectScopeTaxField(proj, activeScope, { hasVat: !pst.hasVat }))}
                      {checkboxRow(pst.hasWht, `หัก ณ ที่จ่าย ${pst.hasWht?pst.whtRate:""}${pst.hasWht?"%":""}`.trim(), ()=>updateProjectScopeTaxField(proj, activeScope, { hasWht: !pst.hasWht }),
                        pst.hasWht ? (
                          <div style={{ display:"flex",alignItems:"center",gap:4 }} onClick={e=>e.stopPropagation()}>
                            <input type="number" min="0" max="50" step="0.5" value={pst.whtRate} onChange={e=>updateProjectScopeTaxField(proj, activeScope, { whtRate: +e.target.value })} style={{ width:64,padding:"6px 8px",fontSize:13,textAlign:"center" }}/>
                            <span style={{ fontSize:13,fontWeight:600,color:"#1b5e20" }}>%</span>
                          </div>
                        ) : undefined
                      )}
                    </div>
                    <div style={{ marginTop:8,fontSize:11,color:"#888" }}>ค่านี้จะถูก lock ลงในงวด{scopeLabel(activeScope)}ใหม่ที่สร้างต่อไปอัตโนมัติ</div>
                  </div>
                );
              })()}

              {/* Projected with installments */}
              {(recvPending>0||payPending>0)&&(
                <div className="card" style={{ padding:14,background:"#fffde7",border:"1.5px solid #fff59d" }}>
                  <div style={{ fontSize:11,fontWeight:700,color:"#827717",marginBottom:6 }}>📊 ประมาณการ (รวมงวดค้าง)</div>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:13 }}>
                    <span style={{ color:"#666" }}>กำไรสุทธิ + งวดเบิกค้าง - งวดจ่ายค้าง</span>
                    <span style={{ fontWeight:800,color:projectedNet>=0?"#2e7d32":"#c62828" }}>{projectedNet>=0?"+":"-"}฿{fmt(Math.abs(projectedNet))}</span>
                  </div>
                </div>
              )}

              {/* Installment tabs */}
              <div style={{ display:"flex",background:"#fff",borderRadius:12,padding:4,boxShadow:"0 1px 4px rgba(0,0,0,.06)",marginTop:4 }}>
                {([
                  {k:"receivable" as InstKind, l:"💰 งวดเบิก", c:"#2e7d32"},
                  {k:"payable" as InstKind,    l:"💸 งวดจ่าย", c:"#c62828"}
                ]).map(t=>{
                  const count = projInst.filter(i=>i.kind===t.k&&i.status==="pending").length;
                  return (
                    <button key={t.k} onClick={()=>setInstTab(t.k)} style={{ flex:1,padding:"10px 8px",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:instTab===t.k?t.c:"transparent",color:instTab===t.k?"#fff":"#888" }}>
                      {t.l}{count>0&&<span style={{ marginLeft:6,background:instTab===t.k?"rgba(255,255,255,.25)":"#f0f0f0",padding:"1px 7px",borderRadius:10,fontSize:11 }}>{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Tab summary */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div className="card" style={{ padding:14,background:accentBg,border:"none" }}>
                  <div style={{ fontSize:11,color:"#777",marginBottom:3 }}>⏳ {instPendingLabel(instTab)}รวม</div>
                  <div style={{ fontSize:18,fontWeight:800,color:accent }}>฿{fmt(tabPendingTotal)}</div>
                  <div style={{ fontSize:11,color:"#999",marginTop:2 }}>{tabPending.length} งวด</div>
                </div>
                <div className="card" style={{ padding:14,background:"#f5f5f5",border:"none" }}>
                  <div style={{ fontSize:11,color:"#777",marginBottom:3 }}>✅ {instDoneLabel(instTab)}แล้วรวม</div>
                  <div style={{ fontSize:18,fontWeight:800,color:"#1565c0" }}>฿{fmt(tabDoneTotal)}</div>
                  <div style={{ fontSize:11,color:"#999",marginTop:2 }}>{tabDone.length} งวด</div>
                </div>
              </div>

              <button className="btn" style={{ width:"100%",padding:14,fontSize:15,background:accent,color:"#fff" }} onClick={()=>{ setInstForm({kind:instTab,scope:activeScope,workCategory:scopeWorkCats[0],project:proj,name:`${instLabel(instTab)}ที่ ${tabList.length+1}`,description:"",amount:"",dueDate:""}); setShowInstForm(true); }}>
                + เพิ่ม{instLabel(instTab)} ({scopeLabel(activeScope)})
              </button>

              {tabList.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"48px 0",fontSize:14 }}>ยังไม่มี{instLabel(instTab)}ของ{scopeLabel(activeScope)}ในโครงการนี้</div>
              :tabList.map(inst=>{
                const days=daysUntil(inst.dueDate);
                const isUrgent=days<=7&&days>=0&&inst.status==="pending";
                const isOverdue=days<0&&inst.status==="pending";
                const done = inst.status!=="pending";
                return (
                  <div key={inst.id} className="card" style={{ padding:16,borderLeft:`4px solid ${isOverdue?"#c62828":isUrgent?"#ff9800":done?"#2e7d32":"#ddd"}` }}>
                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                      <div style={{ fontWeight:700,fontSize:15 }}>{inst.name}</div>
                      <span className={`badge badge-${done?"received":"pending"}`}>
                        {done?`✅ ${instDoneLabel(inst.kind)}`:`⏳ ${instPendingLabel(inst.kind)}`}
                      </span>
                    </div>
                    <div style={{ marginBottom:6 }}>
                      <span className="tag">{inst.workCategory}</span>
                    </div>
                    {inst.description&&(
                      <div style={{ fontSize:12,color:"#555",marginBottom:6,padding:"6px 10px",background:"#fafbff",borderRadius:8,whiteSpace:"pre-wrap",lineHeight:1.4 }}>{inst.description}</div>
                    )}
                    <div style={{ fontSize:18,fontWeight:800,color:accent,marginBottom:4 }}>
                      {inst.kind==="payable"?"-":"+"}฿{fmt(inst.amount)}
                    </div>
                    {(inst.hasVat||inst.hasWht)&&(
                      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:6 }}>
                        {inst.hasVat&&<span style={{ fontSize:11,fontWeight:700,color:"#1b5e20",background:"#e8f5e9",padding:"3px 9px",borderRadius:6 }}>VAT 7% ✓</span>}
                        {inst.hasWht&&<span style={{ fontSize:11,fontWeight:700,color:"#b71c1c",background:"#ffebee",padding:"3px 9px",borderRadius:6 }}>หัก {inst.whtRate??3}% ✓</span>}
                      </div>
                    )}
                    <div style={{ fontSize:13,color:isOverdue?"#c62828":isUrgent?"#e65100":"#888" }}>
                      📅 {fmtDate(inst.dueDate)}
                      {inst.status==="pending"&&(isOverdue?` — เลยกำหนด ${Math.abs(days)} วัน`:` — อีก ${days} วัน`)}
                    </div>
                    {inst.kind==="receivable"&&(
                      <div style={{ display:"flex",gap:8,marginTop:12 }}>
                        <button className="btn btn-outline" onClick={()=>handleInvoice(inst)} style={{ flex:1,fontSize:13,padding:8 }} title={inst.invoiceNo?`เลขที่ ${inst.invoiceNo}`:"สร้างใหม่"}>📄 ใบวางบิล{inst.invoiceNo?` (${inst.invoiceNo})`:""}</button>
                        {inst.status==="received"&&(
                          <button className="btn btn-primary" onClick={()=>handleReceipt(inst)} style={{ flex:1,fontSize:13,padding:8 }} title={inst.receiptNo?`เลขที่ ${inst.receiptNo}`:"สร้างใหม่"}>🧾 ใบเสร็จ{inst.receiptNo?` (${inst.receiptNo})`:""}</button>
                        )}
                      </div>
                    )}
                    <div style={{ display:"flex",gap:8,marginTop:12 }}>
                      {inst.status==="pending"
                        ?<button className="btn btn-green" onClick={()=>toggleInstallment(inst)} style={{ flex:1,fontSize:13,padding:8 }}>✅ {instDoneLabel(inst.kind)}</button>
                        :<button className="btn btn-ghost" onClick={()=>toggleInstallment(inst)} style={{ flex:1,fontSize:13,padding:8 }}>↩️ ยกเลิก</button>
                      }
                      <button className="btn btn-red" onClick={()=>setDeleteInstId(inst.id)} style={{ flex:1,fontSize:13,padding:8 }}>🗑️ ลบ</button>
                    </div>
                  </div>
                );
              })}

              {/* Statement section — collapsible per scope */}
              {(()=>{
                const stmtKey = `stmt:${proj}:${activeScope}`;
                const stmtCollapsed = !!collapsedGroups[stmtKey];
                type StmtRow = { id: string; date: string; category: string; description: string; amount: number };
                const recvDone = projInst.filter(i=>i.kind==="receivable"&&i.status==="received");
                const payDone  = projInst.filter(i=>i.kind==="payable"&&i.status==="paid");
                const incRows: StmtRow[] = recvDone.map(i=>({
                  id: `i${i.id}`, date: i.completedDate || i.dueDate,
                  category: i.workCategory, description: i.name, amount: i.amount,
                })).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
                const expRows: StmtRow[] = payDone.map(i=>({
                  id: `i${i.id}`, date: i.completedDate || i.dueDate,
                  category: i.workCategory, description: i.name, amount: i.amount,
                })).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
                const totalRows = incRows.length + expRows.length;
                return (
                  <div className="card" style={{ padding:0,overflow:"hidden",marginTop:4 }}>
                    <button onClick={()=>toggleGroup(stmtKey)} aria-expanded={!stmtCollapsed} style={{ width:"100%",textAlign:"left",cursor:"pointer",background:"linear-gradient(90deg,#eff3fb,transparent)",border:"none",borderLeft:"4px solid #1565c0",padding:"14px 16px",fontFamily:"inherit" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8 }}>
                        <span style={{ fontWeight:800,fontSize:15,color:"#1a1a2e",display:"flex",alignItems:"center",gap:6 }}>
                          <span style={{ display:"inline-block",transform:stmtCollapsed?"rotate(-90deg)":"rotate(0)",transition:"transform .15s",color:"#1565c0",fontSize:12 }}>▼</span>
                          📑 Statement — {scopeLabel(activeScope)}
                        </span>
                        <span style={{ fontSize:11,color:"#888",fontWeight:600 }}>{totalRows} รายการ</span>
                      </div>
                      <div style={{ display:"flex",gap:10,marginTop:6,fontSize:12,flexWrap:"wrap" }}>
                        <span style={{ color:"#2e7d32",fontWeight:700 }}>รับ ฿{fmt(pIncome)}</span>
                        <span style={{ color:"#c62828",fontWeight:700 }}>จ่าย ฿{fmt(pExpense)}</span>
                        <span style={{ color:pNet>=0?"#1565c0":"#c62828",fontWeight:800,marginLeft:"auto" }}>{pNet>=0?"กำไร":"ขาดทุน"} {pNet>=0?"+":"-"}฿{fmt(Math.abs(pNet))}</span>
                      </div>
                    </button>
                    {!stmtCollapsed&&(()=>{
                      if (totalRows===0) return (
                        <div style={{ padding:"4px 16px 12px" }}>
                          <div style={{ fontSize:13,color:"#ccc",textAlign:"center",padding:"20px 0" }}>ยังไม่มีรายการในโครงการนี้</div>
                        </div>
                      );
                      const column = (rows: StmtRow[], total: number, side: "inc"|"exp") => {
                        const isInc = side==="inc";
                        const color = isInc ? "#2e7d32" : "#c62828";
                        const bg = isInc ? "#e8f5e9" : "#ffebee";
                        return (
                          <div style={{ background:"#fff",borderRadius:10,overflow:"hidden",border:`1px solid ${bg}` }}>
                            <div style={{ background:bg,padding:"8px 10px",fontSize:12,fontWeight:800,color,display:"flex",justifyContent:"space-between" }}>
                              <span>{isInc?"↑ รายรับ":"↓ รายจ่าย"}</span>
                              <span>{rows.length}</span>
                            </div>
                            <div style={{ padding:"4px 10px",minHeight:60 }}>
                              {rows.length===0?<div style={{ fontSize:11,color:"#ccc",textAlign:"center",padding:"16px 0" }}>—</div>
                              :rows.map((r,i)=>(
                                <div key={r.id} style={{ padding:"8px 0",borderBottom:i<rows.length-1?"1px solid #f5f5f5":"none" }}>
                                  <div style={{ fontSize:10,color:"#999" }}>{fmtDate(String(r.date).slice(0,10))} · {r.category}</div>
                                  <div style={{ fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1 }}>{r.description}</div>
                                  <div style={{ fontSize:13,fontWeight:800,color,marginTop:2 }}>{isInc?"+":"-"}฿{fmt(r.amount)}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ background:bg,padding:"8px 10px",fontSize:12,fontWeight:800,color,display:"flex",justifyContent:"space-between",borderTop:`1px solid ${color}22` }}>
                              <span>รวม</span>
                              <span>{isInc?"+":"-"}฿{fmt(total)}</span>
                            </div>
                          </div>
                        );
                      };
                      return (
                        <div style={{ padding:"10px 12px 14px" }}>
                          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                            {column(incRows, pIncome, "inc")}
                            {column(expRows, pExpense, "exp")}
                          </div>
                          <div style={{ marginTop:12,padding:"12px 14px",borderRadius:10,background:pNet>=0?"linear-gradient(135deg,#e8eaf6,#f3f4ff)":"linear-gradient(135deg,#ffebee,#fce4ec)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                            <span style={{ fontSize:13,fontWeight:700 }}>{pNet>=0?"📈 กำไรสุทธิ":"📉 ขาดทุนสุทธิ"}</span>
                            <span style={{ fontSize:18,fontWeight:800,color:pNet>=0?"#1565c0":"#c62828" }}>{pNet>=0?"+":"-"}฿{fmt(Math.abs(pNet))}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* SETTINGS */}
        {view==="settings"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            <div className="card" style={{ padding:18 }}>
              <div className="stitle" style={{ marginBottom:14 }}>การแสดงผล</div>

              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #f0f0f0" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:600 }}>🔔 การแจ้งเตือน</div>
                  <div style={{ fontSize:11,color:"#888",marginTop:2 }}>แจ้งเตือนงวดที่ใกล้ครบกำหนดและภาษีถึงกำหนดยื่น</div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifEnabled}
                  onClick={()=>{
                    const next = !notifEnabled;
                    setNotifEnabled(next);
                    localStorage.setItem("wf_notif_enabled", next?"1":"0");
                    if (next && !notifGranted) requestNotifPermission();
                  }}
                  style={{ width:50,height:28,borderRadius:14,border:"none",background:notifEnabled?"#2e7d32":"#ccc",cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0 }}
                >
                  <span style={{ position:"absolute",top:3,left:notifEnabled?25:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
                </button>
              </div>

              <div style={{ padding:"14px 0",borderBottom:"1px solid #f0f0f0" }}>
                <label style={{ fontSize:14,fontWeight:600,display:"block",marginBottom:4 }}>📅 แจ้งเตือนล่วงหน้า</label>
                <div style={{ fontSize:11,color:"#888",marginBottom:8 }}>กี่วันก่อนครบกำหนดงวด</div>
                <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={alertDaysAhead}
                    onChange={e=>{
                      const v = parseInt(e.target.value,10);
                      const next = Number.isFinite(v)&&v>0 ? v : 1;
                      setAlertDaysAhead(next);
                      localStorage.setItem("wf_alert_days_ahead", String(next));
                    }}
                    style={{ width:90,textAlign:"center",fontSize:15,fontWeight:700 }}
                  />
                  <span style={{ fontSize:14,color:"#666" }}>วัน</span>
                </div>
              </div>

              <div style={{ padding:"14px 0" }}>
                <label style={{ fontSize:14,fontWeight:600,display:"block",marginBottom:4 }}>🗓️ รูปแบบวันที่</label>
                <div style={{ fontSize:11,color:"#888",marginBottom:8 }}>ตัวอย่าง: {fmtDate(new Date())}</div>
                <div style={{ display:"flex",gap:8 }}>
                  {([
                    {v:"be" as const, l:"พ.ศ.", sub:"พุทธศักราช"},
                    {v:"ce" as const, l:"ค.ศ.", sub:"คริสต์ศักราช"},
                  ]).map(opt=>{
                    const active = dateFormat===opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={()=>{ setDateFormat(opt.v); localStorage.setItem("wf_date_format", opt.v); }}
                        style={{ flex:1,padding:"12px 8px",borderRadius:10,border:`2px solid ${active?"#1565c0":"#e0e4f0"}`,background:active?"#e3f2fd":"#fff",cursor:"pointer",fontFamily:"inherit",textAlign:"center" }}
                      >
                        <div style={{ fontSize:15,fontWeight:800,color:active?"#0d47a1":"#666" }}>{opt.l}</div>
                        <div style={{ fontSize:11,color:active?"#1565c0":"#aaa",marginTop:2 }}>{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding:18 }}>
              <div className="stitle" style={{ marginBottom:14 }}>🔒 ความปลอดภัย</div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:"1px solid #f0f0f0" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:600 }}>PIN เข้าใช้งาน</div>
                  <div style={{ fontSize:11,color:"#888",marginTop:2 }}>เปลี่ยน PIN ต้องยืนยันผ่านอีเมล {PIN_NOTIFY_EMAIL}</div>
                </div>
                <button
                  className="btn btn-outline"
                  onClick={()=>{ setPinChange({ step:"old",oldPin:"",newPin:"",confirmPin:"",code:"",pendingHash:"",codeSent:false,codeExpires:0,codeInput:"" }); setShowChangePin(true); }}
                  style={{ fontSize:13,padding:"8px 14px" }}
                >เปลี่ยน PIN</button>
              </div>
              <div style={{ padding:"12px 0",fontSize:11,color:"#888",lineHeight:1.5 }}>
                🔒 PIN จะถูกล็อกอัตโนมัติทุกครั้งที่ออกจากแท็บ "ภาพรวม" — เข้าครั้งถัดไปต้องกรอกใหม่
              </div>
            </div>

            <div style={{ background:"#fff5f5",border:"2px solid #ef9a9a",borderRadius:14,padding:18 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                <span style={{ fontSize:20 }}>⚠️</span>
                <div style={{ fontWeight:800,fontSize:15,color:"#b71c1c",letterSpacing:".04em" }}>DANGER ZONE</div>
              </div>
              <div style={{ fontSize:12,color:"#c62828",marginBottom:14,lineHeight:1.5 }}>
                การกระทำในส่วนนี้ไม่สามารถย้อนกลับได้ กรุณาพิจารณาก่อนดำเนินการ
              </div>
              <button
                className="btn btn-red"
                onClick={()=>setView("project-manage")}
                style={{ width:"100%",padding:13,fontSize:14 }}
              >
                🗂️ จัดการโครงการ
              </button>
            </div>
          </div>
        )}

        {/* PROJECT MANAGE (DANGER ZONE) */}
        {view==="project-manage"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <button
              className="btn btn-ghost"
              onClick={()=>setView("settings")}
              style={{ alignSelf:"flex-start",padding:"8px 14px",fontSize:13 }}
            >
              ← กลับไปตั้งค่า
            </button>

            <div style={{ background:"#fff5f5",border:"2px solid #ef9a9a",borderRadius:14,padding:"14px 16px" }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4 }}>
                <span style={{ fontSize:18 }}>⚠️</span>
                <div style={{ fontWeight:800,fontSize:14,color:"#b71c1c" }}>จัดการโครงการ — Danger Zone</div>
              </div>
              <div style={{ fontSize:12,color:"#c62828",lineHeight:1.5 }}>
                การลบโครงการจะลบรายการบัญชีและงวดงานทั้งหมดของโครงการนั้นถาวร — ไม่สามารถย้อนกลับได้
              </div>
            </div>

            <div className="card" style={{ padding:14 }}>
              <div style={{ display:"flex",gap:8 }}>
                <input
                  placeholder="ชื่อโครงการใหม่..."
                  value={newProj}
                  onChange={e=>setNewProj(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addProject()}
                  style={{ flex:1 }}
                />
                <button className="btn btn-green" onClick={addProject} disabled={saving} style={{ whiteSpace:"nowrap" }}>+ เพิ่ม</button>
              </div>
            </div>

            <div className="card" style={{ padding:14 }}>
              <div className="stitle" style={{ marginBottom:10 }}>โครงการทั้งหมด ({projects.length})</div>
              {projects.length===0?(
                <div style={{ textAlign:"center",color:"#bbb",padding:"28px 0",fontSize:14 }}>ยังไม่มีโครงการ</div>
              ):(
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {projects.map(p=>{
                    const entriesCount = entries.filter(e=>e.project===p).length;
                    const instCount = installments.filter(i=>i.project===p).length;
                    return (
                      <div key={p} style={{ padding:"12px 14px",background:"#f8f9ff",borderRadius:10,border:"1px solid #eef0f8" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8 }}>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis" }}>📁 {p}</div>
                            <div style={{ fontSize:12,color:"#888",marginTop:4 }}>
                              {entriesCount} รายการบัญชี · {instCount} งวดงาน
                            </div>
                          </div>
                        </div>
                        <button
                          className="btn btn-red"
                          onClick={()=>{ setDeleteProj(p); setDeleteProjConfirm(""); }}
                          style={{ width:"100%",padding:9,fontSize:13 }}
                        >
                          🗑️ ลบโครงการ
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        {[{k:"dashboard",icon:"📊",l:"ภาพรวม"},{k:"installments",icon:"📁",l:"โครงการ"}].map(n=>(
          <button key={n.k} className={`bnav-btn${view===n.k?" active":""}`} onClick={()=>setView(n.k)}>
            <span>{n.icon}</span>{n.l}
            {n.k==="installments"&&urgentInst.length>0&&<div style={{ position:"absolute",top:6,background:"#c62828",color:"#fff",borderRadius:50,width:16,height:16,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>{urgentInst.length}</div>}
          </button>
        ))}
        <button className={`bnav-btn${(view==="settings"||view==="project-manage")?" active":""}`} onClick={()=>setView("settings")}><span>⚙️</span>ตั้งค่า</button>
      </div>


      {/* ENTRY FORM */}
      {showForm&&(
        <div className="modal-bg" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontWeight:800,fontSize:18,marginBottom:20 }}>{editId?"✏️ แก้ไขรายการ":"💸 บันทึกรายจ่าย"}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {[
                {label:"วันที่",el:<input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>},
                {label:"หมวดหมู่",el:<select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{cats.map(c=><option key={c}>{c}</option>)}</select>},
                {label:"โครงการ",el:<select value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))}>{projects.map(p=><option key={p}>{p}</option>)}</select>},
                {label:"รายละเอียด",el:<input type="text" placeholder="อธิบายรายการ..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>},
                {label:"จำนวนเงิน (บาท)",el:<input type="number" inputMode="decimal" placeholder="0.00" value={form.amount} min="0" step="0.01" onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/>},
              ].map(({label,el})=>(
                <div key={label}>
                  <label style={{ fontSize:12,color:"#aaa",fontWeight:700,display:"block",marginBottom:6 }}>{label}</label>
                  {el}
                </div>
              ))}

              {/* Tax options */}
              <div>
                <label style={{ fontSize:12,color:"#aaa",fontWeight:700,display:"block",marginBottom:8 }}>ภาษี</label>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {([
                    { key:"useVat" as const,
                      label:`VAT 7% — ${form.type==="income"?"Output VAT (ขาย)":"Input VAT (ซื้อ)"}`,
                      sub: form.type==="income"?"เก็บจากลูกค้า ต้องนำส่งสรรพากร":"จ่ายให้ผู้ขาย ใช้หักลดได้",
                      checked:form.useVat, rate:VAT_RATE, rateColor:"#e65100" },
                    { key:"useWht" as const,
                      label:`หัก ณ ที่จ่าย 3% — ${form.type==="income"?"ถูกหัก (เครดิตภาษี)":"หักจ่าย (นำส่งสรรพากร)"}`,
                      sub: form.type==="income"?"ลูกค้าหักจากเรา ใช้เครดิตปลายปี":"เราหักผู้รับเงิน ต้องนำส่ง",
                      checked:form.useWht, rate:WHT_RATE, rateColor:"#c62828" },
                  ]).map(opt=>(
                    <button
                      key={opt.key}
                      type="button"
                      onClick={()=>setForm(f=>({ ...f, [opt.key]: !opt.checked }))}
                      style={{
                        display:"flex",alignItems:"center",gap:14,padding:"14px 16px",
                        background:opt.checked?"#e8f5e9":"#f8f9ff",
                        border:`2px solid ${opt.checked?"#2e7d32":"#e0e4f0"}`,
                        borderRadius:12,cursor:"pointer",fontFamily:"inherit",textAlign:"left",
                        width:"100%",minHeight:56,WebkitTapHighlightColor:"transparent",
                        transition:"background .15s,border-color .15s",
                      }}
                    >
                      <div style={{
                        width:30,height:30,borderRadius:8,flexShrink:0,
                        background:opt.checked?"#2e7d32":"#fff",
                        border:`2px solid ${opt.checked?"#2e7d32":"#bbb"}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        color:"#fff",fontSize:20,fontWeight:800,lineHeight:1,
                        boxShadow:opt.checked?"0 2px 6px rgba(46,125,50,.3)":"none",
                      }}>{opt.checked?"✓":""}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14,fontWeight:700,color:opt.checked?"#1b5e20":"#333",lineHeight:1.3 }}>{opt.label}</div>
                        <div style={{ fontSize:11,color:"#777",marginTop:3 }}>{opt.sub}</div>
                        {opt.checked&&form.amount&&<div style={{ fontSize:13,color:opt.rateColor,marginTop:4,fontWeight:700 }}>= ฿{fmt(+form.amount*opt.rate)}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Total preview */}
              {form.amount&&(form.useVat||form.useWht)&&(
                <div style={{ background:"#f8f9ff",borderRadius:10,padding:12,fontSize:13 }}>
                  <div style={{ fontWeight:700,marginBottom:6 }}>สรุปยอด</div>
                  <div style={{ display:"flex",justifyContent:"space-between" }}><span>ยอดก่อนภาษี</span><span>฿{fmt(+form.amount)}</span></div>
                  {form.useVat&&<div style={{ display:"flex",justifyContent:"space-between",color:"#e65100" }}><span>+ VAT 7%</span><span>฿{fmt(+form.amount*VAT_RATE)}</span></div>}
                  {form.useWht&&<div style={{ display:"flex",justifyContent:"space-between",color:"#c62828" }}><span>- หัก ณ ที่จ่าย 3%</span><span>฿{fmt(+form.amount*WHT_RATE)}</span></div>}
                  <div style={{ display:"flex",justifyContent:"space-between",fontWeight:800,marginTop:6,paddingTop:6,borderTop:"1px solid #e0e0e0" }}>
                    <span>ยอดสุทธิ</span>
                    <span style={{ color:"#1565c0" }}>฿{fmt(+form.amount+(form.useVat?+form.amount*VAT_RATE:0)-(form.useWht?+form.amount*WHT_RATE:0))}</span>
                  </div>
                </div>
              )}

              <div style={{ display:"flex",gap:10,marginTop:4 }}>
                <button className="btn btn-ghost" onClick={()=>setShowForm(false)} style={{ flex:1,padding:13 }}>ยกเลิก</button>
                <button className="btn btn-primary" onClick={saveEntry} disabled={saving} style={{ flex:2,padding:13 }}>
                  {saving?"กำลังบันทึก...":editId?"บันทึกการแก้ไข":"บันทึกรายการ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INSTALLMENT FORM */}
      {showInstForm&&(
        <div className="modal-bg" onClick={()=>setShowInstForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontWeight:800,fontSize:18,marginBottom:20 }}>📆 เพิ่ม{instLabel(instForm.kind)} — {scopeLabel(instForm.scope)}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <div>
                <label style={{ fontSize:12,color:"#aaa",fontWeight:700,display:"block",marginBottom:6 }}>หมวดงาน</label>
                <div style={{ display:"flex",borderRadius:12,overflow:"hidden",border:"1.5px solid #e0e4f0" }}>
                  {SCOPES.map(s=>(
                    <button key={s.v} onClick={()=>setInstForm(f=>({...f,scope:s.v,workCategory:WORK_CATS_BY_SCOPE[s.v][0]}))} style={{ flex:1,padding:12,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:instForm.scope===s.v?"#1565c0":"transparent",color:instForm.scope===s.v?"#fff":"#bbb" }}>{s.icon} {s.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12,color:"#aaa",fontWeight:700,display:"block",marginBottom:6 }}>ประเภทงวด</label>
                <div style={{ display:"flex",borderRadius:12,overflow:"hidden",border:"1.5px solid #e0e4f0" }}>
                  {([
                    {v:"receivable" as InstKind,l:"💰 งวดเบิก (รับจากลูกค้า)",c:"#2e7d32"},
                    {v:"payable" as InstKind,   l:"💸 งวดจ่าย (จ่ายผู้รับเหมา)",c:"#c62828"}
                  ]).map(t=>(
                    <button key={t.v} onClick={()=>setInstForm(f=>({...f,kind:t.v}))} style={{ flex:1,padding:12,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700,background:instForm.kind===t.v?t.c:"transparent",color:instForm.kind===t.v?"#fff":"#bbb" }}>{t.l}</button>
                  ))}
                </div>
              </div>
              {[
                {label:"โครงการ",el:<select value={instForm.project} onChange={e=>setInstForm(f=>({...f,project:e.target.value}))}>{projects.map(p=><option key={p}>{p}</option>)}</select>},
                {label:"หมวดงาน (Work category)",el:<select value={instForm.workCategory} onChange={e=>setInstForm(f=>({...f,workCategory:e.target.value}))}>{WORK_CATS_BY_SCOPE[instForm.scope].map(c=><option key={c}>{c}</option>)}</select>},
                {label:"ชื่องวด เช่น งวดที่ 1",el:<input type="text" placeholder="งวดที่ 1" value={instForm.name} onChange={e=>setInstForm(f=>({...f,name:e.target.value}))}/>},
                {label:"รายละเอียด (จะใช้แสดงในใบวางบิล/ใบเสร็จ)",el:<textarea placeholder={instForm.kind==="payable"?"เช่น งานก่อสร้างฐานราก งวดที่ 1":"เช่น ค่าจ้างออกแบบและควบคุมงาน งวดที่ 1"} value={instForm.description} onChange={e=>setInstForm(f=>({...f,description:e.target.value}))} rows={3} style={{ resize:"vertical",minHeight:80,lineHeight:1.5 }}/>},
                {label:"ยอดเงินงวด (บาท)",el:<input type="text" inputMode="decimal" placeholder="0.00" value={formatThousand(instForm.amount)} onChange={e=>{ const raw = parseThousand(e.target.value); if (/^\d*\.?\d*$/.test(raw)) setInstForm(f=>({...f,amount:raw})); }}/>},
                {label:instForm.kind==="payable"?"วันครบกำหนดจ่าย":"วันครบกำหนดเบิก",el:<input type="date" value={instForm.dueDate} onChange={e=>setInstForm(f=>({...f,dueDate:e.target.value}))}/>},
              ].map(({label,el})=>(
                <div key={label}>
                  <label style={{ fontSize:12,color:"#aaa",fontWeight:700,display:"block",marginBottom:6 }}>{label}</label>
                  {el}
                </div>
              ))}
              <div style={{ display:"flex",gap:10,marginTop:4 }}>
                <button className="btn btn-ghost" onClick={()=>setShowInstForm(false)} style={{ flex:1,padding:13 }}>ยกเลิก</button>
                <button className="btn btn-primary" onClick={addInstallment} style={{ flex:2,padding:13 }}>บันทึก{instLabel(instForm.kind)}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION POPUP */}
      {showNotifPopup&&(()=>{
        const upcoming = installments
          .filter(i=>i.status==="pending")
          .map(i=>({ ...i, days: daysUntil(i.dueDate) }))
          .filter(i=>i.days<=14)
          .sort((a,b)=>a.days-b.days);
        const overdue = upcoming.filter(i=>i.days<0);
        const urgent  = upcoming.filter(i=>i.days>=0&&i.days<=7);
        const soon    = upcoming.filter(i=>i.days>7&&i.days<=14);
        const section = (title: string, items: typeof upcoming, color: string, bg: string) => items.length>0&&(
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12,fontWeight:700,color,marginBottom:8,letterSpacing:".04em" }}>{title} ({items.length})</div>
            {items.map(i=>(
              <div key={i.id} style={{ background:bg,borderRadius:10,padding:"10px 12px",marginBottom:6,borderLeft:`3px solid ${color}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8 }}>
                  <div style={{ fontWeight:700,fontSize:14 }}>
                    <span style={{ fontSize:11,fontWeight:700,color:i.kind==="payable"?"#c62828":"#2e7d32",marginRight:6 }}>[{instLabel(i.kind)}]</span>
                    {i.name}
                  </div>
                  <div style={{ fontWeight:800,fontSize:14,color:i.kind==="payable"?"#c62828":"#2e7d32",whiteSpace:"nowrap" }}>{i.kind==="payable"?"-":"+"}฿{fmt(i.amount)}</div>
                </div>
                <div style={{ fontSize:11,color:"#666",marginTop:3 }}>📁 {i.project} · 📅 {fmtDate(i.dueDate)} · {i.days<0?`เลยกำหนด ${Math.abs(i.days)} วัน`:`อีก ${i.days} วัน`}</div>
              </div>
            ))}
          </div>
        );
        return (
          <div className="modal-bg" onClick={()=>setShowNotifPopup(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
                <div style={{ fontWeight:800,fontSize:18 }}>🔔 งวดที่ใกล้ครบกำหนด</div>
                <button onClick={()=>setShowNotifPopup(false)} aria-label="ปิด" style={{ width:32,height:32,borderRadius:"50%",border:"none",background:"#f0f0f0",fontSize:18,fontWeight:700,cursor:"pointer",color:"#666" }}>✕</button>
              </div>
              {upcoming.length===0?(
                <div style={{ textAlign:"center",color:"#aaa",padding:"32px 8px",fontSize:14 }}>
                  <div style={{ fontSize:38,marginBottom:10 }}>✨</div>
                  ไม่มีงวดที่ใกล้ครบกำหนดใน 14 วัน
                </div>
              ):(
                <div>
                  {section("⚠️ เลยกำหนดแล้ว", overdue, "#c62828", "#ffebee")}
                  {section("🚨 ภายใน 7 วัน", urgent, "#e65100", "#fff3e0")}
                  {section("📌 8-14 วันข้างหน้า", soon, "#1565c0", "#e8eaf6")}
                </div>
              )}
              {!notifGranted&&(
                <button className="btn btn-orange" style={{ marginTop:8,width:"100%",padding:12 }} onClick={()=>{ setShowNotifPopup(false); requestNotifPermission(); }}>
                  🔔 เปิด Push Notification ของระบบ
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAX SUMMARY MODAL */}
      {showTaxSummary&&(
        <div className="modal-bg" onClick={()=>setShowTaxSummary(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontWeight:800,fontSize:18,marginBottom:6 }}>🧾 สรุปภาษี</div>
            <div style={{ fontSize:12,color:"#888",marginBottom:18 }}>เดือนยื่นปัจจุบัน: <b>{vatDueInfo.monthStr}</b> · ครบกำหนด {fmtDate(vatDueInfo.dueDate.toISOString().slice(0,10))}</div>

            {/* VAT */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:800,color:"#0d47a1",marginBottom:8,letterSpacing:".04em" }}>📊 VAT</div>
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ background:"#e3f2fd",borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:12,color:"#0d47a1",fontWeight:700 }}>Output VAT (VAT ขาย)</div>
                    <div style={{ fontSize:10,color:"#666",marginTop:2 }}>เก็บจากลูกค้า ต้องนำส่งสรรพากร</div>
                  </div>
                  <div style={{ fontSize:18,fontWeight:800,color:"#0d47a1" }}>฿{fmt(vatDueInfo.outputVat)}</div>
                </div>
                <div style={{ background:"#fff3e0",borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:12,color:"#e65100",fontWeight:700 }}>Input VAT (VAT ซื้อ)</div>
                    <div style={{ fontSize:10,color:"#666",marginTop:2 }}>จ่ายให้ผู้ขาย หักออกจากที่ต้องนำส่ง</div>
                  </div>
                  <div style={{ fontSize:18,fontWeight:800,color:"#e65100" }}>฿{fmt(vatDueInfo.inputVat)}</div>
                </div>
                <div style={{ background:vatDueInfo.vatNet>=0?"#fff8e1":"#e8f5e9",borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center",border:`2px solid ${vatDueInfo.vatNet>=0?"#ffb74d":"#a5d6a7"}` }}>
                  <div>
                    <div style={{ fontSize:12,fontWeight:800,color:vatDueInfo.vatNet>=0?"#bf360c":"#1b5e20" }}>VAT สุทธิ (Output - Input)</div>
                    <div style={{ fontSize:10,color:"#666",marginTop:2 }}>{vatDueInfo.vatNet>=0?"ต้องนำส่ง":"ขอคืนหรือใช้เครดิตเดือนถัดไป"}</div>
                  </div>
                  <div style={{ fontSize:20,fontWeight:800,color:vatDueInfo.vatNet>=0?"#bf360c":"#1b5e20" }}>
                    {vatDueInfo.vatNet>=0?`฿${fmt(vatDueInfo.vatNet)}`:`ขอคืน ฿${fmt(-vatDueInfo.vatNet)}`}
                  </div>
                </div>
              </div>
            </div>

            {/* WHT */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:800,color:"#4527a0",marginBottom:8,letterSpacing:".04em" }}>📊 หัก ณ ที่จ่าย (WHT)</div>
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                <div style={{ background:"#ede7f6",borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:12,color:"#4527a0",fontWeight:700 }}>ถูกหัก (Withheld)</div>
                    <div style={{ fontSize:10,color:"#666",marginTop:2 }}>ลูกค้าหักจากเรา = เครดิตภาษีเงินได้</div>
                  </div>
                  <div style={{ fontSize:18,fontWeight:800,color:"#4527a0" }}>฿{fmt(vatDueInfo.whtCredit)}</div>
                </div>
                <div style={{ background:"#fce4ec",borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:12,color:"#c62828",fontWeight:700 }}>หักจากคนอื่น (Withhold)</div>
                    <div style={{ fontSize:10,color:"#666",marginTop:2 }}>เราหักผู้รับเหมา/พนักงาน = ต้องนำส่ง</div>
                  </div>
                  <div style={{ fontSize:18,fontWeight:800,color:"#c62828" }}>฿{fmt(vatDueInfo.whtRemit)}</div>
                </div>
              </div>
            </div>

            {/* Grand total */}
            <div style={{ background:vatDueInfo.totalRemit>0?"linear-gradient(135deg,#ffebee,#fce4ec)":"linear-gradient(135deg,#e8f5e9,#f1f8e9)",borderRadius:12,padding:16,marginBottom:6 }}>
              <div style={{ fontSize:12,fontWeight:800,color:vatDueInfo.totalRemit>0?"#b71c1c":"#1b5e20",marginBottom:6 }}>
                {vatDueInfo.totalRemit>0?"💸 ต้องนำส่งสรรพากรเดือนนี้":"✅ ไม่มีภาษีต้องนำส่งเดือนนี้"}
              </div>
              <div style={{ fontSize:11,color:"#666",marginBottom:6 }}>= VAT สุทธิ (ถ้าเป็นบวก) + WHT ที่หักจากคนอื่น</div>
              <div style={{ fontSize:11,color:"#666",marginBottom:8 }}>
                {`= ฿${fmt(vatDueInfo.vatRemit)} (VAT) + ฿${fmt(vatDueInfo.whtRemit)} (WHT)`}
              </div>
              <div style={{ fontSize:26,fontWeight:800,color:vatDueInfo.totalRemit>0?"#b71c1c":"#1b5e20",textAlign:"right" }}>฿{fmt(vatDueInfo.totalRemit)}</div>
            </div>

            <button className="btn btn-ghost" style={{ marginTop:10,width:"100%",padding:13 }} onClick={()=>setShowTaxSummary(false)}>ปิด</button>
          </div>
        </div>
      )}

      {/* ADD PROJECT MODAL */}
      {showProjMgr&&(
        <div className="modal-bg" onClick={()=>setShowProjMgr(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontWeight:800,fontSize:18,marginBottom:6 }}>📁 เพิ่มโครงการใหม่</div>
            <div style={{ fontSize:12,color:"#888",marginBottom:16 }}>
              สำหรับการลบ ให้ไปที่ <b>ตั้งค่า → Danger Zone → จัดการโครงการ</b>
            </div>
            <div style={{ display:"flex",gap:8,marginBottom:16 }}>
              <input placeholder="ชื่อโครงการใหม่..." value={newProj} onChange={e=>setNewProj(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()} style={{ flex:1 }}/>
              <button className="btn btn-green" onClick={addProject} disabled={saving} style={{ whiteSpace:"nowrap" }}>+ เพิ่ม</button>
            </div>
            {projects.length>0&&(
              <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto",marginBottom:8 }}>
                {projects.map(p=>(
                  <div key={p} style={{ padding:"10px 14px",background:"#f8f9ff",borderRadius:10,fontSize:13 }}>{p}</div>
                ))}
              </div>
            )}
            <button className="btn btn-ghost" style={{ marginTop:8,width:"100%",padding:13 }} onClick={()=>setShowProjMgr(false)}>ปิด</button>
          </div>
        </div>
      )}

      {/* TAX PROPAGATE CONFIRM */}
      {pendingTaxPropagate&&(()=>{
        const { name, scope, next } = pendingTaxPropagate;
        const affected = installments.filter(i=>i.project===name&&i.scope===scope).length;
        return (
          <div className="modal-bg" onClick={()=>setPendingTaxPropagate(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
              <div style={{ fontSize:36,textAlign:"center",marginBottom:10 }}>🧾</div>
              <div style={{ fontWeight:800,fontSize:17,textAlign:"center",marginBottom:8 }}>อัปเดตงวดที่มีอยู่แล้วด้วยไหม?</div>
              <div style={{ color:"#666",textAlign:"center",marginBottom:14,fontSize:14 }}>
                คุณเพิ่งเปลี่ยนภาษีของ <b>{scopeLabel(scope)}</b> ในโครงการ <b>{name}</b> มีงวดเดิมในหมวดนี้ <b>{affected}</b> งวด
              </div>
              <div style={{ background:"#f8f9ff",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13 }}>
                <div>VAT 7%: <b style={{ color:next.hasVat?"#2e7d32":"#999" }}>{next.hasVat?"เปิด ✓":"ปิด"}</b></div>
                <div>หัก ณ ที่จ่าย: <b style={{ color:next.hasWht?"#2e7d32":"#999" }}>{next.hasWht?`${next.whtRate}% ✓`:"ปิด"}</b></div>
              </div>
              <div style={{ display:"flex",gap:10 }}>
                <button className="btn btn-ghost" onClick={()=>setPendingTaxPropagate(null)} style={{ flex:1,padding:13 }}>ไม่ — ใช้กับงวดใหม่เท่านั้น</button>
                <button className="btn btn-primary" onClick={()=>{ propagateTaxToInstallments(name, scope, next); setPendingTaxPropagate(null); showToast("อัปเดตภาษีของงวดเก่าแล้ว"); }} style={{ flex:1,padding:13 }}>ใช่ — อัปเดตทั้งหมด</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DELETE CONFIRM */}
      {deleteId&&(
        <div className="modal-bg" onClick={()=>setDeleteId(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontSize:36,textAlign:"center",marginBottom:10 }}>🗑️</div>
            <div style={{ fontWeight:800,fontSize:17,textAlign:"center",marginBottom:8 }}>ยืนยันการลบ</div>
            <div style={{ color:"#aaa",textAlign:"center",marginBottom:20,fontSize:14 }}>รายการนี้จะถูกลบถาวร</div>
            <div style={{ display:"flex",gap:10 }}>
              <button className="btn btn-ghost" onClick={()=>setDeleteId(null)} style={{ flex:1,padding:13 }}>ยกเลิก</button>
              <button className="btn btn-red" onClick={doDelete} disabled={saving} style={{ flex:1,padding:13,fontSize:14 }}>
                {saving?"กำลังลบ...":"ลบรายการ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PIN MODAL */}
      {showChangePin&&(
        <div className="modal-bg" onClick={()=>setShowChangePin(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontSize:32,textAlign:"center",marginBottom:6 }}>🔒</div>
            <div style={{ fontWeight:800,fontSize:18,textAlign:"center",marginBottom:6 }}>เปลี่ยน PIN เข้าใช้งาน</div>
            <div style={{ fontSize:12,color:"#888",textAlign:"center",marginBottom:18 }}>ขั้นตอนที่ {pinChange.step==="old"?1:pinChange.step==="new"?2:3} / 3</div>

            {pinChange.step==="old"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <label style={{ fontSize:13,fontWeight:600,color:"#666" }}>PIN ปัจจุบัน</label>
                <input type="password" inputMode="numeric" autoFocus maxLength={6} placeholder="• • • •" value={pinChange.oldPin}
                  onChange={e=>setPinChange(p=>({...p,oldPin:e.target.value.replace(/\D/g,"")}))}
                  style={{ padding:"14px 16px",fontSize:20,letterSpacing:"0.3em",textAlign:"center" }}/>
                <div style={{ display:"flex",gap:10,marginTop:6 }}>
                  <button className="btn btn-ghost" onClick={()=>setShowChangePin(false)} style={{ flex:1,padding:13 }}>ยกเลิก</button>
                  <button className="btn btn-primary" disabled={pinChange.oldPin.length<4} onClick={async()=>{
                    const ok = await verifyPin(pinChange.oldPin);
                    if (!ok) { showToast("PIN ปัจจุบันไม่ถูกต้อง","err"); return; }
                    setPinChange(p=>({...p,step:"new"}));
                  }} style={{ flex:2,padding:13 }}>ถัดไป</button>
                </div>
              </div>
            )}

            {pinChange.step==="new"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <label style={{ fontSize:13,fontWeight:600,color:"#666" }}>PIN ใหม่ (4-6 หลัก)</label>
                <input type="password" inputMode="numeric" autoFocus maxLength={6} placeholder="• • • •" value={pinChange.newPin}
                  onChange={e=>setPinChange(p=>({...p,newPin:e.target.value.replace(/\D/g,"")}))}
                  style={{ padding:"14px 16px",fontSize:20,letterSpacing:"0.3em",textAlign:"center" }}/>
                <label style={{ fontSize:13,fontWeight:600,color:"#666" }}>ยืนยัน PIN ใหม่</label>
                <input type="password" inputMode="numeric" maxLength={6} placeholder="• • • •" value={pinChange.confirmPin}
                  onChange={e=>setPinChange(p=>({...p,confirmPin:e.target.value.replace(/\D/g,"")}))}
                  style={{ padding:"14px 16px",fontSize:20,letterSpacing:"0.3em",textAlign:"center" }}/>
                <div style={{ fontSize:11,color:"#777",lineHeight:1.5,background:"#f8f9ff",padding:"8px 12px",borderRadius:8 }}>
                  ระบบจะส่งโค้ดยืนยัน 6 หลักไปที่ <b>{PIN_NOTIFY_EMAIL}</b> ก่อนเปลี่ยน PIN
                </div>
                <div style={{ display:"flex",gap:10,marginTop:6 }}>
                  <button className="btn btn-ghost" onClick={()=>setPinChange(p=>({...p,step:"old"}))} style={{ flex:1,padding:13 }}>← ย้อน</button>
                  <button className="btn btn-primary" disabled={pinChange.newPin.length<4||pinChange.newPin!==pinChange.confirmPin||saving} onClick={async()=>{
                    if (pinChange.newPin.length<4) { showToast("PIN ใหม่อย่างน้อย 4 หลัก","err"); return; }
                    if (pinChange.newPin!==pinChange.confirmPin) { showToast("PIN ไม่ตรงกัน","err"); return; }
                    const code = genCode6();
                    const pendingHash = await sha256Hex(pinChange.newPin);
                    const expires = Date.now() + 5*60*1000;
                    setSaving(true);
                    try {
                      const res = await apiPost("notifyPinChange", { code, email: PIN_NOTIFY_EMAIL, ts: new Date().toISOString() });
                      if (res && res.ok) {
                        setPinChange(p=>({...p,step:"verify",code,pendingHash,codeSent:true,codeExpires:expires,codeInput:""}));
                        showToast("ส่งโค้ดยืนยันไปทางอีเมลแล้ว");
                      } else {
                        showToast("ส่งอีเมลไม่สำเร็จ: "+(res&&res.error?res.error:"ตรวจสอบ Apps Script"),"err");
                      }
                    } catch {
                      showToast("ส่งอีเมลไม่สำเร็จ — ตรวจการ deploy Apps Script","err");
                    }
                    setSaving(false);
                  }} style={{ flex:2,padding:13 }}>{saving?"กำลังส่ง...":"ส่งโค้ดยืนยัน"}</button>
                </div>
              </div>
            )}

            {pinChange.step==="verify"&&(
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ fontSize:13,color:"#666",textAlign:"center",lineHeight:1.6 }}>
                  ส่งโค้ดยืนยันไปที่<br/><b>{PIN_NOTIFY_EMAIL}</b>
                </div>
                <label style={{ fontSize:13,fontWeight:600,color:"#666" }}>กรอกโค้ด 6 หลักจากอีเมล</label>
                <input type="text" inputMode="numeric" autoFocus maxLength={6} placeholder="••••••" value={pinChange.codeInput}
                  onChange={e=>setPinChange(p=>({...p,codeInput:e.target.value.replace(/\D/g,"")}))}
                  style={{ padding:"14px 16px",fontSize:22,letterSpacing:"0.4em",textAlign:"center" }}/>
                <div style={{ fontSize:11,color:"#888",textAlign:"center" }}>
                  โค้ดจะหมดอายุภายใน 5 นาที — {(()=>{ const remain = Math.max(0, Math.ceil((pinChange.codeExpires - Date.now())/1000)); return `${Math.floor(remain/60)}:${String(remain%60).padStart(2,"0")}`; })()}
                </div>
                <div style={{ display:"flex",gap:10,marginTop:6 }}>
                  <button className="btn btn-ghost" onClick={()=>setPinChange(p=>({...p,step:"new"}))} style={{ flex:1,padding:13 }}>← ย้อน</button>
                  <button className="btn btn-primary" disabled={pinChange.codeInput.length<6} onClick={async()=>{
                    if (Date.now() > pinChange.codeExpires) { showToast("โค้ดหมดอายุ — ส่งใหม่อีกครั้ง","err"); return; }
                    if (pinChange.codeInput !== pinChange.code) { showToast("โค้ดไม่ถูกต้อง","err"); return; }
                    localStorage.setItem(PIN_HASH_KEY, pinChange.pendingHash);
                    setShowChangePin(false);
                    showToast("เปลี่ยน PIN สำเร็จ ✅");
                  }} style={{ flex:2,padding:13 }}>ยืนยันเปลี่ยน PIN</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DELETE INSTALLMENT CONFIRM */}
      {deleteInstId!==null&&(()=>{
        const inst = installments.find(i=>i.id===deleteInstId);
        if (!inst) return null;
        return (
          <div className="modal-bg" onClick={()=>setDeleteInstId(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
              <div style={{ fontSize:36,textAlign:"center",marginBottom:10 }}>🗑️</div>
              <div style={{ fontWeight:800,fontSize:17,textAlign:"center",marginBottom:8 }}>ยืนยันการลบ{instLabel(inst.kind)}</div>
              <div style={{ color:"#666",textAlign:"center",marginBottom:6,fontSize:14 }}>
                <b>{inst.name}</b>
              </div>
              <div style={{ color:"#888",textAlign:"center",marginBottom:14,fontSize:13 }}>
                📁 {inst.project} · {scopeLabel(inst.scope)} · {inst.workCategory}<br/>
                {inst.kind==="payable"?"-":"+"}฿{fmt(inst.amount)} · 📅 {fmtDate(inst.dueDate)}
              </div>
              <div style={{ background:"#fff3e0",border:"1px solid #ffcc80",borderRadius:8,padding:"8px 12px",marginBottom:16,fontSize:12,color:"#bf360c" }}>
                ⚠️ การลบจะถาวร ไม่สามารถย้อนกลับได้
              </div>
              <div style={{ display:"flex",gap:10 }}>
                <button className="btn btn-ghost" onClick={()=>setDeleteInstId(null)} style={{ flex:1,padding:13 }}>ยกเลิก</button>
                <button className="btn btn-red" onClick={()=>{ deleteInstallment(inst.id); setDeleteInstId(null); }} style={{ flex:1,padding:13,fontSize:14 }}>ลบ{instLabel(inst.kind)}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DELETE PROJECT CONFIRM (two-step) */}
      {deleteProj&&(()=>{
        const entriesCount = entries.filter(e=>e.project===deleteProj).length;
        const instCount = installments.filter(i=>i.project===deleteProj).length;
        const totalItems = entriesCount + instCount;
        const canConfirm = deleteProjConfirm.trim() === deleteProj && !saving;
        return (
          <div className="modal-bg" onClick={()=>{ if(!saving){ setDeleteProj(null); setDeleteProjConfirm(""); } }}>
            <div className="modal" onClick={e=>e.stopPropagation()} style={{ borderTop:"4px solid #c62828" }}>
              <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
              <div style={{ fontSize:38,textAlign:"center",marginBottom:8 }}>⚠️</div>
              <div style={{ fontWeight:800,fontSize:18,textAlign:"center",marginBottom:14,color:"#c62828" }}>ยืนยันการลบโครงการ</div>
              <div style={{ background:"#ffebee",border:"1.5px solid #ef9a9a",borderRadius:10,padding:"12px 14px",marginBottom:16 }}>
                <div style={{ fontSize:13,color:"#b71c1c",marginBottom:8,fontWeight:600 }}>การลบจะทำให้ข้อมูลต่อไปนี้หายไปถาวร:</div>
                <div style={{ fontSize:14,color:"#b71c1c",marginBottom:3 }}>• โครงการ <b>"{deleteProj}"</b></div>
                <div style={{ fontSize:14,color:"#b71c1c",marginBottom:3 }}>• <b>{entriesCount}</b> รายการบัญชี</div>
                <div style={{ fontSize:14,color:"#b71c1c" }}>• <b>{instCount}</b> งวดงาน</div>
                <div style={{ fontSize:13,color:"#c62828",marginTop:10,paddingTop:10,borderTop:"1px solid #ffcdd2",fontWeight:700 }}>
                  รวม {totalItems} รายการที่จะหายไป
                </div>
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12,color:"#666",fontWeight:600,display:"block",marginBottom:8 }}>
                  พิมพ์ชื่อโครงการ <b style={{ color:"#c62828" }}>"{deleteProj}"</b> เพื่อยืนยัน:
                </label>
                <input
                  type="text"
                  value={deleteProjConfirm}
                  onChange={e=>setDeleteProjConfirm(e.target.value)}
                  placeholder={deleteProj}
                  autoFocus
                  style={{ borderColor: canConfirm ? "#c62828" : "#e0e4f0" }}
                />
              </div>
              <div style={{ display:"flex",gap:10 }}>
                <button
                  className="btn btn-ghost"
                  onClick={()=>{ setDeleteProj(null); setDeleteProjConfirm(""); }}
                  disabled={saving}
                  style={{ flex:1,padding:13 }}
                >ยกเลิก</button>
                <button
                  className="btn"
                  disabled={!canConfirm}
                  onClick={async()=>{
                    if (!canConfirm) return;
                    const name = deleteProj;
                    await doDeleteProject(name);
                    setDeleteProj(null);
                    setDeleteProjConfirm("");
                  }}
                  style={{
                    flex:1,padding:13,fontSize:14,
                    background: canConfirm ? "#c62828" : "#bbb",
                    color:"#fff",
                    cursor: canConfirm ? "pointer" : "not-allowed",
                  }}
                >
                  {saving?"กำลังลบ...":"ยืนยันลบ"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOAST */}
      {toast&&(
        <div className="toast" style={{ background:toast.type==="err"?"#c62828":"#1b5e20",color:"#fff" }}>
          {toast.type==="err"?"⚠️":"✅"} {toast.msg}
        </div>
      )}
    </div>
  );
}
