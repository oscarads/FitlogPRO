function MeuDiaView({habitos,tarefas,metas,onHabitos,onTarefas,onMetas}){
  const now=new Date();
  const todayDs=now.toISOString().slice(0,10);
  const mesAtual=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const [subTab,setSubTab]=useState("hoje"); // hoje | habitos | metas
  const [addH,setAddH]=useState(false);
  const [addT,setAddT]=useState(false);
  const [addM,setAddM]=useState(false);
  const [formH,setFormH]=useState({nome:"",emoji:"💧",cor:"#00b4d8"});
  const [formT,setFormT]=useState({texto:"",prioridade:"normal"});
  const [formM,setFormM]=useState({texto:"",total:1,categoria:"negocio"});

  const EMOJIS=["💧","🏋️","📚","🥗","😴","🧘","📱","💼","🎯","✍️","🚶","💊"];
  const CORES=["#00b4d8","#00c864","#f97316","#8b5cf6","#ef4444","#eab308","#ec4899","#14b8a6"];
  const CATS=[{id:"negocio",label:"Negócio",emoji:"💼"},{id:"saude",label:"Saúde",emoji:"❤️"},{id:"aprendizado",label:"Aprendizado",emoji:"📚"},{id:"outro",label:"Outro",emoji:"🎯"}];

  // ── HÁBITOS ──
  // marcarHabito: liga/desliga o check de hoje (checks = array de datas "YYYY-MM-DD" marcadas)
  // e recalcula o streak (dias seguidos) andando pra trás a partir de hoje: se a diferença
  // entre um check e o anterior for <=1 dia, o streak continua; assim que achar um "buraco"
  // maior que 1 dia, para de contar.
  const marcarHabito=(hid)=>{
    const h=habitos.find(x=>x.id===hid);
    if(!h)return;
    const checks=h.checks||[];
    const jaFez=checks.includes(todayDs);
    const newChecks=jaFez?checks.filter(d=>d!==todayDs):[...checks,todayDs];
    // calcular streak
    let streak=0;const sorted=[...newChecks].sort((a,b)=>b.localeCompare(a));
    let cur=new Date();
    for(const ds of sorted){
      const diff=Math.round((cur-new Date(ds+"T12:00"))/86400000);
      if(diff<=1){streak++;cur=new Date(ds+"T12:00");}else break;
    }
    onHabitos(habitos.map(x=>x.id===hid?{...x,checks:newChecks,streak}:x));
  };
  const addHabito=()=>{
    if(!formH.nome)return;
    onHabitos([...habitos,{id:uid(),...formH,checks:[],streak:0}]);
    setFormH({nome:"",emoji:"💧",cor:"#00b4d8"});setAddH(false);
  };
  const delHabito=id=>onHabitos(habitos.filter(h=>h.id!==id));

  // ── TAREFAS ──
  const toggleTarefa=id=>{
    const t=tarefas.find(x=>x.id===id);
    onTarefas(tarefas.map(x=>x.id===id?{...x,feita:!x.feita,feitaEm:!t.feita?todayDs:null}:x));
  };
  const addTarefa=()=>{
    if(!formT.texto)return;
    onTarefas([...tarefas,{id:uid(),...formT,feita:false,data:todayDs}]);
    setFormT({texto:"",prioridade:"normal"});setAddT(false);
  };
  const delTarefa=id=>onTarefas(tarefas.filter(t=>t.id!==id));

  // ── METAS ──
  const incrementMeta=(id,delta)=>{
    onMetas(metas.map(m=>m.id===id?{...m,atual:Math.max(0,Math.min(m.total,(m.atual||0)+delta))}:m));
  };
  const addMeta=()=>{
    if(!formM.texto)return;
    onMetas([...metas,{id:uid(),...formM,atual:0,mes:mesAtual}]);
    setFormM({texto:"",total:1,categoria:"negocio"});setAddM(false);
  };
  const delMeta=id=>onMetas(metas.filter(m=>m.id!==id));

  // tarefas de hoje
  const tarefasHoje=tarefas.filter(t=>t.data===todayDs||(!t.feita&&t.data<todayDs));
  const tarefasFeitasHoje=tarefasHoje.filter(t=>t.feita).length;
  // hábitos
  const habitosHoje=habitos.map(h=>({...h,fezHoje:(h.checks||[]).includes(todayDs)}));
  const habitosFeitosHoje=habitosHoje.filter(h=>h.fezHoje).length;
  // metas do mês
  const metasMes=metas.filter(m=>m.mes===mesAtual||!m.mes);

  const PRIO={urgente:{c:"#ef4444",l:"🔴 Urgente"},normal:{c:"#4a9ebb",l:"🔵 Normal"},baixa:{c:"#2a5a7a",l:"⚪ Baixa"}};

  return <div>
    {/* sub-tabs */}
    <div style={{display:"flex",gap:6,marginBottom:16,background:"#0a1628",borderRadius:12,padding:3,border:"1px solid #0e2035"}}>
      {[["hoje","📋 Hoje"],["habitos","🔥 Hábitos"],["metas","🎯 Metas"]].map(([v,l])=><button key={v} onClick={()=>setSubTab(v)}
        style={{flex:1,padding:"9px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,fontWeight:subTab===v?700:400,
          background:subTab===v?"linear-gradient(135deg,#00b4d8,#00e5ff)":"transparent",
          color:subTab===v?"#000":"#4a7a9b"}}>{l}</button>)}
    </div>

    {/* ── HOJE ── */}
    {subTab==="hoje"&&<div>
      {/* resumo */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:"13px 14px"}}>
          <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>TAREFAS HOJE</div>
          <div style={{fontSize:24,fontWeight:900,color:tarefasFeitasHoje===tarefasHoje.length&&tarefasHoje.length>0?"#00c864":"#fff"}}>
            {tarefasFeitasHoje}/{tarefasHoje.length}
          </div>
          <div style={{fontSize:11,color:"#2a5a7a"}}>{tarefasHoje.length-tarefasFeitasHoje} pendente{tarefasHoje.length-tarefasFeitasHoje!==1?"s":""}</div>
        </div>
        <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:"13px 14px"}}>
          <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>HÁBITOS HOJE</div>
          <div style={{fontSize:24,fontWeight:900,color:habitosFeitosHoje===habitos.length&&habitos.length>0?"#00c864":"#fff"}}>
            {habitosFeitosHoje}/{habitos.length}
          </div>
          <div style={{fontSize:11,color:"#2a5a7a"}}>{habitos.length-habitosFeitosHoje} faltando</div>
        </div>
      </div>

      {/* hábitos rápidos */}
      {habitos.length>0&&<div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:8}}>HÁBITOS DO DIA</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {habitosHoje.map(h=><button key={h.id} onClick={()=>marcarHabito(h.id)}
            style={{display:"flex",alignItems:"center",gap:7,padding:"10px 14px",borderRadius:14,cursor:"pointer",
              border:`2px solid ${h.fezHoje?h.cor:"#0e2035"}`,
              background:h.fezHoje?h.cor+"22":"#0a1628"}}>
            <span style={{fontSize:20}}>{h.emoji}</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:13,fontWeight:600,color:h.fezHoje?h.cor:"#aaa"}}>{h.nome}</div>
              {h.streak>0&&<div style={{fontSize:10,color:"#f97316"}}>🔥 {h.streak} dias</div>}
            </div>
            {h.fezHoje&&<span style={{fontSize:14,color:h.cor,marginLeft:4}}>✓</span>}
          </button>)}
        </div>
      </div>}

      {/* tarefas do dia */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1}}>TAREFAS</div>
        <button onClick={()=>setAddT(!addT)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"rgba(0,180,216,0.1)",color:"#00b4d8",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Adicionar</button>
      </div>
      {addT&&<div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:14,marginBottom:10}}>
        <input value={formT.texto} onChange={e=>setFormT(f=>({...f,texto:e.target.value}))} placeholder="O que fazer hoje?"
          style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,outline:"none",marginBottom:8}}/>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {Object.entries(PRIO).map(([k,v])=><button key={k} onClick={()=>setFormT(f=>({...f,prioridade:k}))}
            style={{flex:1,padding:"6px",borderRadius:8,border:`1px solid ${formT.prioridade===k?v.c:"#0e2035"}`,
              background:formT.prioridade===k?v.c+"22":"transparent",color:formT.prioridade===k?v.c:"#4a7a9b",fontSize:11,cursor:"pointer"}}>{v.l}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddT(false)} style={{flex:1,padding:10,borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>Cancelar</button>
          <button onClick={addTarefa} style={{flex:2,padding:10,borderRadius:10,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontWeight:700,cursor:"pointer"}}>Salvar</button>
        </div>
      </div>}
      {tarefasHoje.length===0&&!addT&&<div style={{textAlign:"center",padding:"20px 0",color:"#2a5a7a",fontSize:13}}>Nenhuma tarefa para hoje 🎉</div>}
      {tarefasHoje.map(t=>{
        const p=PRIO[t.prioridade]||PRIO.normal;
        return <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",marginBottom:7,
          background:t.feita?"rgba(0,200,100,0.05)":"#0a1628",
          border:`1px solid ${t.feita?"#00c86433":p.c+"33"}`,borderRadius:13}}>
          <button onClick={()=>toggleTarefa(t.id)}
            style={{width:28,height:28,borderRadius:8,border:`2px solid ${t.feita?"#00c864":p.c}`,
              background:t.feita?"#00c864":"transparent",cursor:"pointer",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff"}}>
            {t.feita?"✓":""}
          </button>
          <span style={{flex:1,fontSize:14,fontWeight:500,color:t.feita?"#4a7a9b":"#fff",textDecoration:t.feita?"line-through":"none"}}>{t.texto}</span>
          <button onClick={()=>delTarefa(t.id)} style={{background:"none",border:"none",color:"#2a3a4a",cursor:"pointer",fontSize:16}}>×</button>
        </div>;
      })}
    </div>}

    {/* ── HÁBITOS ── */}
    {subTab==="habitos"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1}}>MEUS HÁBITOS</div>
        <button onClick={()=>setAddH(!addH)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"rgba(0,180,216,0.1)",color:"#00b4d8",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Criar</button>
      </div>
      {addH&&<div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:14,marginBottom:12}}>
        <input value={formH.nome} onChange={e=>setFormH(f=>({...f,nome:e.target.value}))} placeholder="Nome do hábito"
          style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,outline:"none",marginBottom:8}}/>
        <div style={{fontSize:10,color:"#4a7a9b",marginBottom:5}}>ÍCONE</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
          {EMOJIS.map(e=><button key={e} onClick={()=>setFormH(f=>({...f,emoji:e}))}
            style={{width:36,height:36,borderRadius:8,border:`2px solid ${formH.emoji===e?"#00e5ff":"#0e2035"}`,
              background:formH.emoji===e?"rgba(0,229,255,0.1)":"transparent",cursor:"pointer",fontSize:18}}>{e}</button>)}
        </div>
        <div style={{fontSize:10,color:"#4a7a9b",marginBottom:5}}>COR</div>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {CORES.map(c=><button key={c} onClick={()=>setFormH(f=>({...f,cor:c}))}
            style={{width:28,height:28,borderRadius:"50%",border:`3px solid ${formH.cor===c?"#fff":"transparent"}`,background:c,cursor:"pointer"}}/>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddH(false)} style={{flex:1,padding:10,borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>Cancelar</button>
          <button onClick={addHabito} style={{flex:2,padding:10,borderRadius:10,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontWeight:700,cursor:"pointer"}}>Criar Hábito</button>
        </div>
      </div>}
      {habitos.length===0&&!addH&&<div style={{textAlign:"center",padding:"32px 0",color:"#2a5a7a"}}>
        <div style={{fontSize:40,marginBottom:8}}>🔥</div>
        <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Nenhum hábito ainda</div>
        <div style={{fontSize:13}}>Crie um hábito para começar sua sequência</div>
      </div>}
      {habitos.map(h=>{
        const checks=h.checks||[];
        // últimos 14 dias
        const last14=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return d.toISOString().slice(0,10);});
        const totalMes=checks.filter(d=>d.startsWith(mesAtual)).length;
        return <div key={h.id} style={{background:"#0a1628",border:`1px solid ${h.cor}33`,borderRadius:16,padding:16,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:26}}>{h.emoji}</span>
              <div>
                <div style={{fontSize:16,fontWeight:700}}>{h.nome}</div>
                <div style={{display:"flex",gap:8,marginTop:2}}>
                  {h.streak>0&&<span style={{fontSize:12,color:"#f97316"}}>🔥 {h.streak} dias seguidos</span>}
                  <span style={{fontSize:12,color:"#4a7a9b"}}>{totalMes}x este mês</span>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>marcarHabito(h.id)}
                style={{width:40,height:40,borderRadius:10,border:`2px solid ${h.cor}`,cursor:"pointer",
                  background:(h.checks||[]).includes(todayDs)?h.cor:"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                  color:(h.checks||[]).includes(todayDs)?"#fff":h.cor}}>
                {(h.checks||[]).includes(todayDs)?"✓":"·"}
              </button>
              <button onClick={()=>delHabito(h.id)} style={{background:"none",border:"none",color:"#2a3a4a",cursor:"pointer",fontSize:18}}>×</button>
            </div>
          </div>
          {/* mini calendário de 14 dias */}
          <div style={{display:"flex",gap:3}}>
            {last14.map(ds=>{
              const fez=checks.includes(ds);
              const isToday=ds===now.toISOString().slice(0,10);
              return <div key={ds} style={{flex:1,height:24,borderRadius:4,
                background:fez?h.cor:isToday?"rgba(255,255,255,0.05)":"#060d18",
                border:isToday?`1px solid ${h.cor}66`:"1px solid #0e2035",
                opacity:fez?1:0.5}}/>;
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
            <span style={{fontSize:9,color:"#2a5a7a"}}>14 dias atrás</span>
            <span style={{fontSize:9,color:"#2a5a7a"}}>hoje</span>
          </div>
        </div>;
      })}
    </div>}

    {/* ── METAS ── */}
    {subTab==="metas"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1}}>METAS DO MÊS</div>
          <div style={{fontSize:12,color:"#2a5a7a"}}>{MONTHS_PT[now.getMonth()]} {now.getFullYear()}</div>
        </div>
        <button onClick={()=>setAddM(!addM)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"rgba(0,180,216,0.1)",color:"#00b4d8",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Meta</button>
      </div>
      {addM&&<div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:14,marginBottom:12}}>
        <input value={formM.texto} onChange={e=>setFormM(f=>({...f,texto:e.target.value}))} placeholder="Qual sua meta?"
          style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,outline:"none",marginBottom:8}}/>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>META (número)</div>
            <input type="number" value={formM.total} min="1" onChange={e=>setFormM(f=>({...f,total:+e.target.value}))}
              style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"9px 6px",color:"#fff",fontSize:18,fontWeight:700,textAlign:"center",outline:"none"}}/>
          </div>
          <div style={{flex:2}}>
            <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>CATEGORIA</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {CATS.map(c=><button key={c.id} onClick={()=>setFormM(f=>({...f,categoria:c.id}))}
                style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${formM.categoria===c.id?"#00e5ff":"#0e2035"}`,
                  background:formM.categoria===c.id?"rgba(0,229,255,0.1)":"transparent",
                  color:formM.categoria===c.id?"#00e5ff":"#4a7a9b",fontSize:11,cursor:"pointer"}}>{c.emoji} {c.label}</button>)}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddM(false)} style={{flex:1,padding:10,borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>Cancelar</button>
          <button onClick={addMeta} style={{flex:2,padding:10,borderRadius:10,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontWeight:700,cursor:"pointer"}}>Criar Meta</button>
        </div>
      </div>}
      {metasMes.length===0&&!addM&&<div style={{textAlign:"center",padding:"32px 0",color:"#2a5a7a"}}>
        <div style={{fontSize:40,marginBottom:8}}>🎯</div>
        <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Nenhuma meta este mês</div>
        <div style={{fontSize:13}}>Defina o que quer conquistar!</div>
      </div>}
      {metasMes.map(m=>{
        const cat=CATS.find(c=>c.id===m.categoria)||CATS[3];
        const pct=Math.min(((m.atual||0)/m.total)*100,100);
        const concluida=(m.atual||0)>=m.total;
        return <div key={m.id} style={{background:"#0a1628",border:`1px solid ${concluida?"#00c86444":"#0e2035"}`,borderRadius:16,padding:16,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{fontSize:16}}>{cat.emoji}</span>
                <span style={{fontSize:14,fontWeight:700,color:concluida?"#00c864":"#fff"}}>{m.texto}</span>
                {concluida&&<span style={{fontSize:14}}>🏆</span>}
              </div>
              <div style={{fontSize:12,color:"#4a7a9b"}}>{cat.label}</div>
            </div>
            <button onClick={()=>delMeta(m.id)} style={{background:"none",border:"none",color:"#2a3a4a",cursor:"pointer",fontSize:18}}>×</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <button onClick={()=>incrementMeta(m.id,-1)}
              style={{width:34,height:34,borderRadius:8,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:20,fontWeight:900,color:concluida?"#00c864":"#00e5ff"}}>{m.atual||0}</span>
                <span style={{fontSize:14,color:"#4a7a9b"}}>/ {m.total}</span>
              </div>
              <div style={{height:8,background:"#0e2035",borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,borderRadius:4,transition:"width 0.4s",
                  background:concluida?"linear-gradient(90deg,#00c864,#00e5aa)":"linear-gradient(90deg,#00b4d8,#00e5ff)"}}/>
              </div>
            </div>
            <button onClick={()=>incrementMeta(m.id,1)}
              style={{width:34,height:34,borderRadius:8,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>
        </div>;
      })}
    </div>}
  </div>;
}

// ── AGENDA VIEW ───────────────────────────────────────────────────────────────
// AGENDA VIEW - puxa Google Agenda via Apps Script
// parseEvTitle("Rafael 8") -> {nome:"Rafael", numAula:8}
// Horarios livres: 6h-11h, seg-sex apenas
