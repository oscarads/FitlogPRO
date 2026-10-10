// ============================================================
// FITLOG PRO - App Principal
// ============================================================
// Stack: React 18 (CDN) + Babel + CSS inline
// Backend: Google Apps Script + Google Sheets
// Storage: Sheets = fonte de verdade | localStorage = cache
//
// NAVEGACAO NO ARQUIVO (use Ctrl+F para encontrar):
//   CONFIG & URL         -> "const GS_URL"
//   STORAGE              -> "async function gsLoad"
//   GRUPOS MUSCULARES    -> "const MUSCLE_GROUPS"
//   DETECTOR DE MUSCULO  -> "const detectMuscle"
//   ENGINE PROGRESSAO    -> "ENGINE DE PROGRESSAO"
//   AQUECIMENTO          -> "function calcAquecimento"
//   PRE-TREINO           -> "function PreTreinoAnalise"
//   TIMER DESCANSO       -> "function RestTimer"
//   TREINO ATIVO         -> "function ActiveWorkout"
//   EDITOR DE PLANO      -> "function PlanEditor"
//   CALC PACOTE          -> "function PacoteCalc"
//   FORM ALUNO           -> "function AlunoForm"
//   ALUNOS VIEW          -> "function AlunosView"
//   AVALIACAO FISICA     -> "function AvaliacaoView"
//   AGENDA               -> "function AgendaView"
//   FINANCEIRO           -> "function FinanceiroView"
//   MEU DIA              -> "function MeuDiaView"
//   APP RAIZ             -> "// ============================================================
//
// ✅ BUGS CORRIGIDOS EM 07/2026 (buscar "✅ CORRIGIDO" pra achar cada trecho):
//   1) ActiveWorkout: `const resume=plan._resume` estava DEPOIS de ser usado nos useState de
//      exIdx/setIdx (travava a tela de treino). Corrigido: reordenado pra antes.
//   2) parseEvTitle não retornava mais `totalAula` (sempre null). Corrigido: volta a extrair
//      o segundo número de "Nome X/Y".
//   3) toggleAula (agenda) agora usa totalAula pra atualizar pacotePago, e recalcula
//      pacoteBase a partir do numAula do título — assim "Nome 5/15" digitado na agenda
//      corrige sozinho a contagem mesmo quando o aluno começa um pacote novo do mesmo
//      tamanho do anterior (situação em que não dava pra perceber a troca de ciclo).
//   4) 4 lugares (FinanceiroView, AlunosView, App) liam `s.pacote` (campo que não existe) em
//      vez de `s.pacotePago`. Todos corrigidos.
const {useState,useEffect,useRef,useCallback}=React;

// ── CONFIG ───────────────────────────────────────────────────────────────────
// CONFIG: troque a URL abaixo apos cada novo deploy do Apps Script
// ═══════════════════════════════════════════════════
// SEÇÃO 1: CONFIGURAÇÃO — URL do Google Apps Script
// Para atualizar: redeploy o script e cole a nova URL aqui
// ═══════════════════════════════════════════════════
const GS_URL="https://script.google.com/macros/s/AKfycbz2p_KI3DLo97tzbjx4d_pMJPfA_OGVgrvgSzDXbPjBdUkdtBOBYzJfXflwFw-Gf_ZH/exec";

// ── STORAGE — Google Sheets é a fonte de verdade ─────────────────────────────
// localStorage só serve de cache para uso offline
const ll=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}};
const ls=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};

async function gsLoad(){
  try{
    const r=await fetch(GS_URL+"?action=load");
    const j=await r.json();
    if(j.ok){
      // SEMPRE atualiza cache local com o que vem do Sheets
      Object.entries(j.data).forEach(([k,v])=>ls("fl_"+k,v));
      return j.data;
    }
  }catch(e){console.warn("Sheets offline, usando cache");}
  // fallback: cache local
  return null;
}

