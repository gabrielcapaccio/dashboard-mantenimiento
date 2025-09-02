import React, { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Download, Filter, RefreshCcw, Search, Wrench, CheckCircle2, AlertTriangle, Loader2, Link as LinkIcon } from "lucide-react";

// === CONFIG – PRODUCCIÓN ===
const SUPABASE_URL = "https://lcpozpxumwzmqmwyabvd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjcG96cHh1bXd6bXFtd3lhYnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3MTkyODEsImV4cCI6MjA1NzI5NTI4MX0.gvtuM9_YJ7IevOH9Wcy4RaA0EvBiZXZF_oHmVCfSwUM";
const TABLE_NAME = "asistente_mantenimiento";
const SCHEMA = "public";
const ENABLE_REALTIME = true;     // suscripción a cambios
const ENABLE_UPDATE_ACTIONS = false; // SOLO LECTURA

// === TIPOS DE DATOS ===
export type Pedido = {
  id?: string;
  fecha_creacion?: string;
  usuario_creacion?: string;
  problema?: string;
  sector?: string;
  urgencia?: "Leve" | "Moderada" | "Critica" | string;
  responsable?: string;
  imagenes?: string;
  estado?: "Pendiente" | "Resuelto" | string;
  fecha_resolucion?: string | null;
  usuario_resolucion?: string | null;
  comentario_responsable?: string | null;
};

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: SCHEMA },
});

function formatDate(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function classNames(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function toCSV(rows: Pedido[]) {
  const headers = [
    "fecha_creacion","usuario_creacion","problema","sector","urgencia","responsable","imagenes","estado","fecha_resolucion","usuario_resolucion","comentario_responsable",
  ];
  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""').replace(/\n/g, " " )}"`;
  const lines = [headers.join(",")].concat(
    rows.map((r) => [r.fecha_creacion,r.usuario_creacion,r.problema,r.sector,r.urgencia,r.responsable,r.imagenes,r.estado,r.fecha_resolucion,r.usuario_resolucion,r.comentario_responsable].map(esc).join(","))
  );
  return lines.join("\n");
}

const Pill: React.FC<{ children: React.ReactNode; intent?: "ok" | "warn" | "muted" }> = ({ children, intent = "muted" }) => (
  <span className={classNames(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
    intent === "ok" && "bg-green-100 text-green-800",
    intent === "warn" && "bg-yellow-100 text-yellow-800",
    intent === "muted" && "bg-gray-100 text-gray-800"
  )}>{children}</span>
);

const Card: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
  <div className="rounded-2xl shadow-sm border p-4 bg-white">
    <div className="flex items-center gap-3">{icon}<div className="text-sm font-semibold text-gray-700">{title}</div></div>
    {subtitle && <div className="text-2xs text-gray-500 mt-1">{subtitle}</div>}
    <div className="mt-3 text-3xl font-bold">{children}</div>
  </div>
);

const Select: React.FC<{ value: string; onChange: (v: string) => void; options: string[]; placeholder: string; }> = ({ value, onChange, options, placeholder }) => (
  <select className="border rounded-xl px-3 py-2 text-sm bg-white" value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">{placeholder}</option>
    {options.map((o) => (<option key={o} value={o}>{o}</option>))}
  </select>
);

const TextInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; }> = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white">
    <Search className="w-4 h-4" />
    <input className="outline-none text-sm w-full" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </div>
);

const Button: React.FC<{ onClick?: () => void; children: React.ReactNode; icon?: React.ReactNode; variant?: "solid" | "ghost"; disabled?: boolean; }> = ({ onClick, children, icon, variant = "solid", disabled }) => (
  <button onClick={onClick} disabled={disabled} className={classNames("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm",variant === "solid" && "bg-gray-900 text-white hover:bg-black",variant === "ghost" && "hover:bg-gray-100",disabled && "opacity-60 cursor-not-allowed")}>{icon}<span>{children}</span></button>
);

