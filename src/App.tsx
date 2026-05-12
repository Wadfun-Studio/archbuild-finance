import { useState, useMemo, useEffect, useCallback } from "react";

const API = "https://script.google.com/macros/s/AKfycbzCUVLVzXjRWSQri8XTjOrFh373mp_dU3PkCTODGPhyX1bsYNMWf1CxhS79ntUDer5IwA/exec";

const CATS_IN = ["ค่าออกแบบ","ค่าก่อสร้าง","ค่าที่ปรึกษา","ค่างวดโครงการ","รายได้อื่น ๆ"];
const CATS_EX = ["ค่าวัสดุก่อสร้าง","ค่าแรงงาน","ค่าเช่าเครื่องจักร","ค่าสาธารณูปโภค","เงินเดือนพนักงาน","ค่าซอฟต์แวร์/ใบอนุญาต","ค่าการตลาด","ค่าเดินทาง","ค่าใช้จ่ายอื่น ๆ"];
const VAT_RATE = 0.07;
const WHT_RATE = 0.03;

const fmt = (n: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2 }).format(n);
const fmtDate = (d: string) => { if (!d) return ""; return new Date(d).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" }); };
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);

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

interface Entry { id: number; date: string; type: string; category: string; project: string; description: string; amount: number; vat?: number; wht?: number; }
interface Installment { id: number; project: string; name: string; amount: number; dueDate: string; status: "pending"|"received"; }
interface FormState { date: string; type: string; category: string; project: string; description: string; amount: string; useVat: boolean; useWht: boolean; }
interface InstForm { project: string; name: string; amount: string; dueDate: string; }

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

