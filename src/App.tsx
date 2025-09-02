import React, { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Download, Filter, RefreshCcw, Search, Wrench, CheckCircle2, AlertTriangle, Loader2, Link as LinkIcon } from "lucide-react";

// Config (Vercel/Local)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lcpozpxumwzmqmwyabvd.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR-ANON-KEY";
const TABLE_NAME = "asistente_mantenimiento";
const SCHEMA = "public";
const ENABLE_REALTIME = true;
const ENABLE_UPDATE_ACTIONS = false; // solo lectura

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

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SCHEMA } });

function formatDate(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function classNames(...xs: (string | false | undefined)[]) { return xs.filter(Boolean).join(" "); }

function toCSV(rows: Pedido[]) {
  const headers = ["fecha_creacion","usuario_creacion","problema","sector","urgencia","responsable","imagenes","estado","fecha_resolucion","usuario_resolucion","comentario_responsable"];
  const esc = (s: any) => `"${String(s ?? "").replace(/"/g, '""').replace(/
/g, " ")}"`;
  const lines = [headers.join(",")].concat(rows.map((r) => [r.fecha_creacion,r.usuario_creacion,r.problema,r.sector,r.urgencia,r.responsable,r.imagenes,r.estado,r.fecha_resolucion,r.usuario_resolucion,r.comentario_responsable].map(esc).join(",")));
  return lines.join("
");
}

// Etiqueta/Pastilla con tonos suaves
const Pill: React.FC<{ children: React.ReactNode; intent?: "ok" | "warn" | "crit" | "muted" }>
  = ({ children, intent = "muted" }) => (
  <span className={classNames(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
    intent === "ok" && "bg-green-50 text-green-700 border-green-100",
    intent === "warn" && "bg-yellow-50 text-yellow-800 border-yellow-100",
    intent === "crit" && "bg-red-50 text-red-700 border-red-100",
    intent === "muted" && "bg-gray-100 text-gray-700 border-gray-200"
  )}>{children}</span>
);

// Card con tono por color (verde/amarillo/rojo/gris)
const Card: React.FC<{ title: string; color: "green" | "yellow" | "red" | "gray"; icon?: React.ReactNode }>
  = ({ title, color, icon, children }) => (
  <div className={classNames(
    "rounded-2xl shadow-sm border p-4",
    color === "green" && "bg-green-50 border-green-100 text-green-900",
    color === "yellow" && "bg-yellow-50 border-yellow-100 text-yellow-900",
    color === "red" && "bg-red-50 border-red-100 text-red-900",
    color === "gray" && "bg-white border-gray-200 text-gray-900"
  )}>
    <div className="flex items-center gap-3">
      {icon}
      <div className="text-sm font-semibold">{title}</div>
    </div>
    <div className="mt-3 text-3xl font-bold">{children}</div>
  </div>
);

// Select simple
const Select: React.FC<{ value: string; onChange: (v: string) => void; options: string[]; placeholder: string; }>
  = ({ value, onChange, options, placeholder }) => (
  <select className="border rounded-xl px-3 py-2 text-sm bg-white" value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">{placeholder}</option>
    {options.map((o) => (<option key={o} value={o}>{o}</option>))}
  </select>
);

export default function App() {
  const [rows, setRows] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [urgencia, setUrgencia] = useState("");
  const [sector, setSector] = useState("");
  const [responsable, setResponsable] = useState("");

  async function fetchRows() {
    setLoading(true); setError(null);
    let query = supabase.from<Pedido>(TABLE_NAME).select("*").limit(1000);
    if (estado) query = query.eq("estado", estado);
    if (urgencia) {
      if (urgencia === "Crítica") {
        // manejar tilde/acentos en datos existentes
        query = query.in("urgencia", ["Crítica", "Critica"]);
      } else {
        query = query.eq("urgencia", urgencia);
      }
    }
    if (sector) query = query.eq("sector", sector);
    if (responsable) query = query.eq("responsable", responsable);
    if (q) query = query.ilike("problema", `%${q}%`);
    const { data, error } = await query;
    if (error) { setError(error.message); setLoading(false); return; }
    setRows(data || []); setLoading(false);
  }

  useEffect(() => { fetchRows(); }, [estado, urgencia, sector, responsable, q]);

  // Realtime
  useEffect(() => {
    if (!ENABLE_REALTIME) return;
    const channel = supabase
      .channel("mant-dashboard")
      .on("postgres_changes", { event: "*", schema: SCHEMA, table: TABLE_NAME }, fetchRows)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // opciones dinámicas, normalizando "Crítica" para evitar duplicados
  const options = useMemo(() => {
    const u = new Set<string>();
    const e = new Set<string>();
    const s = new Set<string>();
    const r = new Set<string>();
    rows.forEach((row) => {
      if (row.urgencia) u.add(row.urgencia);
      if (row.estado) e.add(row.estado);
      if (row.sector) s.add(row.sector);
      if (row.responsable) r.add(row.responsable);
    });
    const urg = Array.from(u);
    const sinDuplicar = urg.filter(v => v.toLowerCase() !== "crítica" && v.toLowerCase() !== "critica");
    return {
      urgencias: [...sinDuplicar, "Crítica"],
      estados: Array.from(e).sort(),
      sectores: Array.from(s).sort(),
      responsables: Array.from(r).sort(),
    };
  }, [rows]);

  const filtered = rows; // ya filtramos en el SELECT

  const kpis = useMemo(() => {
    const total = filtered.length;
    const pend = filtered.filter(r => r.estado === "Pendiente").length;
    const res = filtered.filter(r => r.estado === "Resuelto").length;
    const leves = filtered.filter(r => r.urgencia?.toLowerCase() === "leve").length;
    const moderadas = filtered.filter(r => r.urgencia?.toLowerCase() === "moderada").length;
    const criticas = filtered.filter(r => r.urgencia?.toLowerCase().startsWith("crit")).length;
    return { total, pend, res, leves, moderadas, criticas };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gray-900 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Dashboard de Mantenimiento</h1>
              <p className="text-xs md:text-sm text-gray-500">Tabla: {SCHEMA}.{TABLE_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchRows} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm bg-gray-900 text-white hover:bg-black">
              <RefreshCcw className="w-4 h-4" /> Recargar
            </button>
            <button
              onClick={() => { const csv = toCSV(filtered); const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `mantenimiento_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); }}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-gray-100"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end mb-6">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white">
              <Search className="w-4 h-4" />
              <input className="outline-none text-sm w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por problema…" />
            </div>
          </div>
          <Select value={estado} onChange={setEstado} options={["Pendiente","Resuelto"]} placeholder="Estado" />
          <Select value={urgencia} onChange={setUrgencia} options={["Leve","Moderada","Crítica"]} placeholder="Urgencia" />
          <Select value={sector} onChange={setSector} options={options.sectores} placeholder="Sector" />
          <Select value={responsable} onChange={setResponsable} options={options.responsables} placeholder="Responsable" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Card title="Total" color="gray" icon={<Filter className="w-4 h-4" />}>{kpis.total}</Card>
          <Card title="Pendientes" color="red" icon={<AlertTriangle className="w-4 h-4" />}>{kpis.pend}</Card>
          <Card title="Resueltos" color="green" icon={<CheckCircle2 className="w-4 h-4" />}>{kpis.res}</Card>
          <Card title="Leves" color="green">{kpis.leves}</Card>
          <Card title="Moderadas" color="yellow">{kpis.moderadas}</Card>
          <Card title="Críticas" color="red">{kpis.criticas}</Card>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Creado</th>
                <th className="px-4 py-3 text-left font-semibold">Problema</th>
                <th className="px-4 py-3 text-left font-semibold">Sector</th>
                <th className="px-4 py-3 text-left font-semibold">Urgencia</th>
                <th className="px-4 py-3 text-left font-semibold">Responsable</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Resuelto</th>
                <th className="px-4 py-3 text-left font-semibold">Imágenes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Cargando…</td></tr>)}
              {error && !loading && (<tr><td colSpan={8} className="px-4 py-6 text-center text-red-600">{error}</td></tr>)}
              {!loading && !error && filtered.length === 0 && (<tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">Sin resultados</td></tr>)}
              {!loading && !error && filtered.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.fecha_creacion)}</td>
                  <td className="px-4 py-3 min-w-[280px]">{r.problema}</td>
                  <td className="px-4 py-3">{r.sector}</td>
                  <td className="px-4 py-3">
                    {r.urgencia ? (
                      <Pill intent={
                        r.urgencia?.toLowerCase().startsWith("crit") ? "crit" :
                        r.urgencia?.toLowerCase().startsWith("mod") ? "warn" : "ok"
                      }>{r.urgencia}</Pill>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">{r.responsable || "—"}</td>
                  <td className="px-4 py-3">{r.estado === "Resuelto" ? <Pill intent="ok">Resuelto</Pill> : <Pill intent="warn">Pendiente</Pill>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.fecha_resolucion)}</td>
                  <td className="px-4 py-3">{r.imagenes ? (<a href={r.imagenes} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline"><LinkIcon className="w-4 h-4" /> Abrir carpeta</a>) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie */}
        <div className="text-xs text-gray-500 mt-4 text-center">
          <p>• Desarrollado por el Departamento de IA del Sanatorio Boratti.</p>
        </div>
      </div>
    </div>
  );
}
