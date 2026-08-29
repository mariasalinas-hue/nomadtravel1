// ============================================================================
// Respaldo completo de tus datos de Supabase (Nomad Travel CRM)
// ----------------------------------------------------------------------------
// Descarga TODAS las tablas de tu CRM a archivos JSON y CSV en una carpeta
// local. No necesita instalar nada (usa fetch nativo de Node 18+).
//
// Sirve para: tener una copia tuya de todos los datos ANTES de migrar a tu
// propia base, o simplemente como respaldo de seguridad.
//
// CÓMO USARLO (en tu computadora):
//   1. Instala Node.js 18 o más nuevo (https://nodejs.org)
//   2. Consigue dos valores de tu app:
//        SUPABASE_URL       -> algo como https://xxxxxxxx.supabase.co
//        SUPABASE_ANON_KEY  -> la llave pública ("anon") de tu proyecto
//      Los encuentras en: Vercel > tu proyecto > Settings > Environment
//      Variables (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY), o en tu
//      archivo .env, o en el dashboard de Supabase > Project Settings > API.
//   3. Corre:
//        SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_ANON_KEY="eyJ..." node scripts/exportSupabaseData.mjs
//      (En Windows PowerShell:
//        $env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_ANON_KEY="eyJ..."; node scripts/exportSupabaseData.mjs )
//
// Resultado: una carpeta "backup-nomad-AAAA-MM-DD/" con un .json y un .csv por
// tabla, más un _resumen.txt con el conteo de filas de cada una.
// ============================================================================

import { writeFile, mkdir } from 'node:fs/promises';

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, '');
// Acepta la llave anon (pública) o la service_role si la tienes.
const KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !KEY) {
  console.error('\n❌ Faltan datos. Debes pasar SUPABASE_URL y SUPABASE_ANON_KEY.\n');
  console.error('Ejemplo:');
  console.error('  SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_ANON_KEY="eyJ..." node scripts/exportSupabaseData.mjs\n');
  process.exit(1);
}

// Todas las tablas que usa tu CRM (tomadas de src/api/supabaseClient.js)
const TABLES = [
  'users', 'clients', 'trips', 'sold_trips', 'tasks', 'trip_services',
  'client_payments', 'client_payment_plan', 'supplier_payments', 'suppliers',
  'supplier_contacts', 'supplier_documents', 'group_members', 'reminders',
  'credentials', 'personal_credentials', 'reviews', 'attendance', 'fam_trips',
  'industry_fairs', 'commissions', 'travel_documents', 'learning_materials',
  'trip_notes', 'trip_document_files', 'trip_reminders', 'error_reports',
  'shared_trip_forms', 'service_dropdown_options',
];

const PAGE = 1000; // Supabase devuelve máx 1000 filas por petición

async function fetchTable(table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < PAGE) break; // última página
    from += PAGE;
  }
  return rows;
}

// CSV simple: aplana valores; objetos/arreglos van como JSON entre comillas.
function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Array.from(rows.reduce((set, r) => {
    Object.keys(r).forEach((k) => set.add(k));
    return set;
  }, new Set()));
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = cols.join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return `${head}\n${body}\n`;
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = `backup-nomad-${stamp}`;
  await mkdir(dir, { recursive: true });

  const summary = [`Respaldo Nomad Travel — ${new Date().toLocaleString()}`, `Origen: ${SUPABASE_URL}`, ''];
  let grandTotal = 0;

  for (const table of TABLES) {
    process.stdout.write(`• ${table} ... `);
    try {
      const rows = await fetchTable(table);
      await writeFile(`${dir}/${table}.json`, JSON.stringify(rows, null, 2), 'utf8');
      await writeFile(`${dir}/${table}.csv`, toCsv(rows), 'utf8');
      console.log(`${rows.length} filas ✅`);
      summary.push(`${table}: ${rows.length}`);
      grandTotal += rows.length;
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      summary.push(`${table}: ERROR — ${err.message}`);
    }
  }

  summary.push('', `TOTAL de filas respaldadas: ${grandTotal}`);
  await writeFile(`${dir}/_resumen.txt`, summary.join('\n'), 'utf8');
  console.log(`\n✅ Listo. Tu respaldo está en la carpeta:  ${dir}/`);
  console.log(`   ${grandTotal} filas en total. Guarda esa carpeta en un lugar seguro.\n`);
}

main().catch((e) => {
  console.error('\n❌ Falló el respaldo:', e.message, '\n');
  process.exit(1);
});