export default function MaintenanceDashboard() {
  const [rows, setRows] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [urgencia, setUrgencia] = useState("");
  const [sector, setSector] = useState("");
  const [responsable, setResponsable] = useState("");
  const [orderBy, setOrderBy] = useState<keyof Pedido>("fecha_creacion");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");

  async function fetchRows() {
    setLoading(true);setError(null);
    let query = supabase.from<Pedido>(TABLE_NAME).select("*").limit(1000);
    if (estado) query = query.eq("estado", estado);
    if (urgencia) query = query.eq("urgencia", urgencia);
    if (sector) query = query.eq("sector", sector);
    if (responsable) query = query.eq("responsable", responsable);
    if (q) query = query.ilike("problema", `%${q}%`);
    query = query.order(orderBy as string, { ascending: orderDir === "asc" });
    const { data, error } = await query;
    if (error) { setError(error.message); setLoading(false); return; }
    setRows(data || []); setLoading(false);
  }

  useEffect(() => { fetchRows(); }, [estado, urgencia, sector, responsable, q, orderBy, orderDir]);

  useEffect(() => { if (!ENABLE_REALTIME) return; const channel = supabase.channel("mant-dashboard").on("postgres_changes", { event: "*", schema: SCHEMA, table: TABLE_NAME }, fetchRows).subscribe(); return () => { supabase.removeChannel(channel); }; }, []);

  const options = useMemo(() => { const u=new Set<string>(), e=new Set<string>(), s=new Set<string>(), r=new Set<string>(); rows.forEach((row)=>{ if(row.urgencia) u.add(row.urgencia); if(row.estado) e.add(row.estado); if(row.sector) s.add(row.sector); if(row.responsable) r.add(row.responsable);}); return { urgencias:[...u].sort(), estados:[...e].sort(), sectores:[...s].sort(), responsables:[...r].sort() };}, [rows]);

  const filtered = rows;

  const kpis = useMemo(()=>{ const total=filtered.length, pend=filtered.filter(r=>r.estado==="Pendiente").length, res=filtered.filter(r=>r.estado==="Resuelto").length, leves=filtered.filter(r=>r.urgencia?.toLowerCase()==="leve").length, moderadas=filtered.filter(r=>r.urgencia?.toLowerCase()==="moderada").length, criticas=filtered.filter(r=>r.urgencia?.toLowerCase()==="critica"||r.urgencia?.toLowerCase()==="crítica").length; return {total, pend, res, leves, moderadas, criticas}; }, [filtered]);

  function downloadCSV(){ const csv=toCSV(filtered); const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=`mantenimiento_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); }

  return (<div className="min-h-screen bg-gray-50 text-gray-900"><div className="max-w-7xl mx-auto p-4 md:p-6">
    <div className="flex items-center justify-between gap-4 mb-6"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-2xl bg-gray-900 flex items-center justify-center"><Wrench className="w-5 h-5 text-white" /></div><div><h1 className="text-xl md:text-2xl font-bold">Dashboard de Mantenimiento</h1><p className="text-xs md:text-sm text-gray-500">Tabla: {SCHEMA}.{TABLE_NAME}</p></div></div><div className="flex items-center gap-2"><Button icon={<RefreshCcw className="w-4 h-4" />} onClick={fetchRows}>Recargar</Button><Button icon={<Download className="w-4 h-4" />} variant="ghost" onClick={downloadCSV}>Exportar CSV</Button></div></div>
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-6"><div className="md:col-span-2"><TextInput value={q} onChange={setQ} placeholder="Buscar por problema…" /></div><Select value={estado} onChange={setEstado} options={["Pendiente","Resuelto"]} placeholder="Estado" /><Select value={urgencia} onChange={setUrgencia} options={[...new Set(["Leve","Moderada","Critica","Crítica",...options.urgencias])]} placeholder="Urgencia" /><Select value={sector} onChange={setSector} options={options.sectores} placeholder="Sector" /><Select value={responsable} onChange={setResponsable} options={options.responsables} placeholder="Responsable" /></div>
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6"><Card title="Total" icon={<Filter className="w-4 h-4" />}>{kpis.total}</Card><Card title="Pendientes" icon={<AlertTriangle className="w-4 h-4" />}>{kpis.pend}</Card><Card title="Resueltos" icon={<CheckCircle2 className="w-4 h-4" />}>{kpis.res}</Card><Card title="Leves">{kpis.leves}</Card><Card title="Moderadas">{kpis.moderadas}</Card><Card title="Críticas">{kpis.criticas}</Card></div>
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-gray-700"><tr>{[{key:"fecha_creacion",label:"Creado"},{key:"problema",label:"Problema"},{key:"sector",label:"Sector"},{key:"urgencia",label:"Urgencia"},{key:"responsable",label:"Responsable"},{key:"estado",label:"Estado"},{key:"fecha_resolucion",label:"Resuelto"},{key:"imagenes",label:"Imágenes"}].map((col:any)=>(<th key={col.key} className="text-left font-semibold px-4 py-3 cursor-pointer select-none" onClick={()=>{setOrderBy(col.key as keyof Pedido); setOrderDir(d=>(d==="asc"?"desc":"asc"));}}><div className="flex items-center gap-2"><span>{col.label}</span>{orderBy===col.key&&(<span className="text-2xs text-gray-500">{orderDir==="asc"?"↑":"↓"}</span>)}</div></th>))}</tr></thead><tbody>{loading&&(<tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500"><div className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div></td></tr>)}{error&&!loading&&(<tr><td colSpan={9} className="px-4 py-6 text-center text-red-600">{error}</td></tr>)}{!loading&&!error&&filtered.length===0&&(<tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">Sin resultados</td></tr>)}{!loading&&!error&&filtered.map((r,i)=>(<tr key={i} className="border-t"><td className="px-4 py-3 whitespace-nowrap">{formatDate(r.fecha_creacion)}</td><td className="px-4 py-3 min-w-[280px]">{r.problema}</td><td className="px-4 py-3">{r.sector}</td><td className="px-4 py-3">{r.urgencia?(<Pill intent={r.urgencia?.toLowerCase().startsWith("crit")?"warn":r.urgencia?.toLowerCase().startsWith("mod")?"muted":"ok"}>{r.urgencia}</Pill>):"—"}</td><td className="px-4 py-3">{r.responsable||"—"}</td><td className="px-4 py-3">{r.estado==="Resuelto"?<Pill intent="ok">Resuelto</Pill>:<Pill intent="warn">Pendiente</Pill>}</td><td className="px-4 py-3 whitespace-nowrap">{formatDate(r.fecha_resolucion)}</td><td className="px-4 py-3">{r.imagenes?(<a href={r.imagenes} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline"><LinkIcon className="w-4 h-4" /> Abrir carpeta</a>):"—"}</td></tr>))}</tbody></table></div>
    <div className="text-xs text-gray-500 mt-4"><p>Consejo: para seguridad, usa policies RLS en Supabase. Este dashboard funciona detrás de un directorio protegido por contraseña, pero la key ANON sigue siendo pública en el navegador.</p></div>
  </div></div>);
}