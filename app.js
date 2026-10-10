function App(){
  // ── ESTADO GLOBAL ──
  // Cada useState abaixo carrega primeiro do localStorage (ll = "local load", ver topo do
  // arquivo) pra abrir instantâneo mesmo offline; depois o useEffect logo abaixo busca a
  // versão mais atual no Google Sheets e sobrescreve se vier algo válido.
  const [plans,setPlans]=useState(()=>ll("fl_plans",SEED_PLANS));       // planos de treino
  const [sessions,setSessions]=useState(()=>ll("fl_sessions",[]));      // treinos já finalizados
  const [logs,setLogs]=useState(()=>ll("fl_logs",[]));                  // séries feitas por exercício (usado pra progressão)
  const [students,setStudents]=useState(()=>ll("fl_students",[]));      // alunos (personal trainer)
  const [meuPix,setMeuPix]=useState(()=>ll("fl_pix",""));
  const [habitos,setHabitos]=useState(()=>ll("fl_habitos",[]));
  const [tarefas,setTarefas]=useState(()=>ll("fl_tarefas",[]));
  const [metas,setMetas]=useState(()=>ll("fl_metas",[]));
  const [tab,setTab]=useState("home");                                  // aba ativa (bottom nav)
  const [editPlan,setEditPlan]=useState(null);                          // plano sendo editado (ou "new")
  const [activeWorkout,setActiveWorkout]=useState(null);                // treino em execução agora
  const [preTreino,setPreTreino]=useState(null);                        // plano escolhido, aguardando tela de análise pré-treino
  const [resumeData,setResumeData]=useState(()=>{
    // Se havia um treino em andamento salvo (fl_workout_inprogress), oferece "Continuar treino"
    const d=ll("fl_workout_inprogress",null);
    return d&&d.planId?d:null;
  });
  const [progressPlan,setProgressPlan]=useState(null); // plano cujo progresso está sendo visto (ícone 📈)
  const [syncStatus,setSyncStatus]=useState("idle");    // idle | syncing | ok | err — indicador visual de sincronização

  // Ao montar o App, busca os dados atuais no Google Sheets (fonte de verdade).
  useEffect(()=>{
    setSyncStatus("syncing");
    gsLoad().then(data=>{
      if(data){
        // Regra: só sobrescreve se Sheets trouxe dados reais
        // Se Sheets retornar vazio/undefined, mantém o cache local para não apagar dados
        const merge=(sheetsVal, localKey, fallback)=>{
          if(sheetsVal&&(Array.isArray(sheetsVal)?sheetsVal.length>0:true)) return sheetsVal;
          return ll(localKey, fallback);
        };
        const p=merge(data.plans,      "fl_plans",    SEED_PLANS);
        const s=merge(data.sessions,   "fl_sessions", []);
        const l=merge(data.logs,       "fl_logs",     []);
        const st=merge(data.students,  "fl_students", []);
        const h=merge(data.habitos,    "fl_habitos",  []);
        const t=merge(data.tarefas,    "fl_tarefas",  []);
        const m=merge(data.metas,      "fl_metas",    []);
        setPlans(p); setSessions(s); setLogs(l); setStudents(st);
        setHabitos(h); setTarefas(t); setMetas(m);
        if(data.pix!==undefined&&data.pix!==null){setMeuPix(data.pix);ls("fl_pix",data.pix);}
        // Atualiza cache local com o que veio do Sheets
        if(p?.length)ls("fl_plans",p);
        if(s?.length)ls("fl_sessions",s);
        if(l?.length)ls("fl_logs",l);
        if(st?.length)ls("fl_students",st);
        if(h?.length)ls("fl_habitos",h);
        if(t?.length)ls("fl_tarefas",t);
        if(m?.length)ls("fl_metas",m);
        syncPending({plans:p,sessions:s,logs:l,students:st,despesas:ll("fl_despesas",[]),habitos:h,tarefas:t,metas:m});
        setSyncStatus("ok");
      } else {
        setSyncStatus("err");
      }
      setTimeout(()=>setSyncStatus("idle"),3000);
    });
  },[]);

  // syncX: padrão repetido em todo o app — atualiza o estado local (React) IMEDIATAMENTE
  // (pra UI responder na hora) e dispara gsSave() em paralelo pra persistir no Sheets
  // (que por sua vez também atualiza o cache localStorage, ver gsSave no topo do arquivo).
  const syncP=p=>{setPlans(p);gsSave("plans",p);};
  const syncS=s=>{setSessions(s);gsSave("sessions",s);};
  const syncL=l=>{setLogs(l);gsSave("logs",l);};
  const syncSt=s=>{setStudents(s);gsSave("students",s);};
  const savePix=v=>{setMeuPix(v);ls("fl_pix",v);gsSave("pix",v);};
  const syncHabitos=h=>{setHabitos(h);gsSave("habitos",h);};
  const syncTarefas=t=>{setTarefas(t);gsSave("tarefas",t);};
  const syncMetas=m=>{setMetas(m);gsSave("metas",m);};

  // savePlan: se o plano já existe na lista (mesmo id) substitui; senão adiciona no fim.
  const savePlan=p=>{syncP(plans.findIndex(x=>x.id===p.id)>=0?plans.map(x=>x.id===p.id?p:x):[...plans,p]);setEditPlan(null);};
  const deletePlan=id=>{if(confirm("Apagar treino?"))syncP(plans.filter(x=>x.id!==id));};
  // finishWorkout: recebe o resultado do ActiveWorkout e grava 2 coisas:
  //  1) uma "session" (o treino como um todo: duração, tipo, notas)
  //  2) um "log" por exercício (usado depois pela engine de progressão / gráficos)
  // Só entra no log séries que tiveram peso OU reps preenchidos (ignora séries em branco).
  const finishWorkout=({entries,date,planId,planName,duration,workoutType,notes})=>{
    const sess={id:uid(),date,planId,planName,duration,workoutType,notes,entries};
    syncS([sess,...sessions]);
    syncL([...logs,...entries.map(e=>({id:uid(),date,exerciseId:e.exerciseId,name:e.name,
      // Salva séries de trabalho com flag isWarmup para reference
      sets:e.sets.filter(s=>s.reps||s.weight).map(s=>({...s}))
    }))]);
    setActiveWorkout(null);setTab("history");
  };
  const deleteSession=id=>{if(confirm("Apagar?"))syncS(sessions.filter(s=>s.id!==id));};
  const updateStudent=s=>syncSt(students.map(x=>x.id===s.id?s:x));
  const addStudent=s=>syncSt([...students,s]);
  const deleteStudent=id=>syncSt(students.filter(s=>s.id!==id));

  const todayIdx=new Date().getDay();
  // planos do dia de hoje — pode ser múltiplos (por trainingDays)
  const todayPlans=plans.filter(p=>(p.trainingDays||[p.dayIndex]).includes(todayIdx));
  // ordena a lista "Seus Treinos" colocando primeiro os planos mais próximos de hoje
  const sortedPlans=[...plans].sort((a,b)=>((a.dayIndex-todayIdx+7)%7)-((b.dayIndex-todayIdx+7)%7));
  // streak: conta dias consecutivos com pelo menos 1 sessão registrada, andando de hoje pra trás
  const streak=(()=>{let s=0,d=new Date();while(true){const ds=d.toISOString().slice(0,10);if(sessions.some(x=>x.date===ds)){s++;d.setDate(d.getDate()-1);}else break;}return s;})();
  // alertas: quantos alunos já completaram o pacote pago este mês (aparece no topo da Home)
  // ✅ CORRIGIDO (s.pacote): trocado por s.pacotePago — essa era a 4ª e última ocorrência.
  const alertas=students.filter(s=>{const m=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`;const d=(s.aulas||[]).filter(a=>a.data.startsWith(m)&&a.presente).length;return d>=(s.pacotePago||8);}).length;
  const lastSess=sessions.length>0?[...sessions].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
  const daysSince=lastSess?Math.round((new Date()-new Date(lastSess.date+"T12:00"))/86400000):null;

  // ── "ROTEAMENTO" MANUAL ──
  // O app não usa React Router: cada `if(x) return <Componente/>` abaixo funciona como uma
  // "tela cheia" que substitui a Home enquanto a condição for verdadeira. A ordem importa:
  // a primeira condição verdadeira "vence" e as de baixo nem chegam a ser avaliadas.
  if(preTreino){setActiveWorkout(preTreino);setPreTreino(null);}
  if(activeWorkout)return <ActiveWorkout plan={activeWorkout} logs={logs} onFinish={finishWorkout} onCancel={()=>setActiveWorkout(null)}/>;
  if(editPlan!==null)return <div style={{minHeight:"100vh",background:"#060d18",maxWidth:960,margin:"0 auto",padding:"20px 18px"}}><PlanEditor plan={editPlan==="new"?null:editPlan} onSave={savePlan} onCancel={()=>setEditPlan(null)}/></div>;
  if(progressPlan)return <div style={{minHeight:"100vh",background:"#060d18",maxWidth:960,margin:"0 auto"}}>
    <div style={{background:"#0a1628",padding:"16px 18px",borderBottom:"1px solid #0e2035",display:"flex",alignItems:"center",gap:12}}>
      <button onClick={()=>setProgressPlan(null)} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer"}}>←</button>
      <div style={{fontSize:16,fontWeight:700}}>{progressPlan.name}</div>
    </div>
    <div style={{padding:"20px 18px"}}><ProgressView plan={progressPlan} logs={logs} sessions={sessions} plans={plans} students={students}/></div>
  </div>;

  return <div style={{minHeight:"100vh",background:"#060d18",maxWidth:960,margin:"0 auto",paddingBottom:80}}>
    <div style={{background:"#0a1628",padding:"16px 18px 0",borderBottom:"1px solid #0e2035",position:"sticky",top:0,zIndex:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:-1,background:"linear-gradient(90deg,#00b4d8,#00e5ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>FitLog Pro</div>
          <div style={{fontSize:11,color:"#2a6a8a",display:"flex",alignItems:"center",gap:6}}>
            {streak>0?`🔥 ${streak} dia${streak>1?"s":""} seguido${streak>1?"s":""}` :"Bora!"}
            {daysSince>=5&&<span style={{color:"#ef4444",fontSize:10}}>⚠ {daysSince}d sem treinar</span>}
            {syncStatus==="syncing"&&<span style={{fontSize:10,color:"#f59e0b"}}>⟳</span>}
            {syncStatus==="ok"&&<span style={{fontSize:10,color:"#00c864"}}>✓ nuvem</span>}
            {syncStatus==="err"&&<span style={{fontSize:10,color:"#f87171"}}>⚠ offline</span>}
          </div>
        </div>
        {tab==="home"&&<button onClick={()=>setEditPlan("new")} style={{padding:"8px 14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14}}>+ Treino</button>}
      </div>
      <div style={{display:"flex",overflowX:"auto",scrollbarWidth:"none"}}>
        {[["home","🏠"],["agenda","📅"],["alunos","👥"],["avaliacao","📏"],["meudia","⚡"],["history","📋"],["progress","📈"],["volume","📊"]].map(([id,icon])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:"0 0 auto",padding:"8px 12px",border:"none",background:"transparent",color:tab===id?"#00e5ff":"#2a5a7a",fontSize:18,cursor:"pointer",borderBottom:`2px solid ${tab===id?"#00e5ff":"transparent"}`,position:"relative"}}>
            {icon}
            {id==="alunos"&&alertas>0&&<span style={{position:"absolute",top:4,right:6,width:7,height:7,borderRadius:"50%",background:"#00c864"}}/>}
          </button>
        ))}
      </div>
    </div>

    <div style={{padding:"18px 18px"}}>
      {tab==="home"&&<>
        {resumeData&&<div style={{background:"rgba(234,179,8,0.09)",border:"1px solid #eab30844",borderRadius:16,padding:16,marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:"#eab308",marginBottom:4}}>⚡ Treino em andamento</div>
          <div style={{fontSize:13,color:"#aaa",marginBottom:10}}>Você saiu do treino "{resumeData.planName}" sem finalizar.</div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{ls("fl_workout_inprogress",null);setResumeData(null);}} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #2a3a4a",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:13}}>Descartar</button>
            <button onClick={()=>{
              const p=plans.find(x=>x.id===resumeData.planId);
              if(p){setActiveWorkout({...p,_resume:resumeData});}
              setResumeData(null);
            }} style={{flex:2,padding:"10px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#eab308,#f59e0b)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:13}}>▶ Continuar treino</button>
          </div>
        </div>}
        {daysSince>=5&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid #ef444433",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:24}}>⚠️</span><div><div style={{fontSize:14,fontWeight:700,color:"#ef4444"}}>Alerta de destreino</div><div style={{fontSize:12,color:"#ef4444aa"}}>{daysSince} dias sem treinar. Bora voltar!</div></div>
        </div>}
        {todayPlans.length>0&&todayPlans.map(plan=><div key={plan.id} style={{background:"linear-gradient(135deg,#051a2e,#0a2a42)",border:"1px solid rgba(0,229,255,0.2)",borderRadius:20,padding:18,marginBottom:12}}>
          <div style={{fontSize:11,color:"#00b4d8",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>📅 Hoje — {DAY_FULL[todayIdx]}</div>
          <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>{plan.name}</div>
          <div style={{fontSize:13,color:"#4a7a9b",marginBottom:12}}>{plan.exercises.length} exercícios · {plan.exercises.reduce((a,e)=>a+e.sets,0)} séries</div>
          <button onClick={()=>setPreTreino(plan)} style={{width:"100%",padding:13,borderRadius:14,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontSize:15,fontWeight:800,cursor:"pointer"}}>▶ Iniciar Treino de Hoje</button>
        </div>)}
        <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
          {DAYS.map((d,i)=>{
            const ps=plans.filter(p=>(p.trainingDays||[p.dayIndex]).includes(i));
            const done=sessions.some(s=>{const sd=new Date(s.date+"T12:00");return ps.some(p=>s.planId===p.id)&&(new Date()-sd)/86400000<7&&sd.getDay()===i;});
            const isToday=i===todayIdx;
            return <div key={i} style={{flex:"0 0 auto",textAlign:"center",minWidth:40}}>
              <div style={{fontSize:9,color:isToday?"#00e5ff":"#2a5a7a",marginBottom:4}}>{d}</div>
              <div style={{width:40,height:40,borderRadius:10,background:done?"rgba(0,200,100,0.12)":ps.length>0?"rgba(0,229,255,0.07)":"#0a1628",border:`1px solid ${isToday?"rgba(0,229,255,0.5)":done?"rgba(0,200,100,0.3)":ps.length>0?"rgba(0,229,255,0.15)":"#0e2035"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {done?<span style={{fontSize:16}}>✓</span>:ps.length>0?<span style={{fontSize:14}}>💪</span>:<span style={{fontSize:14,color:"#1a3a4a"}}>—</span>}
              </div>
            </div>;
          })}
        </div>
        <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Seus Treinos</div>
        {sortedPlans.map(plan=>{
          const lastS=sessions.filter(s=>s.planId===plan.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
          const daysAgo=lastS?Math.round((new Date()-new Date(lastS.date+"T12:00"))/86400000):null;
          const trainDays=(plan.trainingDays||[plan.dayIndex]).map(i=>DAYS[i]).join("/");
          const lastType=lastS?WORKOUT_TYPES.find(t=>t.id===lastS.workoutType):null;
          return <div key={plan.id} style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:"13px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,background:"rgba(0,180,216,0.15)",color:"#00b4d8",padding:"2px 8px",borderRadius:20}}>{trainDays}</span>
                  {lastType&&<span style={{fontSize:14}}>{lastType.emoji}</span>}
                  {daysAgo===0&&<span style={{fontSize:10,color:"#00c864"}}>feito hoje ✓</span>}
                  {daysAgo===1&&<span style={{fontSize:10,color:"#4a7a9b"}}>ontem</span>}
                  {daysAgo>1&&<span style={{fontSize:10,color:"#2a5a7a"}}>{daysAgo}d atrás</span>}
                </div>
                <div style={{fontSize:16,fontWeight:700}}>{plan.name}</div>
                <div style={{fontSize:12,color:"#4a7a9b",marginTop:2}}>{plan.exercises.length} exercícios</div>
              </div>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>setProgressPlan(plan)} style={{padding:"6px 8px",borderRadius:8,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:13}}>📈</button>
                <button onClick={()=>setEditPlan(plan)} style={{padding:"6px 8px",borderRadius:8,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:13}}>✏️</button>
                <button onClick={()=>deletePlan(plan.id)} style={{padding:"6px 8px",borderRadius:8,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:13}}>🗑</button>
              </div>
            </div>
            <div style={{display:"flex",gap:5,marginTop:10,overflowX:"auto",paddingBottom:2,scrollbarWidth:"none"}}>
              {plan.exercises.map(ex=>{
                const exLogs=logs.filter(l=>l.exerciseId===ex.id).sort((a,b)=>a.date.localeCompare(b.date));
                const wts=exLogs.map(l=>Math.max(...l.sets.map(s=>parseFloat(s.weight)||0),0));
                const lastW=wts.at(-1),prevW=wts.at(-2);const up=prevW!==undefined&&lastW>prevW;
                return <div key={ex.id} style={{flex:"0 0 auto",background:"#060d18",borderRadius:9,padding:"5px 9px",border:`1px solid ${up?"#0d3a1a":"#0e2035"}`}}>
                  <div style={{fontSize:11,color:up?"#00c864":"#aaa",fontWeight:600,whiteSpace:"nowrap"}}>{up?"▲ ":""}{ex.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginTop:1}}>
                    {lastW?<span style={{fontSize:13,fontWeight:700,color:"#00e5ff"}}>{lastW}kg</span>:<span style={{fontSize:11,color:"#2a5a7a"}}>—</span>}
                    {wts.length>=2&&<Sparkline data={wts.slice(-6)} width={38} height={15} color={up?"#00c864":"#00b4d8"}/>}
                  </div>
                </div>;
              })}
            </div>
            <button onClick={()=>setPreTreino(plan)} style={{width:"100%",marginTop:10,padding:11,borderRadius:12,border:"none",background:(plan.trainingDays||[plan.dayIndex]).includes(todayIdx)?"linear-gradient(135deg,#00b4d8,#00e5ff)":"rgba(0,180,216,0.1)",color:(plan.trainingDays||[plan.dayIndex]).includes(todayIdx)?"#000":"#00b4d8",fontSize:14,fontWeight:700,cursor:"pointer"}}>▶ Iniciar</button>
          </div>;
        })}
        {plans.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#2a5a7a"}}><div style={{fontSize:48,marginBottom:10}}>💪</div><div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Nenhum treino ainda</div><div style={{fontSize:13}}>Toque em "+ Treino"</div></div>}
      </>}
      {tab==="history"&&<HistoryView sessions={sessions} logs={logs} onDelete={deleteSession}/>}
      {tab==="progress"&&<ProgressView plan={plans[0]} logs={logs} sessions={sessions} plans={plans} students={students}/>}
      {tab==="volume"&&<VolumeView plans={plans}/>}
      {tab==="meudia"&&<MeuDiaView habitos={habitos} tarefas={tarefas} metas={metas} onHabitos={syncHabitos} onTarefas={syncTarefas} onMetas={syncMetas}/>}
      {tab==="agenda"&&<AgendaView students={students} onUpdate={updateStudent} gsUrl={GS_URL}/>}
      {tab==="avaliacao"&&<AvaliacaoView students={students} onUpdate={updateStudent}/>}
      {tab==="financeiro"&&<FinanceiroView students={students} onUpdate={updateStudent}/>}
      {tab==="alunos"&&<>
        <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:10,color:"#4a7a9b",letterSpacing:1,marginBottom:6}}>MEU PIX</div>
          <input value={meuPix} onChange={e=>savePix(e.target.value)} placeholder="CPF, telefone, e-mail ou chave aleatória"
            style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,outline:"none"}}/>
        </div>
        <AlunosView students={students} onUpdate={updateStudent} onAdd={addStudent} onDelete={deleteStudent} meuPix={meuPix} sessions={sessions}/>
      </>}
    </div>

    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:960,background:"#0a1628",borderTop:"1px solid #0e2035",display:"flex",padding:"8px 0 12px"}}>
      {[["home","🏠","Plano"],["agenda","📅","Agenda"],["alunos","👥","Alunos"],["meudia","⚡","Meu Dia"],["financeiro","💰","R$"]].map(([id,icon,lbl])=>(
      <button key={id} onClick={()=>setTab(id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",color:tab===id?"#00e5ff":"#2a5a7a",display:"flex",flexDirection:"column",alignItems:"center",gap:1,position:"relative"}}>
          <span style={{fontSize:18}}>{icon}</span>
          <span style={{fontSize:10,fontWeight:tab===id?700:400}}>{lbl}</span>
          {tab===id && <div style={{position:"absolute",top:-8,width:4,height:4,borderRadius:10,background:"#00e5ff"}}/>}
        </button>
      ))}
    </div>
  </div>;
}

// ── RENDERIZAÇÃO FINAL ───────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
