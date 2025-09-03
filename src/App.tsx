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

// Función para normalizar texto (quita acentos y convierte a minúsculas)
function normalize(s?: string) {
  return s?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function toCSV(rows: Pedido[]) {
  const headers = ["fecha_creacion","usuario_creacion","problema","sector","urgencia","responsable","imagenes","estado","fecha_resolucion","usuario_resolucion","comentario_responsable"];
  const esc = (v: unknown) =>
    `"${String(v ?? "")
        .split('"').join('""')        // duplica comillas
        .replace(/\r?\n/g, " ")       // quita saltos de línea
      }"`;
  const lines = [headers.join(",")].concat(
    rows.map((r) =>
      [
        r.fecha_creacion,
        r.usuario_creacion,
        r.problema,
        r.sector,
        r.urgencia,
        r.responsable,
        r.imagenes,
        r.estado,
        r.fecha_resolucion,
        r.usuario_resolucion,
        r.comentario_responsable,
      ].map(esc).join(",")
    )
  );
  return lines.join("\n");
}

// Etiqueta/Pastilla con tonos coherentes con los KPIs
const Pill: React.FC<{ children: React.ReactNode; intent?: "ok" | "warn" | "crit" | "muted" }>
  = ({ children, intent = "muted" }) => (
  <span className={classNames(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border shadow-sm",
    intent === "ok" && "bg-green-100 text-green-800 border-green-200",
    intent === "warn" && "bg-yellow-100 text-yellow-800 border-yellow-200",
    intent === "crit" && "bg-red-100 text-red-800 border-red-200",
    intent === "muted" && "bg-gray-100 text-gray-700 border-gray-200"
  )}>{children}</span>
);

// Card con tono por color y efectos mejorados
const Card: React.FC<{ title: string; color: "green" | "yellow" | "red" | "gray"; icon?: React.ReactNode }>
  = ({ title, color, icon, children }) => (
  <div className={classNames(
    "rounded-2xl shadow-lg border p-5 transition-all duration-200 hover:shadow-xl hover:scale-105",
    color === "green" && "bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 text-green-900",
    color === "yellow" && "bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-200 text-yellow-900",
    color === "red" && "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 text-red-900",
    color === "gray" && "bg-gradient-to-br from-white to-gray-50/50 border-gray-200 text-gray-900"
  )}>
    <div className="flex items-center gap-3">
      {icon}
      <div className="text-sm font-semibold">{title}</div>
    </div>
    <div className="mt-3 text-3xl font-bold">{children}</div>
  </div>
);

// Select mejorado
const Select: React.FC<{ value: string; onChange: (v: string) => void; options: string[]; placeholder: string; }>
  = ({ value, onChange, options, placeholder }) => (
  <select className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" value={value} onChange={(e) => onChange(e.target.value)}>
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

  // KPIs con normalización mejorada para urgencias
  const kpis = useMemo(() => {
    const total = rows.length; // Total siempre muestra todos los casos, no los filtrados
    const pend = filtered.filter(r => r.estado === "Pendiente").length;
    const res = filtered.filter(r => r.estado === "Resuelto").length;
    const leves = filtered.filter(r => normalize(r.urgencia) === "leve").length;
    const moderadas = filtered.filter(r => normalize(r.urgencia) === "moderada").length;
    const criticas = filtered.filter(r => normalize(r.urgencia)?.startsWith("crit")).length;
    return { total, pend, res, leves, moderadas, criticas };
  }, [rows, filtered]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 text-gray-900">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8 bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Dashboard de Mantenimiento</h1>
              <p className="text-sm text-gray-600">Sistema de control interno del Sanatorio</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchRows} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all duration-200">
              <RefreshCcw className="w-4 h-4" /> Recargar
            </button>
            <button
              onClick={() => { const csv = toCSV(filtered); const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `mantenimiento_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
              <Search className="w-4 h-4 text-gray-400" />
              <input className="outline-none text-sm w-full placeholder-gray-400" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por problema…" />
            </div>
          </div>
          <Select value={estado} onChange={setEstado} options={["Pendiente","Resuelto"]} placeholder="Estado" />
          <Select value={urgencia} onChange={setUrgencia} options={["Leve","Moderada","Crítica"]} placeholder="Urgencia" />
          <Select value={sector} onChange={setSector} options={options.sectores} placeholder="Sector" />
          <Select value={responsable} onChange={setResponsable} options={options.responsables} placeholder="Responsable" />
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <Card title="Total" color="gray" icon={<Filter className="w-5 h-5" />}>{kpis.total}</Card>
          <Card title="Pendientes" color="red" icon={<AlertTriangle className="w-5 h-5" />}>{kpis.pend}</Card>
          <Card title="Resueltos" color="gray" icon={<CheckCircle2 className="w-5 h-5" />}>{kpis.res}</Card>
          <Card title="Leves" color="green">{kpis.leves}</Card>
          <Card title="Moderadas" color="yellow">{kpis.moderadas}</Card>
          <Card title="Críticas" color="red">{kpis.criticas}</Card>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-lg">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Creado</th>
                <th className="px-6 py-4 text-left font-semibold">Problema</th>
                <th className="px-6 py-4 text-left font-semibold">Sector</th>
                <th className="px-6 py-4 text-left font-semibold">Urgencia</th>
                <th className="px-6 py-4 text-left font-semibold">Responsable</th>
                <th className="px-6 py-4 text-left font-semibold">Estado</th>
                <th className="px-6 py-4 text-left font-semibold">Resuelto</th>
                <th className="px-6 py-4 text-left font-semibold">Imágenes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (<tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Cargando…</td></tr>)}
              {error && !loading && (<tr><td colSpan={8} className="px-6 py-8 text-center text-red-600 bg-red-50">{error}</td></tr>)}
              {!loading && !error && filtered.length === 0 && (<tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">Sin resultados</td></tr>)}
              {!loading && !error && filtered.map((r, i) => (
                <tr key={i} className={classNames(
                  "border-t border-gray-100 hover:bg-gray-50/50 transition-colors duration-150",
                  i % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                )}>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{formatDate(r.fecha_creacion)}</td>
                  <td className="px-6 py-4 min-w-[280px] font-medium">{r.problema}</td>
                  <td className="px-6 py-4 text-gray-600">{r.sector}</td>
                  <td className="px-6 py-4">
                    {r.urgencia ? (
                      <Pill intent={normalize(r.urgencia)?.startsWith("crit") ? "crit" : normalize(r.urgencia)?.startsWith("mod") ? "warn" : "ok"}>{r.urgencia}</Pill>
                    ) : "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{r.responsable || "—"}</td>
                  <td className="px-6 py-4">{r.estado === "Resuelto" ? <Pill intent="ok">Resuelto</Pill> : <Pill intent="crit">Pendiente</Pill>}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{formatDate(r.fecha_resolucion)}</td>
                  <td className="px-6 py-4">{r.imagenes ? (<a href={r.imagenes} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors"><LinkIcon className="w-4 h-4" /> <span className="font-bold">Ver</span></a>) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie */}
        <div className="text-xs text-gray-500 mt-6 text-center">
          <p>• Desarrollado por el Departamento de IA del Sanatorio Boratti.</p>
        </div>
      </div>
    </div>
  );
}
