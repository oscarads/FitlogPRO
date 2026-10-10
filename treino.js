// ── SPARKLINE ─────────────────────────────────────────────────────────────────
function Sparkline({data,color="#00e5ff",width=60,height=20}){
  if(!data||data.length<2)return null;
  const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-mn)/rng)*(height-4)-2}`).join(" ");
  const last=pts.split(" ").at(-1).split(",");
  return <svg width={width} height={height} style={{overflow:"visible"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/><circle cx={last[0]} cy={last[1]} r="3" fill={color}/></svg>;
}

// ── ENGINE DE PROGRESSÃO ─────────────────────────────────────────────────────
// ENGINE DE PROGRESSAO - logica de sugestao de carga, 1RM, fadiga, deload
const COMPOSTOS_KW=["supino","agachamento","terra","levantamento","remada","puxada","press","desenvolvimento","leg press","stiff","romanian","hack","barra"];
const isComposto=n=>COMPOSTOS_KW.some(k=>n.toLowerCase().includes(k));

// Sinergistas musculares — mesmo sistema do Montador Pro
// Ex: supino (peitoral) ativa triceps + delt anterior como secundarios
const SINERGISTAS={
  peitoral:["triceps","deltA"],costas:["biceps","deltP"],
  quads:["gluteos"],isquio:["gluteos"],gluteos:["isquio"],
  deltA:["peitoral","triceps"],deltM:[],deltP:["costas","biceps"],
  trapezio:["costas"],biceps:[],triceps:[],core:[],panturrilha:[],
};
const MUSCULOS_LABEL={
  peitoral:"Peitoral",costas:"Costas",quads:"Quadriceps",isquio:"Isquiotibiais",
  gluteos:"Gluteos",deltA:"Delt Anterior",deltM:"Delt Medial",deltP:"Delt Posterior",
  trapezio:"Trapezio",biceps:"Biceps",triceps:"Triceps",core:"Core",panturrilha:"Panturrilha",
};

// 1RM estimado — fórmula de Epley
const calc1RM=(carga,reps)=>reps===1?carga:carga*(1+reps/30);
const calcMax1RM=log=>Math.max(...(log.sets||[]).map(s=>calc1RM(parseFloat(s.weight)||0,parseInt(s.reps)||1)),0);

// Detecção de fadiga intra-treino — queda acentuada entre séries
function detectarFadigaIntra(log){
  const reps=(log.sets||[]).map(s=>parseInt(s.reps)||0).filter(r=>r>0);
  if(reps.length<3) return null;
  const primeira=reps[0], ultima=reps.at(-1);
  const queda=((primeira-ultima)/primeira)*100;
  if(queda>=30) return{nivel:"alta",queda:queda.toFixed(0)};
  if(queda>=20) return{nivel:"moderada",queda:queda.toFixed(0)};
  return null;
}

// Aquecimento baseado no 1RM estimado
// 1RM = carga × (1 + reps/30)  [Epley]
// Aquec 1: 40% do 1RM × 12 reps
// Aquec 2: 60% do 1RM × 8 reps
function calcAquecimento(rm1){
  if(!rm1||rm1===0) return null;
  const s1=Math.round((rm1*0.40)/2.5)*2.5;
  const s2=Math.round((rm1*0.60)/2.5)*2.5;
  return{s1,s2,reps1:12,reps2:8,rm1:rm1.toFixed(1)};
}

// ═══════════════════════════════════════════════════
// SEÇÃO 5: ANÁLISE DE PROGRESSÃO
// analisarExercicio: compara último treino com histórico
//   Retorna: status (aumentar/manter/descanso/aquecimento)
//            sugestao, cargaSugerida, cor, emoji
// ProgressaoCard: componente que exibe a análise na Home
// ═══════════════════════════════════════════════════
function analisarExercicio(ex,logs,posicaoNoTreino){
  // Exercícios de aquecimento não recebem sugestão de aumento
  if(/aquecimento/i.test(ex.name||"")){
    return{status:"aquecimento",msg:"Aquecimento",sugestao:"Série de aquecimento",
      detalhe:"Não conta no volume nem no 1RM",cor:"#eab308",emoji:"🔥",cargaAtual:0};
  }
  const nome=ex.name;
  // Exclui logs de aquecimento do mesmo exercicio para nao contaminar o 1RM
  // Ex: "Remada Maquina (aquecimento)" nao deve influenciar "Remada Maquina"
  const nomeBase=nome.replace(/\s*\(aquecimento\)/i,'').trim();
  const exLogs=logs
    .filter(l=>{
      // match por ID exato (mais seguro)
      if(l.exerciseId===ex.id) return true;
      // match por nome — exclui logs de aquecimento
      const logNome=(l.name||'').replace(/\s*\(aquecimento\)/i,'').trim();
      if(logNome!==nomeBase) return false;
      // exclui logs cujo nome original continha "(aquecimento)"
      if(/aquecimento/i.test(l.name||'')) return false;
      return true;
    })
    .sort((a,b)=>a.date.localeCompare(b.date));

  const composto=isComposto(nome);
  const incremento=composto?2.5:1.25;
  const faixaMin=ex.targetRepsMin||(ex.targetReps?Math.max(ex.targetReps-2,1):8);
  const faixaMax=ex.targetReps||12;

  // aquecimento — só nos 2 primeiros exercícios
  const precisaAquecimento=posicaoNoTreino<2;

  if(exLogs.length===0){
    // Sem histórico: sugere carga inicial baseada no tipo
    const cargaInicial=composto?20:10;
    return{
      status:"sem_dados",
      msg:"Primeiro treino — registre a carga hoje para começar o acompanhamento",
      sugestao:`Comece com ~${cargaInicial}kg para calibrar`,
      cor:"#4a7a9b",emoji:"🆕",
      cargaAtual:cargaInicial,
      composto,
      aquecimento:precisaAquecimento?calcAquecimento(cargaInicial*1.2):null,
      precisaAquecimento,
      fadigaIntra:null,
      rm1:0,
    };
  }

  const ultimoLog=exLogs.at(-1);
  const penultimoLog=exLogs.length>=2?exLogs.at(-2):null;
  const antepenultimoLog=exLogs.length>=3?exLogs.at(-3):null;

  const rm1Atual=calcMax1RM(ultimoLog);
  const rm1Prev=penultimoLog?calcMax1RM(penultimoLog):null;
  const rm1Antes=antepenultimoLog?calcMax1RM(antepenultimoLog):null;

  const maxCargaAtual=Math.max(...(ultimoLog.sets||[]).map(s=>parseFloat(s.weight)||0),0);
  const cargaSugerida=parseFloat((maxCargaAtual+incremento).toFixed(2));

  const todasNoTopo=(ultimoLog.sets||[]).filter(s=>s.reps).every(s=>parseInt(s.reps)>=faixaMax);
  const todasNaFaixa=(ultimoLog.sets||[]).filter(s=>s.reps).every(s=>parseInt(s.reps)>=faixaMin);
  const fadigaIntra=detectarFadigaIntra(ultimoLog);

  // queda de 1RM
  const quedaConsecutiva=rm1Prev!==null&&rm1Antes!==null&&rm1Atual<rm1Prev&&rm1Prev<rm1Antes;
  const quedaRecente=rm1Prev!==null&&rm1Atual<rm1Prev*0.95;

  // progressão consistente de 1RM
  const progressao1RM=rm1Antes!==null&&rm1Atual>rm1Prev&&rm1Prev>rm1Antes;

  const aquecimento=precisaAquecimento?calcAquecimento(rm1Atual):null;

  const base={composto,aquecimento,precisaAquecimento,fadigaIntra,rm1:rm1Atual.toFixed(1),cargaAtual:maxCargaAtual};

  // FADIGA INTRA SEVERA — problema de descanso, não de carga
  if(fadigaIntra?.nivel==="alta"&&!quedaConsecutiva) return{...base,
    status:"descanso",
    msg:`Queda de ${fadigaIntra.queda}% nas reps entre a 1ª e última série`,
    sugestao:`Mantenha ${maxCargaAtual}kg · aumente o descanso entre séries`,
    detalhe:"A carga está boa mas o intervalo de descanso pode ser curto. Antes de aumentar carga, estabilize as reps.",
    cor:"#f97316",emoji:"⏱️",
  };

  // DELOAD
  if(quedaConsecutiva) return{...base,
    status:"deload",
    msg:`1RM em queda consecutiva (${rm1Antes?.toFixed(0)}→${rm1Prev?.toFixed(0)}→${rm1Atual.toFixed(0)}kg est.)`,
    sugestao:`Reduza para ${(maxCargaAtual*0.9).toFixed(1)}kg ou faça deload`,
    detalhe:"Queda de performance em 2+ sessões seguidas. Recuperação incompleta ou volume excessivo.",
    cor:"#ef4444",emoji:"⚠️",
  };

  // FADIGA RECENTE
  if(quedaRecente&&!todasNaFaixa) return{...base,
    status:"fadiga",
    msg:`1RM caiu vs sessão anterior`,
    sugestao:`Mantenha ${maxCargaAtual}kg · foco em qualidade de execução`,
    detalhe:`1RM estimado atual: ${rm1Atual.toFixed(1)}kg vs ${rm1Prev?.toFixed(1)}kg anterior`,
    cor:"#f97316",emoji:"😓",
  };

  // AUMENTAR CARGA
  // Só aumenta se: reps no topo E peso foi consistente (sem queda entre séries)
  const setsComPeso=(ultimoLog.sets||[]).filter(s=>s.reps&&!s.isWarmup);
  const pesos=setsComPeso.map(s=>parseFloat(s.weight)||0).filter(p=>p>0);
  const cargaConsistente=pesos.length<2||pesos.every(p=>p>=pesos[0]*0.92); // queda >8% = inconsistente
  if(todasNoTopo&&cargaConsistente&&(progressao1RM||rm1Prev===null||rm1Atual>=rm1Prev)){
    return{...base,
      status:"aumentar",
      msg:`Todas as séries no topo da faixa (${faixaMax} reps) com carga consistente ✓`,
      sugestao:`Aumente para ${cargaSugerida}kg`,
      detalhe:`${composto?"Composto: +2.5kg (progressão conservadora)":"Isolador: +1.25kg (progressão frequente)"} · 1RM est. ${rm1Atual.toFixed(1)}kg`,
      cor:"#00c864",emoji:"🚀",
      cargaSugerida,
    };
  }
  // Atingiu reps mas carga caiu → estabilizar antes de aumentar
  if(todasNoTopo&&!cargaConsistente){
    return{...base,
      status:"descanso",
      msg:`Boas reps mas carga variou entre séries (${pesos[0]}→${pesos.at(-1)}kg)`,
      sugestao:`Estabilize em ${pesos[0]}kg antes de subir`,
      detalhe:"Quando conseguir manter a mesma carga em todas as séries, aí aumenta.",
      cor:"#f97316",emoji:"⏱️",
    };
  }

  // PROGREDIR REPS
  if(todasNaFaixa) return{...base,
    status:"progredir_reps",
    msg:`Dentro da faixa · tente chegar em ${faixaMax} reps em todas as séries`,
    sugestao:`Mantenha ${maxCargaAtual}kg`,
    detalhe:`1RM estimado: ${rm1Atual.toFixed(1)}kg`,
    cor:"#00b4d8",emoji:"💪",
  };

  // MANTER
  return{...base,
    status:"manter",
    msg:"Performance dentro do esperado",
    sugestao:`Mantenha ${maxCargaAtual}kg`,
    detalhe:`1RM estimado: ${rm1Atual.toFixed(1)}kg${fadigaIntra?` · leve queda entre séries (${fadigaIntra.queda}%)`:""} `,
    cor:"#eab308",emoji:"➡️",
  };
}

// ── Card de análise por exercício ─────────────────────────────────────────────
// ProgressaoCard: card individual exibido na tela de pré-treino (PreTreinoAnalise).
// Usa analisarExercicio() para decidir o que mostrar e deixa o usuário marcar
// (aquecFez) se já fez as séries de aquecimento sugeridas.
// Props: exercicio (objeto do plano), logs (histórico geral), posicao (índice do exercício no treino)
function ProgressaoCard({exercicio,logs,posicao}){
  const a=analisarExercicio(exercicio,logs,posicao);
  const [aberto,setAberto]=useState(false);
  const [aquecFez,setAquecFez]=useState([false,false]);

  return <div style={{background:"#0a1628",border:`1px solid ${a.cor}44`,borderRadius:16,marginBottom:10,overflow:"hidden"}}>
    {/* Header */}
    <div onClick={()=>setAberto(!aberto)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",cursor:"pointer"}}>
      <span style={{fontSize:24,flexShrink:0}}>{a.emoji}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <span style={{fontSize:15,fontWeight:800,color:"#fff"}}>{exercicio.name}</span>
          <span style={{fontSize:10,color:a.composto?"#f97316":"#8b5cf6",background:a.composto?"rgba(249,115,22,0.12)":"rgba(139,92,246,0.12)",padding:"1px 7px",borderRadius:20}}>{a.composto?"Composto":"Isolador"}</span>
        </div>
        <div style={{fontSize:13,color:a.cor,fontWeight:600}}>{a.sugestao}</div>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        {a.cargaAtual>0&&<div style={{fontSize:18,fontWeight:900,color:"#fff"}}>{a.cargaAtual}kg</div>}
        {a.cargaSugerida&&<div style={{fontSize:13,color:"#00c864",fontWeight:700}}>→ {a.cargaSugerida}kg</div>}
        {a.rm1>0&&<div style={{fontSize:10,color:"#2a5a7a"}}>1RM ~{a.rm1}kg</div>}
      </div>
      <span style={{fontSize:14,color:"#2a5a7a",marginLeft:4}}>{aberto?"▲":"▼"}</span>
    </div>

    {/* Aquecimento — destaque visual */}
    {a.aquecimento&&<div style={{margin:"0 14px 10px",background:"rgba(234,179,8,0.07)",border:"1px solid #eab30833",borderRadius:12,padding:"10px 14px"}}>
      <div style={{fontSize:10,color:"#eab308",letterSpacing:1,marginBottom:8}}>🔥 AQUECIMENTO SUGERIDO</div>
      <div style={{display:"flex",gap:8}}>
        {[{s:a.aquecimento.s1,r:a.aquecimento.reps1,pct:"40%",i:0},{s:a.aquecimento.s2,r:a.aquecimento.reps2,pct:"60%",i:1}].map(({s:kg,r,pct,i})=>(
          <div key={i} onClick={()=>setAquecFez(prev=>{const n=[...prev];n[i]=!n[i];return n;})}
            style={{flex:1,padding:"10px",borderRadius:10,cursor:"pointer",textAlign:"center",
              background:aquecFez[i]?"rgba(0,200,100,0.12)":"rgba(0,0,0,0.2)",
              border:`1px solid ${aquecFez[i]?"#00c86455":"#eab30833"}`}}>
            <div style={{fontSize:10,color:"#eab308",marginBottom:3}}>{pct} da carga</div>
            <div style={{fontSize:18,fontWeight:800,color:aquecFez[i]?"#00c864":"#fff"}}>{kg}kg</div>
            <div style={{fontSize:12,color:"#4a7a9b"}}>{r} reps</div>
            {aquecFez[i]&&<div style={{fontSize:14,color:"#00c864",marginTop:3}}>✓ feito</div>}
          </div>
        ))}
      </div>
    </div>}

    {/* Detalhe expandido */}
    {aberto&&<div style={{padding:"0 16px 14px",borderTop:"1px solid #0e2035"}}>
      <div style={{fontSize:13,color:"#aaa",marginTop:10,marginBottom:4}}>{a.msg}</div>
      {a.detalhe&&<div style={{fontSize:12,color:"#4a7a9b",lineHeight:1.5}}>{a.detalhe}</div>}
      {a.fadigaIntra&&<div style={{marginTop:8,padding:"8px 10px",background:"rgba(249,115,22,0.07)",borderRadius:8,fontSize:12,color:"#f97316"}}>
        ⏱️ Queda de {a.fadigaIntra.queda}% nas reps entre 1ª e última série — considere mais descanso antes de subir a carga
      </div>}
    </div>}
  </div>;
}

// ── Tela pré-treino ───────────────────────────────────────────────────────────
// PreTreinoAnalise: tela mostrada ANTES de começar o treino (botão "Iniciar Treino de Hoje").
// Roda analisarExercicio() para cada exercício do plano e:
//  - conta quantos exercícios estão com status ruim (deload/fadiga/descanso)
//  - se >= 50% dos exercícios estão ruins, sugere uma semana de Deload (sugerirDeload)
//  - mostra um ProgressaoCard por exercício
// onIniciar: chamado quando o usuário confirma e o treino vira "ativo" (ActiveWorkout)
function PreTreinoAnalise({plan,logs,onIniciar,onVoltar}){
  const analises=plan.exercises.map((ex,i)=>analisarExercicio(ex,logs,i));
  const qtdProblema=analises.filter(a=>["deload","fadiga","descanso"].includes(a.status)).length;
  const sugerirDeload=qtdProblema>=Math.ceil(plan.exercises.length*0.5);
  const qtdAumentar=analises.filter(a=>a.status==="aumentar").length;
  const rm1Max=Math.max(...analises.map(a=>parseFloat(a.rm1)||0),0);

  return <div style={{minHeight:"100vh",background:"#060d18",maxWidth:960,margin:"0 auto",paddingBottom:100}}>
    <div style={{background:"#0a1628",padding:"16px 18px",borderBottom:"1px solid #0e2035",position:"sticky",top:0,zIndex:10}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onVoltar} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase"}}>Análise pré-treino</div>
          <div style={{fontSize:17,fontWeight:800}}>{plan.name}</div>
        </div>
        {qtdAumentar>0&&<span style={{fontSize:12,background:"rgba(0,200,100,0.12)",color:"#00c864",padding:"4px 10px",borderRadius:20,fontWeight:700}}>🚀 {qtdAumentar} pra subir</span>}
      </div>
    </div>

    <div style={{padding:"16px 18px"}}>
      {sugerirDeload&&<div style={{background:"rgba(239,68,68,0.09)",border:"1px solid #ef444433",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:700,color:"#ef4444",marginBottom:4}}>⚠️ Semana de Deload recomendada</div>
        <div style={{fontSize:13,color:"#ef4444aa",lineHeight:1.5}}>{qtdProblema} de {plan.exercises.length} exercícios em queda. Treine com 60–70% da carga por uma semana para recuperar.</div>
      </div>}

      <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:12}}>EXERCÍCIOS · SUGESTÕES DE HOJE</div>
      {plan.exercises.map((ex,i)=><ProgressaoCard key={ex.id} exercicio={ex} logs={logs} posicao={i}/>)}

      <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:"12px 14px",marginTop:4}}>
        <div style={{fontSize:10,color:"#4a7a9b",marginBottom:6}}>LEGENDA</div>
        {[["🚀","Aumentar carga — atingiu o topo"],["💪","Progredir reps — mantém carga"],["➡️","Manter — estável"],["⏱️","Aumentar descanso antes de subir carga"],["😓","Fadiga — não sobe nada"],["⚠️","Deload — reduzir carga"]].map(([e,l])=>(
          <div key={e} style={{display:"flex",gap:8,marginBottom:4}}><span style={{fontSize:14}}>{e}</span><span style={{fontSize:12,color:"#4a7a9b"}}>{l}</span></div>
        ))}
      </div>
    </div>

    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:960,padding:"14px 18px",background:"#060d18",borderTop:"1px solid #0e2035"}}>
      <button onClick={onIniciar} style={{width:"100%",padding:"15px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontSize:16,fontWeight:800,cursor:"pointer"}}>
        ▶ Iniciar Treino
      </button>
    </div>
  </div>;
}

// ── REST TIMER ────────────────────────────────────────────────────────────────
// RestTimer: contador regressivo circular mostrado entre as séries de um exercício.
// init = segundos totais de descanso (vem de ex.restSeconds).
// Usa endTs (timestamp alvo) em vez de só decrementar um contador, para o timer
// continuar certo mesmo se o app ficar em segundo plano (celular trava o setInterval).
// onDone: chamado automaticamente quando o tempo zera. onSkip: usuário pulou manualmente.
function RestTimer({seconds:init,onDone,onSkip}){
  const endTs=useRef(Date.now()+init*1000);
  const [left,setLeft]=useState(init);const ref=useRef();
  useEffect(()=>{
    const tick=()=>{const r=Math.max(0,Math.round((endTs.current-Date.now())/1000));setLeft(r);if(r<=0){clearInterval(ref.current);onDone();}};
    ref.current=setInterval(tick,300);
    return()=>clearInterval(ref.current);
  },[]);
  const pct=((init-left)/init)*100,r=44,circ=2*Math.PI*r;
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 0 8px"}}>
    <div style={{position:"relative",width:110,height:110,marginBottom:10}}>
      <svg width="110" height="110" style={{transform:"rotate(-90deg)"}}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="#1e2a3a" strokeWidth="8"/>
        <circle cx="55" cy="55" r={r} fill="none" stroke="#00e5ff" strokeWidth="8" strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.8s linear"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:28,fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{String(Math.floor(left/60)).padStart(2,"0")}:{String(left%60).padStart(2,"0")}</span>
        <span style={{fontSize:10,color:"#4a9ebb",letterSpacing:2}}>DESCANSO</span>
      </div>
    </div>
    <button onClick={onSkip} style={{padding:"7px 24px",borderRadius:20,border:"1px solid #1e3a4a",background:"transparent",color:"#4a9ebb",fontSize:13,cursor:"pointer"}}>Pular →</button>
  </div>;
}

// ── ACTIVE WORKOUT ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════
// SEÇÃO 6: TREINO ATIVO
// Componente principal durante o treino
// - Mostra exercícios com séries, peso, reps
// - Timer de descanso
// - Séries de aquecimento em amarelo (isWarmup)
// - Ao finalizar: salva log no Google Sheets
// ═══════════════════════════════════════════════════
// Props:
//   plan        -> o plano de treino sendo executado (pode vir com plan._resume se o usuário
//                   estava no meio de um treino e voltou pela tela "Continuar treino")
//   logs        -> histórico de todos os treinos já feitos (usado pra pré-preencher carga/reps)
//   onFinish    -> chamado ao salvar o treino finalizado
//   onCancel    -> chamado ao sair sem finalizar
function ActiveWorkout({plan,logs,lastSession,onFinish,onCancel}){
  // ✅ CORRIGIDO: troquei a ordem — `const resume` agora vem ANTES de ser usado nos useState.
  // Antes: useState(resume?.exIdx) vinha nas linhas 557-558, e só depois (linha 559) resume
  // era declarado. Isso é ilegal em JS (erro "Cannot access before initialization") porque
  // "const" não sobe pro topo do escopo pra poder ser lido antes da própria linha onde nasce.
  const resume=plan._resume;
  const [exIdx,setExIdx]=useState(resume?.exIdx||0);
  const [setIdx,setSetIdx]=useState(resume?.setIdx||0);
  // entries = o estado principal do treino: um array (1 item por exercício do plano) com
  // as séries (sets) que o usuário vai preenchendo (peso, reps, se já foi feita/done).

  // Se `resume.entries` existir, restaura de onde parou; senão monta do zero a partir do plano,
  // já calculando as séries de aquecimento (warmupSetsBuilt) com base no último peso usado.
  const [entries,setEntries]=useState(()=>{
    // Restore from saved progress if resuming
    if(resume?.entries) return resume.entries;
    return plan.exercises.map(ex=>{
      // Detecta exercício de aquecimento pelo nome OU pela flag isAquecimento
      const isLegacyWarmup=!!(ex.isAquecimento)||/\(aquecimento\)/i.test(ex.name||"");
      // Busca último log de trabalho (ignora aquecimento) para calcular pesos de warmup
      const lastLog=logs.filter(l=>l.exerciseId===ex.id).at(-1);
      const lastWeight=lastLog
        ?Math.max(...(lastLog.sets||[]).filter(s=>!s.isWarmup).map(s=>parseFloat(s.weight)||0),0)
        :0;

      // Séries de aquecimento definidas no plano (warmupSets)
      const warmupDefs=ex.warmupSets||[];
      const warmupSetsBuilt=warmupDefs.map((ws,wi)=>{
        const pct=[0.4,0.6,0.8][wi]??0.6;
        const wkg=lastWeight>0?Math.round(lastWeight*pct*2)/2:0;
        return {
          reps:String(ws.repsMax||ws.repsMin||12),
          weight:wkg>0?String(wkg):"",
          done:false,isWarmup:true,
          isSeconds:!!(ws.isSeconds),
          repsMin:ws.repsMin||ws.repsMax||12,
          repsMax:ws.repsMax||ws.repsMin||12,
          restSeconds:ws.restSeconds||45
        };
      });

      // Séries de trabalho
      const workSets=Array.from({length:ex.sets||3},(_,wi)=>({
        reps:"",weight:"",done:false,
        isWarmup:isLegacyWarmup, // exercícios antigos com (aquecimento) = tudo amarelo
        isSeconds:!!(ex.isSeconds),
        repsMin:ex.targetRepsMin||ex.targetReps||8,
        repsMax:ex.targetReps||12
      }));

      return {
        exerciseId:ex.id,name:ex.name,
        targetRepsMin:ex.targetRepsMin,targetReps:ex.targetReps,
        isSeconds:!!(ex.isSeconds),
        restSeconds:ex.restSeconds||90,
        muscleGroup:ex.muscleGroup||detectMuscle(ex.name)||"",
        sets:[...warmupSetsBuilt,...workSets]
      };
    });
  });
  const [resting,setResting]=useState(false);
  const [startTime]=useState(resume?.startTime||Date.now());
  const [workoutType,setWorkoutType]=useState("moderado");
  const [notes,setNotes]=useState("");
  const [showFinish,setShowFinish]=useState(false);

  // Salva treino em andamento no localStorage para não perder se sair do app
  useEffect(()=>{
    ls("fl_workout_inprogress",{planId:plan.id,planName:plan.name,entries,exIdx,setIdx,startTime,workoutType,notes});
  },[entries,exIdx,setIdx,workoutType,notes]);

  // Limpa ao finalizar
  const clearInProgress=()=>ls("fl_workout_inprogress",null);

  // pré-preenche com último treino — só séries de trabalho (não aquecimento)
  useEffect(()=>{
    if(resume?.entries) return;
    setEntries(prev=>prev.map((entry,i)=>{
      const ex=plan.exercises[i];
      const last=logs.filter(l=>l.exerciseId===ex.id).at(-1);
      if(!last)return entry;
      // Filtra só os sets de trabalho do log anterior (ignora warmup salvos)
      const lastWorkSets=(last.sets||[]).filter(s=>!s.isWarmup);
      // Aplica só nas séries de trabalho do entry atual
      let workIdx=0;
      const newSets=entry.sets.map(s=>{
        if(s.isWarmup) return s; // mantém warmup como está
        const lw=lastWorkSets[workIdx++];
        if(!lw) return s;
        return{...s,weight:lw.weight??"",reps:lw.reps??""};
      });
      return{...entry,sets:newSets};
    }));
  },[]);

  const ex=plan.exercises[exIdx];
  const cur=entries[exIdx];
  const lastLog=logs.filter(l=>l.exerciseId===ex?.id).at(-1);
  // updateField: atualiza o campo "weight" ou "reps" da série ATIVA (exIdx/setIdx).
  // Efeito colateral importante: se o campo alterado é "weight" de uma série de TRABALHO,
  // recalcula automaticamente o peso das séries de AQUECIMENTO (40% e 60% do peso digitado).
  const updateField=(field,val)=>setEntries(prev=>prev.map((e,ei)=>{
    if(ei!==exIdx) return e;
    const newSets=e.sets.map((s,si)=>si!==setIdx?s:{...s,[field]:val});
    // Se atualizou o peso de uma série de trabalho, recalcula aquecimentos (40%/60%)
    if(field==="weight"&&!newSets[setIdx]?.isWarmup){
      const wPeso=parseFloat(val)||0;
      if(wPeso>0){
        let wIdx=0;
        return{...e,sets:newSets.map(s=>{
          if(!s.isWarmup) return s;
          const pct=wIdx===0?0.4:0.6;
          wIdx++;
          return{...s,weight:String(Math.round(wPeso*pct*2)/2)};
        })};
      }
    }
    return{...e,sets:newSets};
  }));

  const [suggestCarga,setSuggestCarga]=useState(null);
  const [showMgPicker,setShowMgPicker]=useState(false);
  const setMuscleGroup=mg=>setEntries(prev=>prev.map((e,i)=>i===exIdx?{...e,muscleGroup:mg}:e));

  // completeSet: chamado quando o usuário aperta ✓ numa série.
  // 1) marca a série atual como done:true
  // 2) compara as reps feitas com a faixa alvo (targetRepsMin/targetReps) e sugere
  //    aumentar ou reduzir a carga da PRÓXIMA série (setSuggestCarga)
  // 3) se todas as séries de TRABALHO (isWarmup:false) de TODOS os exercícios estão done,
  //    já mostra a tela de finalizar (showFinish); senão, inicia o RestTimer (setResting)
  const completeSet=()=>{
    setEntries(prev=>prev.map((e,ei)=>ei!==exIdx?e:{...e,sets:e.sets.map((s,si)=>si!==setIdx?s:{...s,done:true})}));
    const lastSet=setIdx>=ex.sets-1,lastEx=exIdx>=plan.exercises.length-1;
    // Sugestão: aparece durante o descanso
    const curReps=parseInt(cur?.sets[setIdx]?.reps)||0;
    const faixaMax=ex.targetReps||12;
    const faixaMin=ex.targetRepsMin||Math.max(faixaMax-2,1);
    const curWeight=parseFloat(cur?.sets[setIdx]?.weight)||0;
    const composto=isComposto(ex.name);
    const inc=composto?2.5:1.25;
    const nextSetIdx=setIdx+1; // suggestion applies to NEXT set
    if(curReps>faixaMax&&!lastSet&&curWeight>0){
      const nova=parseFloat((curWeight+inc).toFixed(2));
      setSuggestCarga({nova,nextSetIdx,motivo:`Você fez ${curReps} reps (acima de ${faixaMax}). Próxima série: ${nova}kg`});
    } else if(curReps<faixaMin&&curReps>0&&!lastSet){
      const nova=parseFloat(Math.max(curWeight-inc,0).toFixed(2));
      setSuggestCarga({nova,nextSetIdx,reduzir:true,motivo:`Você fez ${curReps} reps (abaixo de ${faixaMin}). Próxima série: ${nova}kg`});
    } else {
      setSuggestCarga(null);
    }
    // Só finaliza automaticamente se TODAS as series de TODOS os exercicios estao feitas
    // Apenas séries de trabalho precisam estar feitas para finalizar
    const allDone=entries.every(e=>e.sets.filter(s=>!s.isWarmup).every(s=>s.done));
    if(allDone)setShowFinish(true);else setResting(true);
  };
  // afterRest: chamado quando o descanso termina (ou é pulado).
  // Procura a próxima série NÃO feita: primeiro dentro do exercício atual, depois nos
  // exercícios seguintes. Se não achar nenhuma, mostra a tela de finalizar.
  const afterRest=()=>{
    setResting(false);
    // Find next undone set in current exercise
    const curEx=entries[exIdx];
    const nextSetInEx=curEx?.sets.findIndex((s,i)=>i>setIdx&&!s.done);
    if(nextSetInEx!==-1&&nextSetInEx!==undefined){
      setSetIdx(nextSetInEx);
    } else {
      // Move to next exercise that has undone sets
      let found=false;
      for(let ei=exIdx+1;ei<entries.length;ei++){
        const firstUndone=entries[ei].sets.findIndex(s=>!s.done);
        if(firstUndone!==-1){setExIdx(ei);setSetIdx(firstUndone);found=true;break;}
      }
      if(!found) setShowFinish(true);
    }
  };
  // finish: monta o objeto de sessão final e entrega pro App via onFinish (que salva no Sheets).
  const finish=()=>{clearInProgress();onFinish({entries,date:todayStr(),planId:plan.id,planName:plan.name,duration:Math.round((Date.now()-startTime)/60000),workoutType,notes});};

  const totalSets=plan.exercises.reduce((a,e)=>a+e.sets,0);
  const doneSets=entries.reduce((a,e)=>a+e.sets.filter(s=>s.done).length,0);
  const wt=WORKOUT_TYPES.find(t=>t.id===workoutType);

  if(showFinish) return <div style={{minHeight:"100vh",background:"#060d18",maxWidth:960,margin:"0 auto",padding:"30px 20px"}}>
    <div style={{textAlign:"center",marginBottom:24}}>
      <div style={{fontSize:48,marginBottom:8}}>🏁</div>
      <div style={{fontSize:22,fontWeight:800}}>Treino finalizado!</div>
      <div style={{fontSize:13,color:"#4a7a9b",marginTop:4}}>{Math.round((Date.now()-startTime)/60000)} min · {doneSets} séries</div>
    </div>
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:8}}>COMO FOI O TREINO?</div>
      <div style={{display:"flex",gap:8}}>
        {WORKOUT_TYPES.map(t=><button key={t.id} onClick={()=>setWorkoutType(t.id)} style={{flex:1,padding:"10px 4px",borderRadius:12,border:`2px solid ${workoutType===t.id?t.color:"#0e2035"}`,background:workoutType===t.id?t.color+"22":"transparent",color:workoutType===t.id?t.color:"#4a7a9b",fontSize:12,fontWeight:workoutType===t.id?700:400,cursor:"pointer"}}>
          <div style={{fontSize:18}}>{t.emoji}</div>{t.label}
        </button>)}
      </div>
    </div>
    <div style={{marginBottom:20}}>
      <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:8}}>NOTAS DO TREINO</div>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Como você se sentiu? Algo para lembrar..." rows={3}
        style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,padding:"12px 14px",color:"#fff",fontSize:14,outline:"none",resize:"none"}}/>
    </div>
    <button onClick={finish} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontSize:16,fontWeight:800,cursor:"pointer"}}>
      💾 Salvar Treino
    </button>
  </div>;

  return <div style={{minHeight:"100vh",background:"#060d18",maxWidth:960,margin:"0 auto"}}>
    <div style={{background:"#0a1628",padding:"14px 18px 10px",borderBottom:"1px solid #0e2035",position:"sticky",top:0,zIndex:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase"}}>Treinando</div>
          <div style={{fontSize:17,fontWeight:700}}>{plan.name}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:18}}>{wt?.emoji}</span>
          <button onClick={()=>{if(confirm("Sair do treino? O progresso foi salvo automaticamente.")){clearInProgress();onCancel();}}} style={{background:"none",border:"1px solid #1e3a4a",borderRadius:8,color:"#4a7a9b",padding:"6px 12px",cursor:"pointer",fontSize:13}}>← Sair</button>
        </div>
      </div>
      <div style={{height:4,background:"#0e2035",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(doneSets/totalSets)*100}%`,background:"linear-gradient(90deg,#00b4d8,#00e5ff)",borderRadius:4,transition:"width 0.4s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <span style={{fontSize:11,color:"#4a7a9b"}}>{doneSets}/{totalSets} séries</span>
        <span style={{fontSize:11,color:"#4a7a9b"}}>{Math.round((Date.now()-startTime)/60000)}min</span>
      </div>
    </div>
    <div style={{padding:"14px 18px"}}>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14,scrollbarWidth:"none"}}>
        {plan.exercises.map((e,i)=>{
          const done=entries[i]?.sets.every(s=>s.done);const active=i===exIdx;
          return <button key={e.id} onClick={()=>{setExIdx(i);setSetIdx(entries[i].sets.findIndex(s=>!s.done)||0);}}
            style={{flex:"0 0 auto",padding:"5px 12px",borderRadius:20,border:`1px solid ${active?"#00e5ff":done?"#0d3a2a":"#0e2035"}`,background:active?"rgba(0,229,255,0.1)":done?"rgba(0,200,100,0.07)":"transparent",color:active?"#00e5ff":done?"#00c864":"#4a7a9b",fontSize:12,fontWeight:active?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>
            {done?"✓ ":""}{e.name}
          </button>;
        })}
      </div>
      {ex&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{fontSize:20,fontWeight:800}}>{ex.name}</div>
              {/* Dot clicável para trocar grupo muscular */}
              {(()=>{
                const _mg=cur.muscleGroup||detectMuscle(ex.name||"");
                const _mi=MUSCLE_GROUPS.find(m=>m.id===_mg);
                return <div onClick={()=>setShowMgPicker(!showMgPicker)}
                  title={_mi?_mi.label:"Grupo muscular"}
                  style={{width:20,height:20,borderRadius:"50%",cursor:"pointer",flexShrink:0,
                    background:_mi?_mi.color+"44":"#0e2035",
                    border:"2px solid "+(_mi?_mi.color:"#2a5a7a")}}/>;
              })()}
            </div>
            <div style={{fontSize:13,color:"#4a7a9b",marginTop:2}}>
              {(()=>{
                const wSets=cur.sets.filter(s=>s.isWarmup).length;
                const wkSets=cur.sets.filter(s=>!s.isWarmup).length;
                const repsStr=ex.isSeconds?`${ex.targetReps}s`:(ex.targetRepsMin&&ex.targetRepsMin!==ex.targetReps?`${ex.targetRepsMin}-${ex.targetReps}`:ex.targetReps||12)+" reps";
                return <>
                  {wSets>0&&<span style={{color:"#eab308",marginRight:6}}>🔥{wSets}aq +</span>}
                  {wkSets}×{repsStr} · {ex.restSeconds||90}s
                </>;
              })()}
            </div>
            {lastLog?.sets&&lastLog.sets.length>0&&(()=>{
              const workSets=(lastLog.sets||[]).filter(s=>!s.isWarmup);
              const maxW=Math.max(...workSets.map(s=>parseFloat(s.weight)||0),0);
              const repsArr=workSets.map(s=>s.reps||"0").join("/");
              if(maxW===0)return null;
              return <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:4,
                padding:"3px 10px",borderRadius:20,
                background:"rgba(0,180,216,0.1)",border:"1px solid rgba(0,180,216,0.25)"}}>
                <span style={{fontSize:11,color:"#4a9ebb"}}>ultimo:</span>
                <span style={{fontSize:13,fontWeight:800,color:"#00b4d8"}}>{maxW}kg</span>
                <span style={{fontSize:11,color:"#2a5a7a"}}>{repsArr} reps</span>
              </div>;
            })()}
          </div>
          {(()=>{
            const _a=analisarExercicio(ex,logs,exIdx);
            // Usa o MESMO lastLog que preenche os campos "ant:" (mesmo exerciseId)
            const _lastWeight=Math.max(
              ...(lastLog?.sets||[]).filter(s=>!s.isWarmup).map(s=>parseFloat(s.weight)||0),0);
            const _curWeight=Math.max(...(cur.sets||[]).filter(s=>!s.isWarmup&&s.done).map(s=>parseFloat(s.weight)||0),0);
            // Evoluiu: carga atual (séries feitas) maior que carga anterior
            if(_curWeight>0&&_lastWeight>0&&_curWeight>_lastWeight){
              return <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:4,
                padding:"3px 10px",borderRadius:20,
                background:"rgba(0,200,100,0.12)",border:"1px solid #00c86444"}}>
                <span style={{fontSize:12}}>🚀</span>
                <span style={{fontSize:12,fontWeight:700,color:"#00c864"}}>
                  {_curWeight}kg &gt; último ({_lastWeight}kg) — boa evolução!
                </span>
              </div>;
            }
            if(_a.status==="sem_dados"||_a.status==="manter"||_a.status==="aquecimento") return null;
            return <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:4,
              padding:"3px 10px",borderRadius:20,
              background:_a.cor+"18",border:"1px solid "+_a.cor+"44"}}>
              <span style={{fontSize:12}}>{_a.emoji}</span>
              <span style={{fontSize:12,fontWeight:700,color:_a.cor}}>{_a.sugestao}</span>
            </div>;
          })()}
        </div>
        {/* Seletor de grupo muscular — aparece ao clicar no dot */}
        {showMgPicker&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10,
          padding:"10px 12px",background:"#060d18",borderRadius:12,border:"1px solid #0e2035"}}>
          <div style={{width:"100%",fontSize:10,color:"#4a7a9b",marginBottom:4}}>
            Qual músculo este exercício trabalha?
          </div>
          <button onClick={()=>{setMuscleGroup("");setShowMgPicker(false);}}
            style={{padding:"4px 10px",borderRadius:20,border:"1px solid #0e2035",
              background:"transparent",color:"#4a7a9b",fontSize:11,cursor:"pointer"}}>
            — nenhum
          </button>
          {MUSCLE_GROUPS.map(m=>{
            const sel=(cur.muscleGroup||detectMuscle(ex.name||""))===m.id;
            return <button key={m.id} onClick={()=>{setMuscleGroup(m.id);setShowMgPicker(false);}}
              style={{padding:"4px 10px",borderRadius:20,fontSize:11,cursor:"pointer",
                border:"1px solid "+(sel?m.color:"#0e2035"),
                background:sel?m.color+"33":"transparent",
                color:sel?m.color:"#4a7a9b",fontWeight:sel?700:400}}>
              {m.label}
            </button>;
          })}
        </div>}

        {cur.sets.map((s,si)=>{
          const isActive=si===setIdx&&!s.done;
          // Calcula índice correto no log anterior (pula warmups)
          const _workIdx=cur.sets.slice(0,si).filter(x=>!x.isWarmup).length;
          const prev=s.isWarmup?null:(lastLog?.sets?.filter(x=>!x.isWarmup)||[])[_workIdx];
          const isWarmupSet=!!s.isWarmup;
          const isSec=!!s.isSeconds;
          const accentColor=isWarmupSet?"#eab308":"#00e5ff";
          const borderColor=s.done?(isWarmupSet?"#eab30844":"#0d3a2a"):isActive?(isWarmupSet?"rgba(234,179,8,0.5)":"rgba(0,229,255,0.3)"):(isWarmupSet?"#eab30822":"#0e2035");
          return <div key={si} style={{
            background:s.done?(isWarmupSet?"rgba(234,179,8,0.05)":"rgba(0,200,100,0.06)"):isActive?(isWarmupSet?"rgba(234,179,8,0.04)":"rgba(0,229,255,0.04)"):"#0a1628",
            border:"1px solid "+borderColor,
            borderRadius:14,padding:"11px 14px",marginBottom:7,opacity:!isActive&&!s.done?0.5:1}}>
            {isWarmupSet&&<div style={{fontSize:9,color:"#eab308",letterSpacing:1,marginBottom:4}}>🔥 AQUECIMENTO</div>}
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {/* Número da série */}
              <div style={{width:28,height:28,borderRadius:8,flexShrink:0,
                background:s.done?(isWarmupSet?"rgba(234,179,8,0.2)":"rgba(0,200,100,0.15)"):isActive?(isWarmupSet?"rgba(234,179,8,0.15)":"rgba(0,229,255,0.15)"):"#0e2035",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,
                color:s.done?(isWarmupSet?"#eab308":"#00c864"):isActive?accentColor:"#4a7a9b"}}>
                {s.done?"✓":isWarmupSet?"🔥":(si-cur.sets.slice(0,si).filter(x=>x.isWarmup).length+1)}
              </div>

              {/* Campos */}
              <div style={{display:"flex",gap:8,flex:1}}>
                {/* Carga — só se não for puramente de segundos */}
                {!isSec&&<div style={{flex:1}}>
                  <div style={{fontSize:10,color:isWarmupSet?"#eab308":"#4a7a9b",marginBottom:3}}>CARGA (kg)</div>
                  <input type="number" inputMode="decimal" value={s.weight||""}
                    onChange={e=>{setSetIdx(si);updateField("weight",e.target.value);}}
                    onFocus={e=>{setSetIdx(si);}}
                    onBlur={e=>{if(e.target.value===""||e.target.value==="0")updateField("weight","");}}
                    style={{width:"100%",background:"#060d18",borderRadius:8,padding:"9px 6px",
                      border:"1px solid "+(isWarmupSet?"#eab30866":"#1e3a4a"),
                      color:isWarmupSet?"#eab308":"#fff",fontSize:20,fontWeight:700,textAlign:"center",outline:"none"}}/>
                  {!isWarmupSet&&prev&&(prev.weight||prev.weight===0)&&<div style={{fontSize:10,color:"#4a9ebb",textAlign:"center",marginTop:2}}>ant: {prev.weight||"—"}kg</div>}
                </div>}

                {/* Reps ou Segundos */}
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:isWarmupSet?"#eab308":"#4a7a9b",marginBottom:3}}>
                    {isSec?"DURAÇÃO":"REPS"}
                  </div>
                  {isSec?
                    <div style={{width:"100%",background:"#060d18",border:"1px solid #eab30866",
                      borderRadius:8,padding:"9px 6px",color:"#eab308",fontSize:20,fontWeight:700,textAlign:"center"}}>
                      {s.repsMax||s.targetReps||"?"}s
                    </div>:
                    <input type="number" inputMode="numeric" value={s.reps||""}
                      onChange={e=>{setSetIdx(si);updateField("reps",e.target.value);}}
                      onFocus={e=>{setSetIdx(si);}}
                      onBlur={e=>{if(e.target.value===""||e.target.value==="0")updateField("reps","");}}
                      style={{width:"100%",background:"#060d18",borderRadius:8,padding:"9px 6px",
                        border:"1px solid "+(isWarmupSet?"#eab30866":"#1e3a4a"),
                        color:isWarmupSet?"#eab308":"#fff",fontSize:20,fontWeight:700,textAlign:"center",outline:"none"}}/>
                  }
                  {/* Referências */}
                  {!isWarmupSet&&!isSec&&prev?.reps&&<div style={{fontSize:10,color:"#2a5a7a",textAlign:"center",marginTop:2}}>ant: {prev.reps}</div>}
                  {!isWarmupSet&&!isSec&&(s.repsMin||s.repsMax)&&<div style={{fontSize:9,color:"#2a5a7a",textAlign:"center",marginTop:1}}>alvo: {s.repsMin}-{s.repsMax}</div>}
                </div>
              </div>

              {/* Botão confirmar — só séries ativas */}
              {isActive&&<button onClick={completeSet}
                style={{flexShrink:0,width:48,height:48,borderRadius:12,border:"none",
                  background:isWarmupSet?"linear-gradient(135deg,#eab308,#f59e0b)":"linear-gradient(135deg,#00b4d8,#00e5ff)",
                  color:"#000",fontSize:22,cursor:"pointer",fontWeight:700}}>✓</button>}
            </div>
          </div>;
        })}
        {suggestCarga&&!resting&&<div style={{background:suggestCarga.reduzir?"rgba(249,115,22,0.1)":"rgba(0,200,100,0.1)",border:`1px solid ${suggestCarga.reduzir?"#f9731644":"#00c86444"}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
          <div style={{fontSize:13,fontWeight:700,color:suggestCarga.reduzir?"#f97316":"#00c864",marginBottom:4}}>{suggestCarga.reduzir?"⚠️":"🚀"} Sugestão para próxima série</div>
          <div style={{fontSize:13,color:"#aaa",marginBottom:8}}>{suggestCarga.motivo}</div>
          <button onClick={()=>{
            // Apply only to the specific next set
            const targetIdx=suggestCarga.nextSetIdx||setIdx+1;
            setEntries(prev=>prev.map((e,ei)=>ei!==exIdx?e:{...e,
              sets:e.sets.map((s,si)=>si===targetIdx?{...s,weight:suggestCarga.nova.toString()}:s)
            }));
            setSuggestCarga(null);
          }} style={{padding:"8px 16px",borderRadius:10,border:"none",background:suggestCarga.reduzir?"#f97316":"#00c864",color:"#000",fontWeight:700,cursor:"pointer",fontSize:13}}>
            Aplicar {suggestCarga.nova}kg na série {(suggestCarga.nextSetIdx||setIdx+1)+1}
          </button>
        </div>}
        {resting&&<div>
          {/* Insight do exercicio durante o descanso */}
          {(()=>{
            const a=analisarExercicio(ex,logs,exIdx);
            const mg=cur.muscleGroup||detectMuscle(ex.name||"");
            // Se foi selecionado manualmente, não mostrar sinergistas automáticos
            const manualMg=!!(cur.muscleGroup);
            const sins=manualMg?[]:(SINERGISTAS[mg]||[]).map(s=>MUSCULOS_LABEL[s]).filter(Boolean);
            return <div style={{marginBottom:8}}>
              {/* Badge de status / sugestao */}
              {a.status!=="sem_dados"&&<div style={{
                background:a.cor+"18",border:"1px solid "+a.cor+"44",
                borderRadius:12,padding:"10px 14px",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontSize:18}}>{a.emoji}</span>
                  <span style={{fontSize:13,fontWeight:700,color:a.cor}}>{a.sugestao}</span>
                </div>
                {a.detalhe&&<div style={{fontSize:11,color:"#4a7a9b",lineHeight:1.5}}>{a.detalhe}</div>}
                {a.fadigaIntra&&<div style={{fontSize:11,color:"#f97316",marginTop:4}}>
                  Queda de {a.fadigaIntra.queda}% entre series — aumente o descanso antes de subir carga
                </div>}
              </div>}
              {/* Sinergistas ativados neste exercicio */}
              {sins.length>0&&<div style={{display:"flex",alignItems:"center",gap:5,
                padding:"6px 12px",background:"rgba(255,255,255,0.03)",borderRadius:10,
                border:"1px solid #0e2035",marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:"#2a5a7a"}}>ativando:</span>
                <span style={{fontSize:11,color:mg?MUSCLE_GROUPS.find(m=>m.id===mg)?.color||"#00b4d8":"#00b4d8",fontWeight:700}}>
                  {MUSCULOS_LABEL[mg]||mg}
                </span>
                <span style={{fontSize:10,color:"#2a5a7a"}}>+</span>
                {sins.map(s=>(
                  <span key={s} style={{fontSize:10,padding:"1px 7px",borderRadius:20,
                    background:"rgba(255,255,255,0.05)",color:"#4a7a9b",border:"1px solid #1a2a3a"}}>
                    {s} ~40%
                  </span>
                ))}
              </div>}
            </div>;
          })()}
          <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:18,marginBottom:12}}>
            <RestTimer seconds={ex.restSeconds} onDone={afterRest} onSkip={afterRest}/>
          </div>
        </div>}
      </div>}
      <button onClick={()=>{
  const done=entries.reduce((a,e)=>a+e.sets.filter(s=>s.done).length,0);
  const tot=entries.reduce((a,e)=>a+e.sets.length,0);
  if(done<tot&&!confirm(`Finalizar com ${done}/${tot} séries concluídas?\nO treino ficará registrado assim.`))return;
  setShowFinish(true);
}} style={{width:"100%",marginTop:8,padding:"14px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontSize:15,fontWeight:800,cursor:"pointer"}}>🏁 Finalizar Treino</button>
    </div>
  </div>;
}

// ── TEXT IMPORT ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════
// SEÇÃO 7: PARSER DE TREINO (texto → exercícios)
// Formatos aceitos:
//   "Supino 3x10 90s"          → 3 séries, 10 reps, 90s descanso
//   "Supino 3x8-12 90s"        → faixa 8-12 reps
//   "Agachamento 4x45s 120s"   → duração em segundos
//   "Supino (aquecimento) 2x12" → série de aquecimento
// ═══════════════════════════════════════════════════
function parseText(text){
  // Formatos suportados:
  // "Supino 3x10 90s"               -> 3 séries, 10 reps, 90s descanso
  // "Supino 3x8-12 90s"             -> 3 séries, min 8, max 12 reps  
  // "Prancha 3x45s 90s"             -> 3 séries de 45 SEGUNDOS, 90s descanso
  // "Supino 2x10 45s (aquecimento)" -> séries de aquecimento
  // "Treino A:", "--- B ---"         -> cabeçalhos ignorados
  const parsed = text.split("\n")
    .map(l=>l.trim().replace(/^[-•*]\s*/,""))
    .filter(Boolean)
    .map(line=>{
      if(/^(treino\s*[a-z]|---|-{3,}|[a-z]{3,}:|#+\s)/i.test(line)&&!/\dx/i.test(line)) return null;
      const isAq=/\(aquecimento\)/i.test(line);
      // Mantém (aquecimento) no nome — é assim que o exercício é identificado
      const cleanLine=line.trim();
      // Detecta séries em segundos: 3x45s  
      const mSec=cleanLine.match(/^(.+?)\s+(\d+)\s*[xX×]\s*(\d+)s(?:\s+(\d+)s?)?/i);
      if(mSec){
        const name=mSec[1].trim();
        return{id:uid(),name,sets:+mSec[2],
          targetRepsMin:+mSec[3],targetReps:+mSec[3],
          isSeconds:true,
          restSeconds:mSec[4]?+mSec[4]:90,
          isAquecimento:isAq,
          muscleGroup:detectMuscle(name)};
      }
      // Reps normais
      const m=cleanLine.match(/^(.+?)\s+(\d+)\s*[xX×]\s*(\d+)(?:[-–](\d+))?(?:\s+(\d+)\s*s?)?/i);
      if(!m) return null;
      const name=m[1].trim();
      if(!name||+m[2]<=0||+m[3]<=0) return null;
      return{
        id:uid(),name,sets:+m[2],
        targetRepsMin:+m[3],
        targetReps:m[4]?+m[4]:+m[3],
        isSeconds:false,
        restSeconds:m[5]?+m[5]:90,
        isAquecimento:isAq,
        muscleGroup:detectMuscle(name)
      };
    }).filter(Boolean);

  // Agrupa aquecimentos com o exercício de mesmo nome
  // Ex: "Supino (aquecimento)" + "Supino" -> um exercício com warmupSets separados
  const result=[];
  parsed.forEach(ex=>{
    if(ex.isAquecimento){
      // Procura exercício de mesmo nome já na lista
      const base=result.find(r=>!r.isAquecimento&&
        r.name.toLowerCase()===ex.name.toLowerCase());
      if(base){
        // Adiciona como warmupSets ao exercício principal
        base.warmupSets=[...(base.warmupSets||[]),
          ...Array.from({length:ex.sets},()=>({
            repsMin:ex.targetRepsMin,repsMax:ex.targetReps,
            isSeconds:ex.isSeconds,restSeconds:ex.restSeconds
          }))];
        return;
      }
      // Exercício de aquecimento isolado (sem par) — guarda pra juntar depois
      result.push({...ex,_pendingWarmup:true});
    } else {
      // Verifica se tem aquecimento pendente com o mesmo nome
      const exBaseName=ex.name.replace(/\s*\(aquecimento\)/gi,"").trim().toLowerCase();
      const pendIdx=result.findIndex(r=>r._pendingWarmup&&
        r.name.replace(/\s*\(aquecimento\)/gi,"").trim().toLowerCase()===exBaseName);
      if(pendIdx>=0){
        const pend=result.splice(pendIdx,1)[0];
        result.push({...ex,
          warmupSets:[...(pend.warmupSets||[]),
            ...Array.from({length:pend.sets},()=>({
              repsMin:pend.targetRepsMin,repsMax:pend.targetReps,
              isSeconds:pend.isSeconds,restSeconds:pend.restSeconds
            }))
          ]
        });
      } else {
        result.push(ex);
      }
    }
  });
  // Remove pendentes isolados que não tiveram par (aquecimento sem exercício principal)
  // Aquecimentos sem par ficam como exercícios normais (não removidos)
  return result.map(r=>{
    const {_pendingWarmup,...clean}=r;
    return clean; // isAquecimento preserved in clean for entries build
  });
}
// TextImport: modal onde o usuário cola um texto de treino (ex: colado do WhatsApp/Notion)
// e vê uma prévia (preview) dos exercícios que o parseText() vai extrair antes de confirmar.
function TextImport({onImport,onClose}){
  const [text,setText]=useState("");
  const preview=text.trim()?parseText(text):[]; // recalcula a prévia a cada tecla digitada
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:50,display:"flex",alignItems:"flex-end"}}>
    <div style={{background:"#0a1628",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:960,margin:"0 auto",padding:20,maxHeight:"85vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div><div style={{fontSize:16,fontWeight:700}}>Colar lista em texto</div><div style={{fontSize:12,color:"#4a7a9b"}}>ex: Supino 3x10 60s</div></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:24,cursor:"pointer"}}>×</button>
      </div>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={6} placeholder={"Supino Reto 4x10 90s\nSupino Inclinado 3x12 90s\nCrossover 3x15 60s"}
        style={{width:"100%",background:"#060d18",border:`1px solid ${preview.length>0?"#00b4d8":"#0e2035"}`,borderRadius:12,padding:"12px 14px",color:"#fff",fontSize:14,outline:"none",resize:"none",fontFamily:"monospace",lineHeight:1.8}}/>
      {preview.length>0&&<>{<div style={{fontSize:11,color:"#00b4d8",margin:"10px 0 8px"}}>✓ {preview.length} exercício(s)</div>}
        {preview.map((ex,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 12px",background:"rgba(0,180,216,0.06)",borderRadius:10,marginBottom:5,border:"1px solid rgba(0,180,216,0.15)"}}>
          <span style={{fontSize:13,fontWeight:600}}>{ex.name}</span>
          <span style={{fontSize:12,color:"#00e5ff",fontWeight:700}}>{ex.sets}×{ex.targetRepsMin&&ex.targetRepsMin!==ex.targetReps?`${ex.targetRepsMin}-${ex.targetReps}`:ex.targetReps} · {ex.restSeconds}s</span>
        </div>)}</>}
      <div style={{display:"flex",gap:10,marginTop:14}}>
        <button onClick={onClose} style={{flex:1,padding:13,borderRadius:12,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>Cancelar</button>
        <button onClick={()=>preview.length>0&&onImport(preview)} style={{flex:2,padding:13,borderRadius:12,border:"none",background:preview.length>0?"linear-gradient(135deg,#00b4d8,#00e5ff)":"#0e2035",color:preview.length>0?"#000":"#2a5a7a",fontSize:15,fontWeight:800,cursor:"pointer"}}>Importar {preview.length>0?`${preview.length} ex.`:""}</button>
      </div>
    </div>
  </div>;
}

// ── PLAN EDITOR ───────────────────────────────────────────────────────────────
// PlanEditor: tela de criar/editar um plano de treino (lista de exercícios).
// plan=null -> criando um treino novo; plan preenchido -> editando um existente.
// data = cópia local do plano sendo editado; só vira "real" quando onSave(data) é chamado.
function PlanEditor({plan,onSave,onCancel}){
  const [data,setData]=useState(plan??{id:uid(),dayIndex:1,trainingDays:[],name:"",exercises:[]});
  const [showImport,setShowImport]=useState(false); // controla o modal de "colar lista em texto"
  const updEx=(id,f,v)=>setData(d=>({...d,exercises:d.exercises.map(e=>e.id===id?{...e,[f]:v}:e)})); // atualiza 1 campo de 1 exercício
  const delEx=id=>setData(d=>({...d,exercises:d.exercises.filter(e=>e.id!==id)})); // remove exercício da lista
  const addEx=()=>setData(d=>({...d,exercises:[...d.exercises,{id:uid(),name:"",sets:3,targetRepsMin:8,targetReps:12,restSeconds:90,muscleGroup:null}]})); // adiciona exercício em branco
  const toggleDay=i=>setData(d=>({...d,trainingDays:d.trainingDays?.includes(i)?d.trainingDays.filter(x=>x!==i):[...(d.trainingDays||[]),i]})); // liga/desliga um dia da semana (i = índice 0-6, ver DAYS)
  const valid=data.name&&data.exercises.length>0; // botão "Salvar" só habilita com nome + pelo menos 1 exercício
  return <div style={{paddingBottom:80}}>
    {showImport&&<TextImport onImport={exs=>{setData(d=>({...d,exercises:[...d.exercises,...exs]}));setShowImport(false);}} onClose={()=>setShowImport(false)}/>}
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
      <button onClick={onCancel} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
      <div style={{fontSize:16,fontWeight:700}}>{plan?"Editar Treino":"Novo Treino"}</div>
    </div>
    <input value={data.name} onChange={e=>setData(d=>({...d,name:e.target.value}))} placeholder="Nome (ex: Peito + Tríceps)"
      style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,padding:"12px 14px",color:"#fff",fontSize:15,fontWeight:600,outline:"none",marginBottom:12}}/>
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#4a7a9b",letterSpacing:1,marginBottom:8}}>DIAS DA SEMANA</div>
      <div style={{display:"flex",gap:6}}>
        {DAYS.map((d,i)=>{const sel=(data.trainingDays||[]).includes(i);return <button key={i} onClick={()=>toggleDay(i)}
          style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${sel?"#00e5ff":"#0e2035"}`,background:sel?"rgba(0,229,255,0.1)":"transparent",
            color:sel?"#00e5ff":"#4a7a9b",fontSize:11,fontWeight:sel?700:400,cursor:"pointer"}}>{d}</button>;})}
      </div>
    </div>
    <button onClick={()=>setShowImport(true)} style={{width:"100%",padding:12,borderRadius:12,border:"1px solid #00b4d8",background:"rgba(0,180,216,0.07)",color:"#00b4d8",fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
      📋 Colar lista em texto
    </button>
    {data.exercises.map(ex=>{
      const mg=ex.muscleGroup||detectMuscle(ex.name);const mi=MUSCLE_GROUPS.find(m=>m.id===mg);
      return <div key={ex.id} style={{background:"#0a1628",border:`1px solid ${mi?mi.color+"55":"#0e2035"}`,borderRadius:14,padding:14,marginBottom:10}}>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={ex.name} onChange={e=>{const n=e.target.value;updEx(ex.id,"name",n);if(!ex.muscleGroup){const a=detectMuscle(n);if(a)updEx(ex.id,"muscleGroup",a);}}}
            placeholder="Exercício" style={{flex:1,background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,fontWeight:600,outline:"none"}}/>
          {ex.warmupSets?.length>0&&<span style={{fontSize:10,color:"#eab308",background:"rgba(234,179,8,0.1)",padding:"2px 7px",borderRadius:20,border:"1px solid #eab30833",whiteSpace:"nowrap"}}>
            🔥 {ex.warmupSets.length}aq
          </span>}
          <button onClick={()=>delEx(ex.id)} style={{background:"none",border:"1px solid #3a1a1a",borderRadius:8,color:"#ff4e6a",padding:"0 12px",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>
          {MUSCLE_GROUPS.map(m=>{const sel=(ex.muscleGroup||detectMuscle(ex.name))===m.id;return <button key={m.id} onClick={()=>updEx(ex.id,"muscleGroup",m.id)}
            style={{padding:"3px 9px",borderRadius:20,border:`1px solid ${sel?m.color:"#0e2035"}`,background:sel?m.color+"22":"transparent",color:sel?m.color:"#2a5a7a",fontSize:11,cursor:"pointer",fontWeight:sel?700:400}}>{m.label}</button>;})}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <div style={{flex:"1 1 60px"}}>
            <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>SÉRIES</div>
            <input type="number" inputMode="numeric" value={ex.sets} onChange={e=>updEx(ex.id,"sets",e.target.value===""?"":Math.max(1,+e.target.value))} onBlur={e=>{if(e.target.value===""||+e.target.value<1)updEx(ex.id,"sets",1);}}
              style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:8,padding:"10px 4px",color:"#fff",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
          </div>
          <div style={{flex:"2 1 100px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <div style={{fontSize:10,color:"#4a7a9b"}}>{ex.isSeconds?"DURAÇÃO (s)":"REPS (faixa)"}</div>
              <button onClick={()=>updEx(ex.id,"isSeconds",!ex.isSeconds)}
                style={{fontSize:9,padding:"1px 6px",borderRadius:10,border:"1px solid "+(ex.isSeconds?"#eab308":"#0e2035"),
                  background:ex.isSeconds?"rgba(234,179,8,0.1)":"transparent",
                  color:ex.isSeconds?"#eab308":"#4a7a9b",cursor:"pointer"}}>
                {ex.isSeconds?"⏱ seg":"# reps"}
              </button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>{
              ex.isSeconds?
              <input type="number" inputMode="numeric" value={ex.targetReps||30}
                onChange={e=>updEx(ex.id,"targetReps",e.target.value===""?"":+e.target.value)}
                onBlur={e=>{if(e.target.value===""||+e.target.value<1)updEx(ex.id,"targetReps",30);}}
                style={{width:"100%",background:"#060d18",border:"1px solid #eab30866",borderRadius:8,padding:"10px 2px",color:"#eab308",fontSize:15,fontWeight:700,textAlign:"center",outline:"none"}}/>
              :<>
                <input type="number" inputMode="numeric" value={ex.targetRepsMin||ex.targetReps||8}
                  onChange={e=>updEx(ex.id,"targetRepsMin",e.target.value===""?"":+e.target.value)}
                  onBlur={e=>{if(e.target.value===""||+e.target.value<1)updEx(ex.id,"targetRepsMin",1);}}
                  style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:8,padding:"10px 2px",color:"#fff",fontSize:15,fontWeight:700,textAlign:"center",outline:"none"}}/>
                <span style={{color:"#4a7a9b",fontSize:13,flexShrink:0}}>–</span>
                <input type="number" inputMode="numeric" value={ex.targetReps||12}
                  onChange={e=>updEx(ex.id,"targetReps",e.target.value===""?"":+e.target.value)}
                  onBlur={e=>{if(e.target.value===""||+e.target.value<1)updEx(ex.id,"targetReps",1);}}
                  style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:8,padding:"10px 2px",color:"#fff",fontSize:15,fontWeight:700,textAlign:"center",outline:"none"}}/>
              </>
            }</div>
          </div>
          <div style={{flex:"1 1 70px"}}>
            <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>DESCANSO(s)</div>
            <input type="number" inputMode="numeric" value={ex.restSeconds||90} onChange={e=>updEx(ex.id,"restSeconds",e.target.value===""?"":+e.target.value)} onBlur={e=>{if(e.target.value==="")updEx(ex.id,"restSeconds",90);}}
              style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:8,padding:"10px 4px",color:"#fff",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
          </div>
        </div>
      </div>;
    })}
    <button onClick={addEx} style={{width:"100%",padding:12,borderRadius:12,border:"1px dashed #0e2035",background:"transparent",color:"#4a7a9b",fontSize:14,cursor:"pointer",marginBottom:12}}>+ Exercício manual</button>
    <div style={{display:"flex",gap:10}}>
      <button onClick={onCancel} style={{flex:1,padding:13,borderRadius:12,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>Cancelar</button>
      <button onClick={()=>valid&&onSave(data)} style={{flex:2,padding:13,borderRadius:12,border:"none",background:valid?"linear-gradient(135deg,#00b4d8,#00e5ff)":"#0e2035",color:valid?"#000":"#2a5a7a",fontSize:15,fontWeight:800,cursor:valid?"pointer":"default"}}>Salvar</button>
    </div>
  </div>;
}

// ── PROGRESS VIEW ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════
// SEÇÃO 8: ABA PROGRESSO (📈)
// Sub-abas: Score geral, Evolução de cargas, Avaliações físicas
// - Score: gráfico de linha com pontuação do treino
// - Cargas: evolução de peso máximo e 1RM estimado
// - Avaliações: gráficos de medidas corporais por aluno
// ═══════════════════════════════════════════════════
