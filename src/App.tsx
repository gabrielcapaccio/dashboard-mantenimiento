import React, { useEffect, useState } from "react";
import { createClient, PostgrestError } from "@supabase/supabase-js";
import { Download, Loader2, Link as LinkIcon, AlertTriangle, CheckCircle2 } from "lucide-react";

// Config (VITE environment variables en .env)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const TABLE_NAME = "asistente_mantenimiento";
const SCHEMA = "public";
const ENABLE_REALTIME = true;     // suscripción a cambios
const ENABLE_UPDATE_ACTIONS = false; // SOLO LECTURA

export type Pedido = {
  id?: string; // omitimos id en UI
  fecha_creacion: string;
  usuario_creacion: string;
  problema: string;
  sector: string;
  urgencia: string | null;
  responsable: string | null;
  imagenes?: string | null;
  estado: string;
  fecha_resolucion?: string | null;
  usuario_resolucion?: string | null;
  comentario_responsable?: string | null;
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SCHEMA } });

// componente Pill con tonos suaves
const Pill: React.FC<{ children: React.ReactNode; intent?: "ok" | "warn" | "muted" | "danger" }> = ({
  children,
  intent = "muted",
}) => (
  <span
    className={[
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      intent === "ok" && "bg-green-50 text-green-700 border border-green-100",
      intent === "warn" && "bg-yellow-50 text-yellow-800 border border-yellow-100",
      intent === "danger" && "bg-red-50 text-red-700 border border-red-100",
      intent === "muted" && "bg-gray-100 text-gray-700",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </span>
);

// tarjeta para KPIs con tonos
const Card: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "green" | "yellow" | "red";
}> = ({ title, subtitle, icon, tone = "neutral", children }) => {
  const toneCls =
    tone === "green"
      ? "bg-green-50 border-green-100 text-green-900"
      : tone === "yellow"
      ? "bg-yellow-50 border-yellow-100 text-yellow-900"
      : tone === "red"
      ? "bg-red-50 border-red-100 text-red-900"
      : "bg-white";
  return (
    <div className={`rounded-2xl shadow-sm border p-4 ${toneCls}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {subtitle && <div className="text-2xs text-gray-500 mt-1">{subtitle}</div>}
      <div className="mt-3 text-3xl font-bold">{children}</div>
    </div>
  );
};

// exportar CSV sin regex problemático
function toCSV(rows: Pedido[]) {
  const headers = [
    "fecha_creacion",
    "usuario_creacion",
    "problema",
    "sector",
    "urgencia",
    "responsable",
    "imagenes",
    "estado",
    "fecha_resolucion",
    "usuario_resolucion",
    "comentario_responsable",
  ];
  const esc = (v: unknown) =>
    `"${String(v ?? "")
      .split('"')
      .join('""')
      .replace(/\r?\n/g, " ")}"`;
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
      ]
        .map(esc)
        .join(","),
    ),
  );
  return lines.join("\n");
}

const App: React.FC = () => {
  // ... resto de tu código (fetchRows, filtros, tabla, etc.)
  // Asegúrate de incluir la lógica del dashboard aquí
  return (
    <div className="container mx-auto py-8">
      {/* filtros y botones */}
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Card title="Total" icon={<AlertTriangle className="w-4 h-4" />} tone="neutral">
          {/* total */}
        </Card>
        <Card title="Pendientes" icon={<AlertTriangle className="w-4 h-4" />} tone="red">
          {/* pendientes */}
        </Card>
        <Card title="Resueltos" icon={<CheckCircle2 className="w-4 h-4" />} tone="green">
          {/* resueltos */}
        </Card>
        <Card title="Leves" tone="green">
          {/* leves */}
        </Card>
        <Card title="Moderadas" tone="yellow">
          {/* moderadas */}
        </Card>
        <Card title="Críticas" tone="red">
          {/* criticas */}
        </Card>
      </div>
      {/* tabla y resto */}
      <div className="text-xs text-gray-500 mt-4">
        <p>• Desarrollado por el Departamento de IA del Sanatorio.</p>
      </div>
    </div>
  );
};

export default App;