// Salva no cache local imediatamente + envia pro Sheets
async function gsSave(k,v){
  ls("fl_"+k,v);
  try{
    await fetch(GS_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",key:k,value:v})});
  }catch(e){
    // Marca como pendente para reenviar quando voltar online
    const pend=ll("fl_pending",[]);
    const novo=[...pend.filter(p=>p.k!==k),{k,ts:Date.now()}];
    ls("fl_pending",novo);
  }
}

// Reenviar dados pendentes quando voltar online
async function syncPending(allData){
  const pend=ll("fl_pending",[]);
  if(pend.length===0)return;
  for(const{k}of pend){
    const v=allData[k];
    if(v!==undefined)try{await fetch(GS_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",key:k,value:v})});}catch{}
  }
  ls("fl_pending",[]);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
const uid=()=>Math.random().toString(36).slice(2,9);
const todayStr=()=>new Date().toISOString().slice(0,10);
const DAYS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAY_FULL=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS_PT=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTHS=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const fmtDate=d=>new Date(d+"T12:00").toLocaleDateString("pt-BR",{day:"numeric",month:"short"});
const fmtFull=d=>new Date(d+"T12:00").toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});

// ── SEED ─────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════
// SEÇÃO 3: PLANOS DE TREINO PADRÃO (seed)
// Aparecem quando o usuário não tem planos salvos
// Cada plano tem: nome, dia, exercises[]
// ═══════════════════════════════════════════════════
const SEED_PLANS=[
  {id:"d1",dayIndex:1,trainingDays:[1,3,5],name:"Peito + Tríceps",exercises:[
    {id:"e1",name:"Supino Reto",sets:4,targetReps:10,restSeconds:90,muscleGroup:"peitoral"},
    {id:"e2",name:"Supino Inclinado",sets:3,targetReps:12,restSeconds:90,muscleGroup:"peitoral"},
    {id:"e3",name:"Crossover",sets:3,targetReps:15,restSeconds:60,muscleGroup:"peitoral"},
    {id:"e4",name:"Tríceps Corda",sets:3,targetReps:12,restSeconds:60,muscleGroup:"triceps"},
    {id:"e5",name:"Tríceps Francês",sets:3,targetReps:10,restSeconds:60,muscleGroup:"triceps"},
  ]},
  {id:"d2",dayIndex:3,trainingDays:[2,4],name:"Costas + Bíceps",exercises:[
    {id:"e6",name:"Puxada Frontal",sets:4,targetReps:10,restSeconds:90,muscleGroup:"costas"},
    {id:"e7",name:"Remada Curvada",sets:4,targetReps:10,restSeconds:90,muscleGroup:"costas"},
    {id:"e8",name:"Serrote",sets:3,targetReps:12,restSeconds:75,muscleGroup:"costas"},
    {id:"e9",name:"Rosca Direta",sets:3,targetReps:12,restSeconds:60,muscleGroup:"biceps"},
    {id:"e10",name:"Rosca Martelo",sets:3,targetReps:12,restSeconds:60,muscleGroup:"biceps"},
  ]},
  {id:"d3",dayIndex:5,trainingDays:[6],name:"Perna",exercises:[
    {id:"e11",name:"Agachamento",sets:4,targetReps:10,restSeconds:120,muscleGroup:"quadriceps"},
    {id:"e12",name:"Leg Press",sets:4,targetReps:12,restSeconds:90,muscleGroup:"quadriceps"},
    {id:"e13",name:"Cadeira Extensora",sets:3,targetReps:15,restSeconds:60,muscleGroup:"quadriceps"},
    {id:"e14",name:"Mesa Flexora",sets:3,targetReps:12,restSeconds:60,muscleGroup:"isquio"},
    {id:"e15",name:"Panturrilha em Pé",sets:4,targetReps:15,restSeconds:45,muscleGroup:"panturrilha"},
  ]},
];

// ── GRUPOS MUSCULARES ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════
// SEÇÃO 2: DADOS DE MÚSCULOS E SINERGISTAS
// MUSCLE_GROUPS: lista de grupos musculares com cores e músculos
// SINERGISTAS: quais grupos ajudam cada grupo principal
// ═══════════════════════════════════════════════════
const MUSCLE_GROUPS=[
  {id:"costas",label:"Costas",color:"#3b82f6"},{id:"peitoral",label:"Peitoral",color:"#ef4444"},
  {id:"deltA",label:"Deltóide Ant.",color:"#f97316"},{id:"deltM",label:"Deltóide Med.",color:"#eab308"},
  {id:"deltP",label:"Deltóide Post.",color:"#84cc16"},{id:"biceps",label:"Bíceps",color:"#14b8a6"},
  {id:"triceps",label:"Tríceps",color:"#8b5cf6"},{id:"quadriceps",label:"Quadríceps",color:"#ec4899"},
  {id:"isquio",label:"Isquiotibiais",color:"#f43f5e"},{id:"gluteos",label:"Glúteos",color:"#fb923c"},
  {id:"panturrilha",label:"Panturrilha",color:"#fbbf24"},{id:"abdomen",label:"Abdômen",color:"#34d399"},
  {id:"trapezio",label:"Trapézio",color:"#a78bfa"},
];
const VOLUME_REC={costas:10,peitoral:10,deltA:6,deltM:8,deltP:6,biceps:8,triceps:8,quadriceps:10,isquio:8,gluteos:8,panturrilha:8,abdomen:6,trapezio:4};
const EX_MUSCLE={"puxada":"costas","remada":"costas","pull down":"costas","serrote":"costas","barra livre":"costas","supino":"peitoral","crucifixo":"peitoral","cross":"peitoral","voador":"peitoral","flexão":"peitoral","desenvolvimento":"deltA","elevação frontal":"deltA","press":"deltA","elevação lateral":"deltM","remada alta":"deltM","voador invertido":"deltP","crucifixo invertido":"deltP","rosca":"biceps","martelo":"biceps","tríceps":"triceps","triceps":"triceps","mergulho":"triceps","agachamento":"quadriceps","leg press":"quadriceps","cadeira extensora":"quadriceps","passada":"quadriceps","avanço":"quadriceps","stiff":"isquio","terra":"isquio","flexora":"isquio","romanian":"isquio","glúteo":"gluteos","hip thrust":"gluteos","panturrilha":"panturrilha","abdominal":"abdomen","prancha":"abdomen","encolhimento":"trapezio"};
const detectMuscle=name=>{const l=name.toLowerCase();for(const[k,v]of Object.entries(EX_MUSCLE).sort((a,b)=>b[0].length-a[0].length))if(l.includes(k))return v;return null;};

// ── CLASSIFICAÇÃO DE TREINO ───────────────────────────────────────────────────
const WORKOUT_TYPES=[
  {id:"leve",label:"Leve",color:"#22c55e",emoji:"🟢"},
  {id:"moderado",label:"Moderado",color:"#eab308",emoji:"🟡"},
  {id:"pesado",label:"Pesado",color:"#ef4444",emoji:"🔴"},
  {id:"deload",label:"Deload",color:"#8b5cf6",emoji:"🟣"},
];

