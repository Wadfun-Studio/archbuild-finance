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
interface ProjectTaxSettings { hasVat: boolean; hasWht: boolean; whtRate: number; }
interface Installment { id: number; kind: InstKind; project: string; name: string; description?: string; amount: number; dueDate: string; status: InstStatus; invoiceNo?: string; receiptNo?: string; hasVat?: boolean; hasWht?: boolean; whtRate?: number; }
interface FormState { date: string; type: string; category: string; project: string; description: string; amount: string; useVat: boolean; useWht: boolean; }
interface InstForm { kind: InstKind; project: string; name: string; description: string; amount: string; dueDate: string; }

const defaultTaxSettings: ProjectTaxSettings = { hasVat: false, hasWht: false, whtRate: 3 };

const instLabel = (kind: InstKind) => kind==="payable" ? "งวดจ่าย" : "งวดเบิก";
const instDoneLabel = (kind: InstKind) => kind==="payable" ? "จ่ายแล้ว" : "รับแล้ว";
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
  const [filterType, setFilterType] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [form, setForm] = useState<FormState>({ date:today(), type:"income", category:CATS_IN[0], project:"", description:"", amount:"", useVat:false, useWht:false });
  const [editId, setEditId] = useState<number|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number|null>(null);
  const [showProjMgr, setShowProjMgr] = useState(false);
  const [newProj, setNewProj] = useState("");
  const [toast, setToast] = useState<{msg:string,type:string}|null>(null);
  const [showInstForm, setShowInstForm] = useState(false);
  const [instForm, setInstForm] = useState<InstForm>({ kind:"receivable", project:"", name:"งวดที่ 1", description:"", amount:"", dueDate:"" });
  const [instTab, setInstTab] = useState<InstKind>("receivable");
  const [showTaxSummary, setShowTaxSummary] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string|null>(null);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string,boolean>>({});
  const [projectTax, setProjectTax] = useState<Record<string, ProjectTaxSettings>>({});
  const [pendingTaxPropagate, setPendingTaxPropagate] = useState<{ name: string; next: ProjectTaxSettings }|null>(null);

  function toggleGroup(key: string) {
    setCollapsedGroups(s => ({ ...s, [key]: !s[key] }));
  }

  const getProjectTax = useCallback((name: string): ProjectTaxSettings => projectTax[name] || defaultTaxSettings, [projectTax]);

  function saveProjectTax(map: Record<string, ProjectTaxSettings>) {
    setProjectTax(map);
    localStorage.setItem("wf_project_tax", JSON.stringify(map));
  }

  function updateProjectTaxField(name: string, partial: Partial<ProjectTaxSettings>) {
    const next: ProjectTaxSettings = { ...getProjectTax(name), ...partial };
    saveProjectTax({ ...projectTax, [name]: next });
    if (installments.some(i => i.project === name)) {
      setPendingTaxPropagate({ name, next });
    }
  }

  function propagateTaxToInstallments(name: string, t: ProjectTaxSettings) {
    saveInstallments(installments.map(i => i.project === name ? { ...i, hasVat: t.hasVat, hasWht: t.hasWht, whtRate: t.whtRate } : i));
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
      // load installments from localStorage (migrate older records without kind)
      const saved = localStorage.getItem("wf_installments");
      if (saved) {
        const list: Installment[] = JSON.parse(saved).map((i: Installment & {kind?: InstKind}) => ({ ...i, kind: i.kind || "receivable" }));
        setInstallments(list);
      }
      // load per-project tax settings
      const taxSaved = localStorage.getItem("wf_project_tax");
      if (taxSaved) setProjectTax(JSON.parse(taxSaved));
    } catch { setError("เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต"); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Push notification setup
  useEffect(() => {
    if ("Notification" in window) {
      setNotifGranted(Notification.permission === "granted");
    }
  }, []);

  // Check installments and notify (payables: 3-day window, receivables: 7-day window)
  useEffect(() => {
    if (!notifGranted || installments.length === 0) return;
    installments.filter(i => i.status === "pending").forEach(inst => {
      const days = daysUntil(inst.dueDate);
      if (days < 0) return;
      const window = inst.kind === "payable" ? 3 : 7;
      if (days > window) return;
      const icon = inst.kind === "payable" ? "💸" : "💰";
      new Notification(`${icon} ครบกำหนด${instLabel(inst.kind)}: ${inst.name}`, {
        body: `โครงการ ${inst.project} — ฿${fmt(inst.amount)} — อีก ${days} วัน (${fmtDate(inst.dueDate)})`,
        icon: "/favicon.ico"
      });
    });
  }, [notifGranted, installments]);

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
    if (!instForm.project || !instForm.name || !instForm.amount || !instForm.dueDate) { showToast("กรอกข้อมูลให้ครบ", "err"); return; }
    const t = getProjectTax(instForm.project);
    const newInst: Installment = { id: Date.now(), kind: instForm.kind, project: instForm.project, name: instForm.name, description: instForm.description.trim() || undefined, amount: +instForm.amount, dueDate: instForm.dueDate, status: "pending", hasVat: t.hasVat, hasWht: t.hasWht, whtRate: t.whtRate };
    saveInstallments([...installments, newInst]);
    setShowInstForm(false);
    setInstForm({ kind: instForm.kind, project: projects[0]||"", name:"งวดที่ 1", description:"", amount:"", dueDate:"" });
    showToast(`เพิ่ม${instLabel(instForm.kind)}แล้ว`);
  }

  function toggleInstallment(inst: Installment) {
    const next: InstStatus = inst.status === "pending" ? instDoneStatus(inst.kind) : "pending";
    saveInstallments(installments.map(i => i.id === inst.id ? {...i, status: next} : i));
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

  function openAdd(type: "income"|"expense" = "income") {
    setEditId(null);
    setForm({ date:today(), type, category: type==="income"?CATS_IN[0]:CATS_EX[0], project:projects[0]||"", description:"", amount:"", useVat:false, useWht:false });
    setShowForm(true);
  }
  function openEdit(e: Entry) { setEditId(e.id); setForm({...e, amount:String(e.amount), useVat:!!e.vat, useWht:!!e.wht}); setShowForm(true); }
  function handleTypeChange(type: string) { setForm(f=>({...f, type, category:type==="income"?CATS_IN[0]:CATS_EX[0]})); }

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

  async function removeProject(p: string) {
    if (entries.some(e=>e.project===p)) { showToast("ไม่สามารถลบโครงการที่มีรายการอยู่","err"); return; }
    setSaving(true);
    try { await apiGet("deleteProject",{name:p}); setProjects(ps=>ps.filter(x=>x!==p)); }
    catch { showToast("ลบโครงการไม่สำเร็จ","err"); }
    setSaving(false);
  }

  function exportCSV() {
    const rows=[["วันที่","ประเภท","หมวดหมู่","โครงการ","รายละเอียด","จำนวน","VAT","หัก ณ ที่จ่าย"]];
    filtered.forEach(e=>rows.push([e.date, e.type==="income"?"รายรับ":"รายจ่าย", e.category, e.project, e.description, String(e.amount), String(e.vat||0), String(e.wht||0)]));
    const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${c.replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    a.download=`บัญชี_${today()}.csv`; a.click(); showToast("ส่งออก CSV สำเร็จ");
  }

  const totalIncome = useMemo(()=>entries.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0),[entries]);
  const totalExpense = useMemo(()=>entries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0),[entries]);
  const totalOverhead = useMemo(()=>entries.filter(e=>e.type==="expense"&&isOverhead(e.category)).reduce((s,e)=>s+e.amount,0),[entries]);
  const totalProjectExpense = totalExpense - totalOverhead;
  const overheadPct = totalIncome > 0 ? (totalOverhead/totalIncome)*100 : 0;
  const totalVat = useMemo(()=>entries.reduce((s,e)=>s+(e.vat||0),0),[entries]);
  const totalWht = useMemo(()=>entries.reduce((s,e)=>s+(e.wht||0),0),[entries]);
  const net = totalIncome - totalExpense;

  // Monthly cash flow with cumulative balance
  const monthlyCashflow = useMemo(()=>{
    const map: Record<string,{inflow:number,outflow:number}> = {};
    entries.forEach(e=>{
      const m = String(e.date).slice(0,7);
      if(!map[m]) map[m] = {inflow:0,outflow:0};
      if (e.type==="income") map[m].inflow += e.amount;
      else map[m].outflow += e.amount;
    });
    const list = Object.entries(map).sort(([a],[b])=>a.localeCompare(b));
    let cumulative = 0;
    return list.map(([month,v])=>{
      const n = v.inflow - v.outflow;
      cumulative += n;
      return { month, inflow:v.inflow, outflow:v.outflow, net:n, cumulative };
    });
  },[entries]);

  // All-time tax breakdown split by side
  const taxBreakdown = useMemo(()=>{
    const outputVat = entries.filter(e=>e.type==="income").reduce((s,e)=>s+(e.vat||0),0);
    const inputVat  = entries.filter(e=>e.type==="expense").reduce((s,e)=>s+(e.vat||0),0);
    const whtCredit = entries.filter(e=>e.type==="income").reduce((s,e)=>s+(e.wht||0),0);
    const whtRemit  = entries.filter(e=>e.type==="expense").reduce((s,e)=>s+(e.wht||0),0);
    return {
      outputVat, inputVat, vatNet: outputVat - inputVat,
      whtCredit, whtRemit, whtNet: whtRemit - whtCredit,
    };
  },[entries]);

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
    const mEntries = entries.filter(e=>String(e.date).slice(0,7)===monthStr);
    const outputVat = mEntries.filter(e=>e.type==="income").reduce((s,e)=>s+(e.vat||0),0);
    const inputVat  = mEntries.filter(e=>e.type==="expense").reduce((s,e)=>s+(e.vat||0),0);
    const whtCredit = mEntries.filter(e=>e.type==="income").reduce((s,e)=>s+(e.wht||0),0);
    const whtRemit  = mEntries.filter(e=>e.type==="expense").reduce((s,e)=>s+(e.wht||0),0);
    const vatNet = outputVat - inputVat;
    const vatRemit = Math.max(0, vatNet); // negative = refundable, no remit due
    const totalRemit = vatRemit + whtRemit;
    const daysToDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    return { monthStr, dueDate, daysToDue, outputVat, inputVat, vatNet, vatRemit, whtCredit, whtRemit, totalRemit, isDueToday: day===15 };
  },[entries]);

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
    if (!notifGranted) return;
    if (!vatDueInfo.isDueToday || vatDueInfo.totalRemit <= 0) return;
    new Notification("🧾 วันนี้ครบกำหนดยื่นภาษี", {
      body: `เดือน ${vatDueInfo.monthStr} — นำส่ง VAT ฿${fmt(vatDueInfo.vatRemit)} + WHT ฿${fmt(vatDueInfo.whtRemit)} = ฿${fmt(vatDueInfo.totalRemit)}`,
      icon: "/favicon.ico"
    });
  }, [notifGranted, vatDueInfo]);

  const hasUserFilter = filterType!=="all"||filterProject!=="all"||!!dateFrom||!!dateTo;
  const filtered = useMemo(()=>{
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-5);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    return entries.filter(e=>{
      if (filterType!=="all"&&e.type!==filterType) return false;
      if (filterProject!=="all"&&e.project!==filterProject) return false;
      if (dateFrom&&String(e.date).slice(0,10)<dateFrom) return false;
      if (dateTo&&String(e.date).slice(0,10)>dateTo) return false;
      // Default window: last 5 days when no user filter is set
      if (!hasUserFilter && String(e.date).slice(0,10) < cutoffStr) return false;
      return true;
    }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  },[entries,filterType,filterProject,dateFrom,dateTo,hasUserFilter]);

  const filteredIncome = filtered.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
  const filteredExpense = filtered.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const cats = form.type==="income"?CATS_IN:CATS_EX;

  const pendingInst = installments.filter(i=>i.status==="pending");
  const urgentInst = pendingInst.filter(i=>daysUntil(i.dueDate)<=7&&daysUntil(i.dueDate)>=0);

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
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",height:58 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:36,height:36,background:"linear-gradient(135deg,#1565c0,#42a5f5)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>🏗️</div>
              <div>
                <div style={{ fontWeight:800,fontSize:15 }}>Wadfun Finance</div>
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

        {/* DASHBOARD */}
        {view==="dashboard"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
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
                <button className="btn btn-ghost" style={{ fontSize:12,padding:"6px 12px" }} onClick={()=>setView("list")}>ดูทั้งหมด →</button>
              </div>
              {entries.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"32px 0",fontSize:14 }}>ยังไม่มีรายการ</div>
              :(()=>{
                const recent = [...entries].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10);
                const groups: Record<string, Entry[]> = {};
                recent.forEach(e=>{ const k = e.project || "ไม่ระบุโครงการ"; if(!groups[k]) groups[k]=[]; groups[k].push(e); });
                // sort groups by most recent entry date desc
                const groupKeys = Object.keys(groups).sort((a,b)=>String(groups[b][0].date).localeCompare(String(groups[a][0].date)));
                return groupKeys.map((projName,gIdx)=>{
                  const list = groups[projName];
                  const gIncome = list.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
                  const gExpense = list.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
                  const gNet = gIncome - gExpense;
                  const groupKey = `dash:${projName}`;
                  const collapsed = !!collapsedGroups[groupKey];
                  return (
                    <div key={projName} style={{ marginTop:gIdx===0?0:14 }}>
                      <button onClick={()=>toggleGroup(groupKey)} aria-expanded={!collapsed} style={{ width:"100%",textAlign:"left",cursor:"pointer",background:"linear-gradient(90deg,#eff3fb,transparent)",border:"none",borderLeft:"4px solid #1565c0",padding:"10px 12px",borderRadius:"8px 8px 0 0",marginBottom:collapsed?0:4,fontFamily:"inherit" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8 }}>
                          <span style={{ fontWeight:800,fontSize:15,color:"#1a1a2e",display:"flex",alignItems:"center",gap:6 }}>
                            <span style={{ display:"inline-block",transform:collapsed?"rotate(-90deg)":"rotate(0)",transition:"transform .15s",color:"#1565c0",fontSize:12 }}>▼</span>
                            📁 {projName}
                          </span>
                          <span style={{ fontSize:11,color:"#888",fontWeight:600 }}>{list.length} รายการ</span>
                        </div>
                        <div style={{ display:"flex",gap:10,marginTop:4,fontSize:12,flexWrap:"wrap" }}>
                          <span style={{ color:"#2e7d32",fontWeight:700 }}>↑ ฿{fmt(gIncome)}</span>
                          <span style={{ color:"#c62828",fontWeight:700 }}>↓ ฿{fmt(gExpense)}</span>
                          <span style={{ color:gNet>=0?"#1565c0":"#c62828",fontWeight:800,marginLeft:"auto" }}>สุทธิ {gNet>=0?"+":""}฿{fmt(gNet)}</span>
                        </div>
                      </button>
                      {!collapsed&&list.map((e,i)=>(
                        <div key={e.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderBottom:i<list.length-1?"1px solid #f5f5f5":"none" }}>
                          <div style={{ width:34,height:34,borderRadius:10,background:e.type==="income"?"#e8f5e9":"#ffebee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0 }}>{e.type==="income"?"↑":"↓"}</div>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.description}</div>
                            <div style={{ fontSize:11,color:"#bbb",marginTop:2 }}>{e.category} · {fmtDate(String(e.date).slice(0,10))}</div>
                          </div>
                          <div style={{ textAlign:"right",flexShrink:0 }}>
                            <div style={{ fontWeight:800,fontSize:14,color:e.type==="income"?"#2e7d32":"#c62828" }}>{e.type==="income"?"+":"-"}฿{fmt(e.amount)}</div>
                            {(e.vat||e.wht)?<div style={{ fontSize:10,color:"#aaa" }}>{e.vat?`${e.type==="income"?"Out":"In"} VAT ฿${fmt(e.vat)} `:""}{e.wht?`WHT ${e.type==="income"?"เครดิต":"นำส่ง"} ฿${fmt(e.wht)}`:""}</div>:null}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* LIST */}
        {view==="list"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              <button className="btn btn-green" onClick={()=>openAdd("income")} style={{ padding:14,fontSize:14 }}>💰 + เพิ่มรายรับ</button>
              <button className="btn btn-red" onClick={()=>openAdd("expense")} style={{ padding:14,fontSize:14 }}>💸 + เพิ่มรายจ่าย</button>
            </div>
            <div className="card" style={{ padding:"14px 16px" }}>
              <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ flex:1,minWidth:120,fontSize:14 }}>
                  <option value="all">ทุกประเภท</option><option value="income">รายรับ</option><option value="expense">รายจ่าย</option>
                </select>
                <select value={filterProject} onChange={e=>setFilterProject(e.target.value)} style={{ flex:1,minWidth:150,fontSize:14 }}>
                  <option value="all">ทุกโครงการ</option>{projects.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ display:"flex",gap:8,marginTop:8 }}>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ flex:1,fontSize:14 }}/>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ flex:1,fontSize:14 }}/>
              </div>
              <div style={{ display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap" }}>
                {!hasUserFilter&&<span style={{ fontSize:11,color:"#1565c0",background:"#e3f2fd",padding:"4px 10px",borderRadius:20,fontWeight:600 }}>📅 5 วันล่าสุด</span>}
                {hasUserFilter&&<button className="btn btn-ghost" style={{ fontSize:12,padding:"7px 12px" }} onClick={()=>{setFilterType("all");setFilterProject("all");setDateFrom("");setDateTo("");}}>✕ ล้าง</button>}
                <button className="btn btn-outline" style={{ fontSize:12,padding:"7px 12px" }} onClick={exportCSV}>⬇ CSV</button>
                <span style={{ marginLeft:"auto",fontSize:12,color:"#aaa" }}>{filtered.length} รายการ</span>
              </div>
              {filtered.length>0&&(
                <div style={{ display:"flex",gap:16,marginTop:10,paddingTop:10,borderTop:"1px solid #f0f0f0" }}>
                  <span style={{ fontSize:12,color:"#2e7d32",fontWeight:700 }}>รับ ฿{fmt(filteredIncome)}</span>
                  <span style={{ fontSize:12,color:"#c62828",fontWeight:700 }}>จ่าย ฿{fmt(filteredExpense)}</span>
                  <span style={{ fontSize:12,color:filteredIncome-filteredExpense>=0?"#1565c0":"#c62828",fontWeight:800 }}>
                    สุทธิ {filteredIncome-filteredExpense>=0?"+":""}฿{fmt(filteredIncome-filteredExpense)}
                  </span>
                </div>
              )}
            </div>
            {filtered.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"48px 0",fontSize:14 }}>{hasUserFilter?"ไม่พบรายการ":"ไม่มีรายการใน 5 วันล่าสุด"}</div>
            :filtered.map(e=>(
              <div key={e.id} className="card" style={{ padding:"14px 16px" }}>
                <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                  <div style={{ width:40,height:40,borderRadius:12,background:e.type==="income"?"#e8f5e9":"#ffebee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>
                    {e.type==="income"?"↑":"↓"}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",gap:8 }}>
                      <div style={{ fontWeight:700,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{e.description}</div>
                      <div style={{ textAlign:"right",flexShrink:0 }}>
                        <div style={{ fontWeight:800,fontSize:15,color:e.type==="income"?"#2e7d32":"#c62828" }}>
                          {e.type==="income"?"+":"-"}฿{fmt(e.amount)}
                        </div>
                        {(e.vat||e.wht)&&<div style={{ fontSize:10,color:"#aaa" }}>
                          {e.vat?`${e.type==="income"?"Out":"In"} VAT ฿${fmt(e.vat)} `:""}{e.wht?`WHT ${e.type==="income"?"เครดิต":"นำส่ง"} ฿${fmt(e.wht)}`:""}
                        </div>}
                      </div>
                    </div>
                    <div style={{ display:"flex",gap:6,marginTop:5,flexWrap:"wrap" }}>
                      <span className={`badge badge-${e.type}`}>{e.type==="income"?"รายรับ":"รายจ่าย"}</span>
                      <span className="tag">{e.category}</span>
                      <span style={{ fontSize:11,color:"#bbb" }}>{fmtDate(String(e.date).slice(0,10))}</span>
                    </div>
                    <div style={{ fontSize:11,color:"#bbb",marginTop:3 }}>📁 {e.project}</div>
                    <div style={{ display:"flex",gap:8,marginTop:10 }}>
                      <button className="btn btn-ghost" onClick={()=>openEdit(e)} style={{ flex:1,fontSize:13,padding:8 }}>✏️ แก้ไข</button>
                      <button className="btn btn-red" onClick={()=>setDeleteId(e.id)} style={{ flex:1,fontSize:13,padding:8 }}>🗑️ ลบ</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
          const projEntries = entries.filter(e=>e.project===proj).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
          const pIncome = projEntries.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
          const pExpense = projEntries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
          const pNet = pIncome - pExpense;
          const margin = pIncome>0 ? (pNet/pIncome)*100 : 0;
          const projInst = installments.filter(i=>i.project===proj);
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

              {/* Project tax settings */}
              {(()=>{
                const pt = getProjectTax(proj);
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
                    <div className="stitle" style={{ marginBottom:10 }}>⚙️ ภาษีของโครงการ</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                      {checkboxRow(pt.hasVat, "VAT 7%", ()=>updateProjectTaxField(proj, { hasVat: !pt.hasVat }))}
                      {checkboxRow(pt.hasWht, `หัก ณ ที่จ่าย ${pt.hasWht?pt.whtRate:""}${pt.hasWht?"%":""}`.trim(), ()=>updateProjectTaxField(proj, { hasWht: !pt.hasWht }),
                        pt.hasWht ? (
                          <div style={{ display:"flex",alignItems:"center",gap:4 }} onClick={e=>e.stopPropagation()}>
                            <input type="number" min="0" max="50" step="0.5" value={pt.whtRate} onChange={e=>updateProjectTaxField(proj, { whtRate: +e.target.value })} style={{ width:64,padding:"6px 8px",fontSize:13,textAlign:"center" }}/>
                            <span style={{ fontSize:13,fontWeight:600,color:"#1b5e20" }}>%</span>
                          </div>
                        ) : undefined
                      )}
                    </div>
                    <div style={{ marginTop:8,fontSize:11,color:"#888" }}>ค่านี้จะถูก lock ลงในงวดใหม่ที่สร้างต่อไปอัตโนมัติ</div>
                  </div>
                );
              })()}

              {/* P&L summary card */}
              <div className="card" style={{ padding:0,overflow:"hidden" }}>
                <div style={{ padding:"12px 16px",background:"#f8f9ff",borderBottom:"1px solid #eef0f8",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div className="stitle" style={{ margin:0 }}>กำไรขาดทุน (P&amp;L)</div>
                  <div style={{ fontSize:11,color:"#aaa" }}>{projEntries.length} รายการ</div>
                </div>
                <div style={{ padding:"4px 16px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid #f0f0f0" }}>
                    <span style={{ fontSize:14,color:"#666" }}>รายรับรวม</span>
                    <span style={{ fontSize:15,fontWeight:700,color:"#2e7d32" }}>+฿{fmt(pIncome)}</span>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid #f0f0f0" }}>
                    <span style={{ fontSize:14,color:"#666" }}>รายจ่ายรวม</span>
                    <span style={{ fontSize:15,fontWeight:700,color:"#c62828" }}>-฿{fmt(pExpense)}</span>
                  </div>
                  <div style={{ display:"flex",justifyContent:"space-between",padding:"14px 0",borderTop:"2px solid #e0e0e0",marginTop:2,background:pNet>=0?"linear-gradient(90deg,#e8f5e9,transparent)":"linear-gradient(90deg,#ffebee,transparent)",margin:"0 -16px",paddingLeft:16,paddingRight:16 }}>
                    <span style={{ fontSize:15,fontWeight:800 }}>{pNet>=0?"📈 กำไรสุทธิ":"📉 ขาดทุนสุทธิ"}</span>
                    <span style={{ fontSize:18,fontWeight:800,color:pNet>=0?"#2e7d32":"#c62828" }}>{pNet>=0?"+":"-"}฿{fmt(Math.abs(pNet))}</span>
                  </div>
                  <div style={{ padding:"10px 0",fontSize:12,color:"#888",textAlign:"right" }}>
                    Margin: <b style={{ color:margin>=0?"#2e7d32":"#c62828" }}>{margin.toFixed(2)}%</b>
                  </div>
                </div>
              </div>

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

              <button className="btn" style={{ width:"100%",padding:14,fontSize:15,background:accent,color:"#fff" }} onClick={()=>{ setInstForm({kind:instTab,project:proj,name:`${instLabel(instTab)}ที่ ${tabList.length+1}`,description:"",amount:"",dueDate:""}); setShowInstForm(true); }}>
                + เพิ่ม{instLabel(instTab)}สำหรับโครงการนี้
              </button>

              {tabList.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"48px 0",fontSize:14 }}>ยังไม่มี{instLabel(instTab)}สำหรับโครงการนี้</div>
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
                      <button className="btn btn-red" onClick={()=>deleteInstallment(inst.id)} style={{ flex:1,fontSize:13,padding:8 }}>🗑️ ลบ</button>
                    </div>
                  </div>
                );
              })}

              {/* Statement section — collapsible per project */}
              {(()=>{
                const stmtKey = `stmt:${proj}`;
                const stmtCollapsed = !!collapsedGroups[stmtKey];
                return (
                  <div className="card" style={{ padding:0,overflow:"hidden",marginTop:4 }}>
                    <button onClick={()=>toggleGroup(stmtKey)} aria-expanded={!stmtCollapsed} style={{ width:"100%",textAlign:"left",cursor:"pointer",background:"linear-gradient(90deg,#eff3fb,transparent)",border:"none",borderLeft:"4px solid #1565c0",padding:"14px 16px",fontFamily:"inherit" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8 }}>
                        <span style={{ fontWeight:800,fontSize:15,color:"#1a1a2e",display:"flex",alignItems:"center",gap:6 }}>
                          <span style={{ display:"inline-block",transform:stmtCollapsed?"rotate(-90deg)":"rotate(0)",transition:"transform .15s",color:"#1565c0",fontSize:12 }}>▼</span>
                          📑 Statement (รายการทั้งหมด)
                        </span>
                        <span style={{ fontSize:11,color:"#888",fontWeight:600 }}>{projEntries.length} รายการ</span>
                      </div>
                      <div style={{ display:"flex",gap:10,marginTop:6,fontSize:12,flexWrap:"wrap" }}>
                        <span style={{ color:"#2e7d32",fontWeight:700 }}>รับ ฿{fmt(pIncome)}</span>
                        <span style={{ color:"#c62828",fontWeight:700 }}>จ่าย ฿{fmt(pExpense)}</span>
                        <span style={{ color:pNet>=0?"#1565c0":"#c62828",fontWeight:800,marginLeft:"auto" }}>{pNet>=0?"กำไร":"ขาดทุน"} {pNet>=0?"+":"-"}฿{fmt(Math.abs(pNet))}</span>
                      </div>
                    </button>
                    {!stmtCollapsed&&(()=>{
                      const incList = projEntries.filter(e=>e.type==="income");
                      const expList = projEntries.filter(e=>e.type==="expense");
                      if (projEntries.length===0) return (
                        <div style={{ padding:"4px 16px 12px" }}>
                          <div style={{ fontSize:13,color:"#ccc",textAlign:"center",padding:"20px 0" }}>ยังไม่มีรายการในโครงการนี้</div>
                        </div>
                      );
                      const column = (list: Entry[], total: number, side: "inc"|"exp") => {
                        const isInc = side==="inc";
                        const color = isInc ? "#2e7d32" : "#c62828";
                        const bg = isInc ? "#e8f5e9" : "#ffebee";
                        return (
                          <div style={{ background:"#fff",borderRadius:10,overflow:"hidden",border:`1px solid ${bg}` }}>
                            <div style={{ background:bg,padding:"8px 10px",fontSize:12,fontWeight:800,color,display:"flex",justifyContent:"space-between" }}>
                              <span>{isInc?"↑ รายรับ":"↓ รายจ่าย"}</span>
                              <span>{list.length}</span>
                            </div>
                            <div style={{ padding:"4px 10px",minHeight:60 }}>
                              {list.length===0?<div style={{ fontSize:11,color:"#ccc",textAlign:"center",padding:"16px 0" }}>—</div>
                              :list.map((e,i)=>(
                                <div key={e.id} style={{ padding:"8px 0",borderBottom:i<list.length-1?"1px solid #f5f5f5":"none" }}>
                                  <div style={{ fontSize:10,color:"#999" }}>{fmtDate(String(e.date).slice(0,10))} · {e.category}</div>
                                  <div style={{ fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1 }}>{e.description}</div>
                                  <div style={{ fontSize:13,fontWeight:800,color,marginTop:2 }}>{isInc?"+":"-"}฿{fmt(e.amount)}</div>
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
                            {column(incList, pIncome, "inc")}
                            {column(expList, pExpense, "exp")}
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

      </div>

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        {[{k:"dashboard",icon:"📊",l:"ภาพรวม"},{k:"list",icon:"📋",l:"รายการ"},{k:"installments",icon:"📁",l:"โครงการ"}].map(n=>(
          <button key={n.k} className={`bnav-btn${view===n.k?" active":""}`} onClick={()=>setView(n.k)}>
            <span>{n.icon}</span>{n.l}
            {n.k==="installments"&&urgentInst.length>0&&<div style={{ position:"absolute",top:6,background:"#c62828",color:"#fff",borderRadius:50,width:16,height:16,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>{urgentInst.length}</div>}
          </button>
        ))}
        <button className="bnav-btn" onClick={()=>setShowProjMgr(true)}><span>⚙️</span>ตั้งค่า</button>
      </div>

      <button className="fab" onClick={()=>openAdd()}>+</button>

      {/* ENTRY FORM */}
      {showForm&&(
        <div className="modal-bg" onClick={()=>setShowForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontWeight:800,fontSize:18,marginBottom:20 }}>{editId?"✏️ แก้ไขรายการ":"➕ เพิ่มรายการใหม่"}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <div style={{ display:"flex",borderRadius:12,overflow:"hidden",border:"1.5px solid #e0e4f0" }}>
                {[{v:"income",l:"💰 รายรับ",c:"#2e7d32"},{v:"expense",l:"💸 รายจ่าย",c:"#c62828"}].map(t=>(
                  <button key={t.v} onClick={()=>handleTypeChange(t.v)} style={{ flex:1,padding:13,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:15,fontWeight:700,background:form.type===t.v?t.c:"transparent",color:form.type===t.v?"#fff":"#bbb" }}>{t.l}</button>
                ))}
              </div>
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
            <div style={{ fontWeight:800,fontSize:18,marginBottom:20 }}>📆 เพิ่ม{instLabel(instForm.kind)}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
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
                {label:"ชื่องวด เช่น งวดที่ 1",el:<input type="text" placeholder="งวดที่ 1" value={instForm.name} onChange={e=>setInstForm(f=>({...f,name:e.target.value}))}/>},
                {label:"รายละเอียด (จะใช้แสดงในใบวางบิล/ใบเสร็จ)",el:<textarea placeholder={instForm.kind==="payable"?"เช่น งานก่อสร้างฐานราก งวดที่ 1":"เช่น ค่าจ้างออกแบบและควบคุมงาน งวดที่ 1"} value={instForm.description} onChange={e=>setInstForm(f=>({...f,description:e.target.value}))} rows={3} style={{ resize:"vertical",minHeight:80,lineHeight:1.5 }}/>},
                {label:"ยอดเงินงวด (บาท)",el:<input type="number" inputMode="decimal" placeholder="0.00" value={instForm.amount} onChange={e=>setInstForm(f=>({...f,amount:e.target.value}))}/>},
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

      {/* PROJECT MANAGER */}
      {showProjMgr&&(
        <div className="modal-bg" onClick={()=>setShowProjMgr(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontWeight:800,fontSize:18,marginBottom:18 }}>⚙️ จัดการโครงการ</div>
            <div style={{ display:"flex",gap:8,marginBottom:16 }}>
              <input placeholder="ชื่อโครงการใหม่..." value={newProj} onChange={e=>setNewProj(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()} style={{ flex:1 }}/>
              <button className="btn btn-green" onClick={addProject} disabled={saving} style={{ whiteSpace:"nowrap" }}>+ เพิ่ม</button>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8,maxHeight:300,overflowY:"auto" }}>
              {projects.map(p=>(
                <div key={p} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"#f8f9ff",borderRadius:10 }}>
                  <span style={{ fontSize:14 }}>{p}</span>
                  <button className="btn btn-red" onClick={()=>removeProject(p)} style={{ padding:"5px 12px",fontSize:12 }}>ลบ</button>
                </div>
              ))}
            </div>
            {!notifGranted&&(
              <button className="btn btn-orange" style={{ marginTop:16,width:"100%",padding:13 }} onClick={()=>{setShowProjMgr(false);requestNotifPermission();}}>
                🔔 เปิดการแจ้งเตือน Push Notification
              </button>
            )}
            <button className="btn btn-ghost" style={{ marginTop:12,width:"100%",padding:13 }} onClick={()=>setShowProjMgr(false)}>ปิด</button>
          </div>
        </div>
      )}

      {/* TAX PROPAGATE CONFIRM */}
      {pendingTaxPropagate&&(()=>{
        const { name, next } = pendingTaxPropagate;
        const affected = installments.filter(i=>i.project===name).length;
        return (
          <div className="modal-bg" onClick={()=>setPendingTaxPropagate(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
              <div style={{ fontSize:36,textAlign:"center",marginBottom:10 }}>🧾</div>
              <div style={{ fontWeight:800,fontSize:17,textAlign:"center",marginBottom:8 }}>อัปเดตงวดที่มีอยู่แล้วด้วยไหม?</div>
              <div style={{ color:"#666",textAlign:"center",marginBottom:14,fontSize:14 }}>
                คุณเพิ่งเปลี่ยนภาษีของโครงการ <b>{name}</b> มีงวดเดิม <b>{affected}</b> งวด
              </div>
              <div style={{ background:"#f8f9ff",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:13 }}>
                <div>VAT 7%: <b style={{ color:next.hasVat?"#2e7d32":"#999" }}>{next.hasVat?"เปิด ✓":"ปิด"}</b></div>
                <div>หัก ณ ที่จ่าย: <b style={{ color:next.hasWht?"#2e7d32":"#999" }}>{next.hasWht?`${next.whtRate}% ✓`:"ปิด"}</b></div>
              </div>
              <div style={{ display:"flex",gap:10 }}>
                <button className="btn btn-ghost" onClick={()=>setPendingTaxPropagate(null)} style={{ flex:1,padding:13 }}>ไม่ — ใช้กับงวดใหม่เท่านั้น</button>
                <button className="btn btn-primary" onClick={()=>{ propagateTaxToInstallments(name, next); setPendingTaxPropagate(null); showToast("อัปเดตภาษีของงวดเก่าแล้ว"); }} style={{ flex:1,padding:13 }}>ใช่ — อัปเดตทั้งหมด</button>
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

      {/* TOAST */}
      {toast&&(
        <div className="toast" style={{ background:toast.type==="err"?"#c62828":"#1b5e20",color:"#fff" }}>
          {toast.type==="err"?"⚠️":"✅"} {toast.msg}
        </div>
      )}
    </div>
  );
}