function BarChart({ entries }: { entries: Entry[] }) {
  const months = useMemo(()=>{
    const map: Record<string,{income:number,expense:number}> = {};
    entries.forEach(e=>{ const m=String(e.date).slice(0,7); if(!map[m]) map[m]={income:0,expense:0}; map[m][e.type as "income"|"expense"]+=e.amount; });
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).slice(-6);
  },[entries]);
  if (!months.length) return <div style={{ color:"#bbb", fontSize:13 }}>ยังไม่มีข้อมูล</div>;
  const mx=Math.max(...months.flatMap(([,v])=>[v.income,v.expense]),1), H=100;
  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:12, minWidth:months.length*60 }}>
        {months.map(([m,v])=>{
          const [yr,mo]=m.split("-");
          return (
            <div key={m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:H }}>
                <div style={{ width:14, height:Math.max(4,(v.income/mx)*H), background:"linear-gradient(to top,#2e7d32,#66bb6a)", borderRadius:"3px 3px 0 0" }}/>
                <div style={{ width:14, height:Math.max(4,(v.expense/mx)*H), background:"linear-gradient(to top,#c62828,#ef5350)", borderRadius:"3px 3px 0 0" }}/>
              </div>
              <div style={{ fontSize:9, color:"#aaa" }}>{new Date(+yr,+mo-1).toLocaleDateString("th-TH",{month:"short"})}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:10, fontSize:11, color:"#888" }}>
        {[{c:"#66bb6a",l:"รายรับ"},{c:"#ef5350",l:"รายจ่าย"}].map(x=>(
          <span key={x.l} style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:9, height:9, background:x.c, borderRadius:2, display:"inline-block" }}/>{x.l}</span>
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
  const [instForm, setInstForm] = useState<InstForm>({ project:"", name:"งวดที่ 1", amount:"", dueDate:"" });
  const [showTaxSummary, setShowTaxSummary] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [eRes, pRes] = await Promise.all([apiGet("getAll"), apiGet("getProjects")]);
      if (eRes.ok) setEntries(eRes.entries);
      if (pRes.ok) setProjects(pRes.projects);
      // load installments from localStorage
      const saved = localStorage.getItem("wf_installments");
      if (saved) setInstallments(JSON.parse(saved));
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

  // Check installments and notify
  useEffect(() => {
    if (!notifGranted || installments.length === 0) return;
    installments.filter(i => i.status === "pending").forEach(inst => {
      const days = daysUntil(inst.dueDate);
      if (days <= 7 && days >= 0) {
        new Notification(`🔔 ครบกำหนดงวด: ${inst.name}`, {
          body: `โครงการ ${inst.project} — ฿${fmt(inst.amount)} — อีก ${days} วัน (${fmtDate(inst.dueDate)})`,
          icon: "/favicon.ico"
        });
      }
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
    const newInst: Installment = { id: Date.now(), project: instForm.project, name: instForm.name, amount: +instForm.amount, dueDate: instForm.dueDate, status: "pending" };
    saveInstallments([...installments, newInst]);
    setShowInstForm(false);
    setInstForm({ project: projects[0]||"", name:"งวดที่ 1", amount:"", dueDate:"" });
    showToast("เพิ่มงวดงานแล้ว");
  }

  function markInstallment(id: number, status: "pending"|"received") {
    saveInstallments(installments.map(i => i.id === id ? {...i, status} : i));
  }

  function deleteInstallment(id: number) {
    saveInstallments(installments.filter(i => i.id !== id));
    showToast("ลบงวดงานแล้ว", "err");
  }

  function showToast(msg: string, type="ok") { setToast({msg, type}); setTimeout(()=>setToast(null), 2800); }

  function openAdd() {
    setEditId(null);
    setForm({ date:today(), type:"income", category:CATS_IN[0], project:projects[0]||"", description:"", amount:"", useVat:false, useWht:false });
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
      const body = { ...form, amount:+form.amount, vat, wht };
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
  const totalVat = useMemo(()=>entries.reduce((s,e)=>s+(e.vat||0),0),[entries]);
  const totalWht = useMemo(()=>entries.reduce((s,e)=>s+(e.wht||0),0),[entries]);
  const net = totalIncome - totalExpense;

  const projectStats = useMemo(()=>{
    const map: Record<string,{income:number,expense:number}> = {};
    entries.forEach(e=>{ if(!map[e.project]) map[e.project]={income:0,expense:0}; map[e.project][e.type as "income"|"expense"]+=e.amount; });
    return Object.entries(map).map(([name,v])=>({name,...v,net:v.income-v.expense})).sort((a,b)=>b.net-a.net);
  },[entries]);

  const filtered = useMemo(()=>entries.filter(e=>{
    if (filterType!=="all"&&e.type!==filterType) return false;
    if (filterProject!=="all"&&e.project!==filterProject) return false;
    if (dateFrom&&String(e.date).slice(0,10)<dateFrom) return false;
    if (dateTo&&String(e.date).slice(0,10)>dateTo) return false;
    return true;
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date))),[entries,filterType,filterProject,dateFrom,dateTo]);

  const filteredIncome = filtered.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
  const filteredExpense = filtered.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const cats = form.type==="income"?CATS_IN:CATS_EX;
  const hasFilter = filterType!=="all"||filterProject!=="all"||dateFrom||dateTo;

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
            <div style={{ display:"flex",gap:8 }}>
              {!notifGranted && <button className="btn btn-ghost" style={{ fontSize:11,padding:"6px 10px" }} onClick={requestNotifPermission}>🔔 เปิดแจ้งเตือน</button>}
              {urgentInst.length>0 && <div style={{ background:"#c62828",color:"#fff",borderRadius:50,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700 }}>{urgentInst.length}</div>}
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
                <div style={{ fontWeight:700,fontSize:13,color:"#e65100",marginBottom:8 }}>⚠️ งวดงานที่ใกล้ครบกำหนด ({urgentInst.length} งวด)</div>
                {urgentInst.map(i=>(
                  <div key={i.id} style={{ fontSize:13,color:"#bf360c",marginBottom:4 }}>
                    • {i.name} — {i.project} — ฿{fmt(i.amount)} — อีก {daysUntil(i.dueDate)} วัน ({fmtDate(i.dueDate)})
                  </div>
                ))}
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

            <div className="card" style={{ padding:16,background:net>=0?"linear-gradient(135deg,#e8eaf6,#f3f4ff)":"linear-gradient(135deg,#ffebee,#fce4ec)",border:"none" }}>
              <div style={{ fontSize:12,color:"#777",marginBottom:4 }}>📈 กำไรสุทธิ</div>
              <div style={{ fontSize:26,fontWeight:800,color:net>=0?"#1565c0":"#c62828" }}>฿{fmt(Math.abs(net))}</div>
              <div style={{ fontSize:12,color:net>=0?"#2e7d32":"#c62828",marginTop:4,fontWeight:600 }}>{net>=0?"▲ กำไร":"▼ ขาดทุน"}</div>
            </div>

            {/* Tax summary card */}
            <div className="card" style={{ padding:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <div className="stitle" style={{ margin:0 }}>สรุปภาษี</div>
                <button className="btn btn-ghost" style={{ fontSize:12,padding:"6px 10px" }} onClick={()=>setShowTaxSummary(true)}>ดูรายละเอียด</button>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div style={{ background:"#fff3e0",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:11,color:"#e65100",marginBottom:3,fontWeight:600 }}>VAT 7%</div>
                  <div style={{ fontSize:16,fontWeight:800,color:"#e65100" }}>฿{fmt(totalVat)}</div>
                </div>
                <div style={{ background:"#fce4ec",borderRadius:10,padding:12 }}>
                  <div style={{ fontSize:11,color:"#c62828",marginBottom:3,fontWeight:600 }}>หัก ณ ที่จ่าย 3%</div>
                  <div style={{ fontSize:16,fontWeight:800,color:"#c62828" }}>฿{fmt(totalWht)}</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding:20 }}>
              <div className="stitle">สัดส่วนรายรับ-รายจ่าย</div>
              <Donut income={totalIncome} expense={totalExpense}/>
            </div>

            <div className="card" style={{ padding:20 }}>
              <div className="stitle">รายรับ-จ่ายรายเดือน</div>
              <BarChart entries={entries}/>
            </div>

            <div className="card" style={{ padding:20 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <div className="stitle" style={{ margin:0 }}>รายการล่าสุด</div>
                <button className="btn btn-ghost" style={{ fontSize:12,padding:"6px 12px" }} onClick={()=>setView("list")}>ดูทั้งหมด →</button>
              </div>
              {entries.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"32px 0",fontSize:14 }}>ยังไม่มีรายการ</div>
              :[...entries].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6).map((e,i,arr)=>(
                <div key={e.id} style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<arr.length-1?"1px solid #f5f5f5":"none" }}>
                  <div style={{ width:38,height:38,borderRadius:12,background:e.type==="income"?"#e8f5e9":"#ffebee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>
                    {e.type==="income"?"↑":"↓"}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:14,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.description}</div>
                    <div style={{ fontSize:11,color:"#bbb",marginTop:2 }}>{e.category} · {fmtDate(String(e.date).slice(0,10))}</div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <div style={{ fontWeight:800,fontSize:14,color:e.type==="income"?"#2e7d32":"#c62828" }}>
                      {e.type==="income"?"+":"-"}฿{fmt(e.amount)}
                    </div>
                    {(e.vat||e.wht)?<div style={{ fontSize:10,color:"#aaa" }}>
                      {e.vat?`VAT ฿${fmt(e.vat)} `:""}{e.wht?`หัก ณ ฿${fmt(e.wht)}`:""}
                    </div>:null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIST */}
        {view==="list"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
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
              <div style={{ display:"flex",gap:8,marginTop:10,alignItems:"center" }}>
                {hasFilter&&<button className="btn btn-ghost" style={{ fontSize:12,padding:"7px 12px" }} onClick={()=>{setFilterType("all");setFilterProject("all");setDateFrom("");setDateTo("");}}>✕ ล้าง</button>}
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
            {filtered.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"48px 0",fontSize:14 }}>ไม่พบรายการ</div>
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
                          {e.vat?`VAT ฿${fmt(e.vat)} `:""}{e.wht?`หัก ฿${fmt(e.wht)}`:""}
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

        {/* INSTALLMENTS */}
        {view==="installments"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <button className="btn btn-green" onClick={()=>{ setInstForm({project:projects[0]||"",name:"งวดที่ 1",amount:"",dueDate:""}); setShowInstForm(true); }} style={{ width:"100%",padding:14,fontSize:15 }}>
              + เพิ่มงวดงาน
            </button>
            {installments.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"48px 0",fontSize:14 }}>ยังไม่มีงวดงาน</div>
            :installments.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(inst=>{
              const days=daysUntil(inst.dueDate);
              const isUrgent=days<=7&&days>=0&&inst.status==="pending";
              const isOverdue=days<0&&inst.status==="pending";
              return (
                <div key={inst.id} className="card" style={{ padding:16,borderLeft:`4px solid ${isOverdue?"#c62828":isUrgent?"#ff9800":inst.status==="received"?"#2e7d32":"#ddd"}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
                    <div style={{ fontWeight:700,fontSize:15 }}>{inst.name}</div>
                    <span className={`badge badge-${inst.status==="received"?"received":"pending"}`}>
                      {inst.status==="received"?"✅ รับแล้ว":"⏳ รอรับ"}
                    </span>
                  </div>
                  <div style={{ fontSize:13,color:"#666",marginBottom:4 }}>📁 {inst.project}</div>
                  <div style={{ fontSize:18,fontWeight:800,color:"#1565c0",marginBottom:4 }}>฿{fmt(inst.amount)}</div>
                  <div style={{ fontSize:13,color:isOverdue?"#c62828":isUrgent?"#e65100":"#888" }}>
                    📅 {fmtDate(inst.dueDate)}
                    {inst.status==="pending"&&(isOverdue?` — เลยกำหนด ${Math.abs(days)} วัน`:isUrgent?` — อีก ${days} วัน`:` — อีก ${days} วัน`)}
                  </div>
                  <div style={{ display:"flex",gap:8,marginTop:12 }}>
                    {inst.status==="pending"
                      ?<button className="btn btn-green" onClick={()=>markInstallment(inst.id,"received")} style={{ flex:1,fontSize:13,padding:8 }}>✅ รับเงินแล้ว</button>
                      :<button className="btn btn-ghost" onClick={()=>markInstallment(inst.id,"pending")} style={{ flex:1,fontSize:13,padding:8 }}>↩️ ยังไม่รับ</button>
                    }
                    <button className="btn btn-red" onClick={()=>deleteInstallment(inst.id)} style={{ flex:1,fontSize:13,padding:8 }}>🗑️ ลบ</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PROJECTS */}
        {view==="projects"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <div className="card" style={{ padding:16 }}>
              <div style={{ display:"flex",gap:8 }}>
                <input placeholder="ชื่อโครงการใหม่..." value={newProj} onChange={e=>setNewProj(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProject()} style={{ flex:1 }}/>
                <button className="btn btn-green" onClick={addProject} disabled={saving} style={{ whiteSpace:"nowrap",padding:"12px 16px" }}>+ เพิ่ม</button>
              </div>
            </div>
            {projectStats.length===0?<div style={{ textAlign:"center",color:"#ccc",padding:"40px 0",fontSize:14 }}>ยังไม่มีข้อมูลโครงการ</div>
            :projectStats.map(p=>{
              const maxVal=Math.max(...projectStats.map(x=>x.income+x.expense),1);
              const projInst=installments.filter(i=>i.project===p.name&&i.status==="pending");
              return (
                <div key={p.name} className="card" style={{ padding:16 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                    <span style={{ fontWeight:700,fontSize:14 }}>{p.name}</span>
                    <span style={{ fontWeight:800,color:p.net>=0?"#2e7d32":"#c62828",fontSize:14 }}>฿{fmt(p.net)}</span>
                  </div>
                  <div style={{ display:"flex",gap:12,fontSize:12,color:"#bbb",marginBottom:projInst.length>0?8:10 }}>
                    <span style={{ color:"#2e7d32" }}>รับ ฿{fmt(p.income)}</span>
                    <span style={{ color:"#c62828" }}>จ่าย ฿{fmt(p.expense)}</span>
                  </div>
                  {projInst.length>0&&(
                    <div style={{ fontSize:12,color:"#e65100",marginBottom:8 }}>⏳ งวดรอรับ {projInst.length} งวด รวม ฿{fmt(projInst.reduce((s,i)=>s+i.amount,0))}</div>
                  )}
                  <div style={{ background:"#f0f0f0",borderRadius:6,height:8,overflow:"hidden",marginBottom:10 }}>
                    <div style={{ width:`${((p.income+p.expense)/maxVal)*100}%`,height:"100%",background:p.net>=0?"linear-gradient(90deg,#2e7d32,#66bb6a)":"linear-gradient(90deg,#c62828,#ef5350)",borderRadius:6 }}/>
                  </div>
                  <button className="btn btn-red" onClick={()=>removeProject(p.name)} style={{ fontSize:12,padding:"6px 12px" }}>ลบโครงการ</button>
                </div>
              );
            })}
            {projects.filter(p=>!projectStats.find(s=>s.name===p)).map(p=>(
              <div key={p} className="card" style={{ padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ fontSize:14,color:"#999" }}>{p}</span>
                <button className="btn btn-red" onClick={()=>removeProject(p)} style={{ fontSize:12,padding:"6px 12px" }}>ลบ</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div className="bottom-nav">
        {[{k:"dashboard",icon:"📊",l:"ภาพรวม"},{k:"list",icon:"📋",l:"รายการ"},{k:"installments",icon:"📆",l:"งวดงาน"},{k:"projects",icon:"🏢",l:"โครงการ"}].map(n=>(
          <button key={n.k} className={`bnav-btn${view===n.k?" active":""}`} onClick={()=>setView(n.k)}>
            <span>{n.icon}</span>{n.l}
            {n.k==="installments"&&urgentInst.length>0&&<div style={{ position:"absolute",top:6,background:"#c62828",color:"#fff",borderRadius:50,width:16,height:16,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>{urgentInst.length}</div>}
          </button>
        ))}
        <button className="bnav-btn" onClick={()=>setShowProjMgr(true)}><span>⚙️</span>ตั้งค่า</button>
      </div>

      <button className="fab" onClick={openAdd}>+</button>

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
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={form.useVat} onChange={e=>setForm(f=>({...f,useVat:e.target.checked}))}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14,fontWeight:600 }}>VAT 7%</div>
                      {form.useVat&&form.amount&&<div style={{ fontSize:12,color:"#e65100" }}>= ฿{fmt(+form.amount*VAT_RATE)}</div>}
                    </div>
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={form.useWht} onChange={e=>setForm(f=>({...f,useWht:e.target.checked}))}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14,fontWeight:600 }}>หัก ณ ที่จ่าย 3%</div>
                      {form.useWht&&form.amount&&<div style={{ fontSize:12,color:"#c62828" }}>= ฿{fmt(+form.amount*WHT_RATE)}</div>}
                    </div>
                  </label>
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
            <div style={{ fontWeight:800,fontSize:18,marginBottom:20 }}>📆 เพิ่มงวดงาน</div>
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {[
                {label:"โครงการ",el:<select value={instForm.project} onChange={e=>setInstForm(f=>({...f,project:e.target.value}))}>{projects.map(p=><option key={p}>{p}</option>)}</select>},
                {label:"ชื่องวด เช่น งวดที่ 1",el:<input type="text" placeholder="งวดที่ 1" value={instForm.name} onChange={e=>setInstForm(f=>({...f,name:e.target.value}))}/>},
                {label:"ยอดเงินงวด (บาท)",el:<input type="number" inputMode="decimal" placeholder="0.00" value={instForm.amount} onChange={e=>setInstForm(f=>({...f,amount:e.target.value}))}/>},
                {label:"วันครบกำหนดเบิก",el:<input type="date" value={instForm.dueDate} onChange={e=>setInstForm(f=>({...f,dueDate:e.target.value}))}/>},
              ].map(({label,el})=>(
                <div key={label}>
                  <label style={{ fontSize:12,color:"#aaa",fontWeight:700,display:"block",marginBottom:6 }}>{label}</label>
                  {el}
                </div>
              ))}
              <div style={{ display:"flex",gap:10,marginTop:4 }}>
                <button className="btn btn-ghost" onClick={()=>setShowInstForm(false)} style={{ flex:1,padding:13 }}>ยกเลิก</button>
                <button className="btn btn-primary" onClick={addInstallment} style={{ flex:2,padding:13 }}>บันทึกงวด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAX SUMMARY MODAL */}
      {showTaxSummary&&(
        <div className="modal-bg" onClick={()=>setShowTaxSummary(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{ width:40,height:4,background:"#e0e0e0",borderRadius:2,margin:"0 auto 20px" }}/>
            <div style={{ fontWeight:800,fontSize:18,marginBottom:20 }}>🧾 สรุปภาษีทั้งหมด</div>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ background:"#fff3e0",borderRadius:12,padding:16 }}>
                <div style={{ fontSize:12,color:"#e65100",fontWeight:700,marginBottom:6 }}>VAT 7% ที่ต้องนำส่ง</div>
                <div style={{ fontSize:24,fontWeight:800,color:"#e65100" }}>฿{fmt(totalVat)}</div>
                <div style={{ fontSize:12,color:"#aaa",marginTop:4 }}>จาก {entries.filter(e=>e.vat).length} รายการ</div>
              </div>
              <div style={{ background:"#fce4ec",borderRadius:12,padding:16 }}>
                <div style={{ fontSize:12,color:"#c62828",fontWeight:700,marginBottom:6 }}>หัก ณ ที่จ่าย 3% ที่ถูกหัก</div>
                <div style={{ fontSize:24,fontWeight:800,color:"#c62828" }}>฿{fmt(totalWht)}</div>
                <div style={{ fontSize:12,color:"#aaa",marginTop:4 }}>จาก {entries.filter(e=>e.wht).length} รายการ</div>
              </div>
              <div style={{ background:"#e8f5e9",borderRadius:12,padding:16 }}>
                <div style={{ fontSize:12,color:"#2e7d32",fontWeight:700,marginBottom:6 }}>ภาษีสุทธิที่ต้องจ่าย (VAT - หัก ณ ที่จ่าย)</div>
                <div style={{ fontSize:24,fontWeight:800,color:"#2e7d32" }}>฿{fmt(totalVat - totalWht)}</div>
              </div>
            </div>
            <button className="btn btn-ghost" style={{ marginTop:20,width:"100%",padding:13 }} onClick={()=>setShowTaxSummary(false)}>ปิด</button>
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
