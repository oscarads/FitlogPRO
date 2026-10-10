function ProgressView({plan,logs,sessions,plans,students}){
  const [subTab,setSubTab]=useState("score"); // score | carga | avaliacao
  const [selPlan,setSelPlan]=useState(plan?.id||plans?.[0]?.id||null);
  const [selEx,setSelEx]=useState(null);
  const now=new Date();

  const activePlan=plans?.find(p=>p.id===selPlan)||plan;

  // ── SCORE: volume total (kg×reps) por sessão ──
  const sessoesSorted=[...sessions].sort((a,b)=>a.date.localeCompare(b.date)).slice(-16);
  const scoreData=sessoesSorted.map(s=>({
    date:s.date.slice(5),
    planName:s.planName,
    score:Math.round(s.entries?.reduce((a,e)=>a+e.sets.filter(x=>!x.isWarmup).reduce((b,x)=>b+(parseFloat(x.weight)||0)*(parseInt(x.reps)||0),0),0)||0),
    sets:s.entries?.reduce((a,e)=>a+e.sets.filter(x=>!x.isWarmup&&(x.reps||x.weight)).length,0)||0,
    duration:s.duration||0,
    type:s.workoutType,
  }));
  const maxScore=Math.max(...scoreData.map(s=>s.score),1);

  // ── FREQUÊNCIA semanal ──
  const weeks=Array.from({length:8},(_,i)=>{
    const wStart=new Date(now);wStart.setDate(now.getDate()-now.getDay()-(7*i)+1);wStart.setHours(0,0,0,0);
    const wEnd=new Date(wStart);wEnd.setDate(wStart.getDate()+6);
    const count=sessions.filter(s=>{const d=new Date(s.date+"T12:00");return d>=wStart&&d<=wEnd;}).length;
    return{label:i===0?"hoje":`-${i}s`,count};
  }).reverse();
  const maxW=Math.max(...weeks.map(w=>w.count),1);

  // ── CARGA: evolução por exercício ──
  const allExIds=activePlan?.exercises||[];
  const firstEx=selEx||allExIds[0]?.id;
  const exLogs=logs.filter(l=>l.exerciseId===firstEx&&!(/aquecimento/i.test(l.name||"")))
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(-10);
  const maxWts=exLogs.map(l=>Math.max(...l.sets.filter(s=>!s.isWarmup).map(s=>parseFloat(s.weight)||0),0));
  const rm1s=exLogs.map(l=>{
    const best=l.sets.filter(s=>!s.isWarmup).reduce((b,s)=>{
      const r=calc1RM(parseFloat(s.weight)||0,parseInt(s.reps)||1);
      return r>b?r:b;
    },0);
    return Math.round(best*10)/10;
  });
  const vols=exLogs.map(l=>Math.round(l.sets.filter(s=>!s.isWarmup).reduce((a,s)=>a+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0)));
  const maxWt=Math.max(...maxWts,1);
  const maxRM=Math.max(...rm1s,1);

  const wt=WORKOUT_TYPES.find(t=>t.id===sessions.at(-1)?.workoutType);
  const lastSess=[...sessions].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const daysSince=lastSess?Math.round((new Date()-new Date(lastSess.date+"T12:00"))/86400000):null;

  return <div style={{paddingBottom:20}}>
    {/* Sub-tabs */}
    <div style={{display:"flex",gap:4,marginBottom:16,background:"#0a1628",borderRadius:12,padding:3,border:"1px solid #0e2035"}}>
      {[["score","📊 Score"],["carga","📈 Cargas"],["avaliacao","📏 Avaliações"]].map(([v,l])=>(
        <button key={v} onClick={()=>setSubTab(v)}
          style={{flex:1,padding:"9px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:12,
            fontWeight:subTab===v?700:400,
            background:subTab===v?"linear-gradient(135deg,#00b4d8,#00e5ff)":"transparent",
            color:subTab===v?"#000":"#4a7a9b"}}>{l}</button>
      ))}
    </div>

    {/* ── SCORE ── */}
    {subTab==="score"&&<div>
      {daysSince>=5&&<div style={{background:"rgba(239,68,68,0.09)",border:"1px solid #ef444433",borderRadius:14,padding:"10px 14px",marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
        <span>⚠️</span><span style={{fontSize:13,color:"#ef4444"}}>{daysSince} dias sem treinar</span>
      </div>}

      {/* Frequência */}
      <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:12}}>
        <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:10}}>FREQUÊNCIA — 8 SEMANAS</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:3,height:56}}>
          {weeks.map((w,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              {w.count>0&&<div style={{fontSize:9,color:"#4a7a9b"}}>{w.count}x</div>}
              <div style={{width:"100%",borderRadius:"3px 3px 0 0",
                height:`${Math.max((w.count/maxW)*44,w.count>0?6:2)}px`,
                background:i===7?"linear-gradient(180deg,#00e5ff,#00b4d8)":w.count===0?"#1a2a3a":"rgba(0,180,216,0.35)"}}/>
              <div style={{fontSize:8,color:"#2a5a7a"}}>{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Score por sessão */}
      {scoreData.length===0?
        <div style={{background:"#0a1628",borderRadius:16,padding:32,textAlign:"center",border:"1px solid #0e2035"}}>
          <div style={{fontSize:40,marginBottom:8}}>📊</div>
          <div style={{color:"#4a7a9b"}}>Faça alguns treinos para ver o score!</div>
        </div>:
        <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1}}>SCORE POR TREINO</div>
            <div style={{fontSize:10,color:"#2a5a7a"}}>kg × reps</div>
          </div>
          {/* Gráfico em linha com área */}
          {(()=>{
            const W=320,H=90,PAD=8;
            const n=scoreData.length;
            if(n<2) return(
              <div style={{textAlign:"center",padding:16,color:"#4a7a9b",fontSize:12}}>
                Faça mais 1 treino para ver a evolução
              </div>
            );
            const pts=scoreData.map((s,i)=>({
              x:PAD+(i/(n-1))*(W-PAD*2),
              y:H-PAD-((s.score/maxScore)*(H-PAD*2)),
              ...s
            }));
            const polyPts=pts.map(p=>`${p.x},${p.y}`).join(" ");
            const areaPts=`${pts[0].x},${H} ${polyPts} ${pts.at(-1).x},${H}`;
            return <div style={{overflowX:"auto"}}>
              <svg width="100%" viewBox={`0 0 ${W} ${H+16}`} style={{display:"block"}}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.02"/>
                  </linearGradient>
                </defs>
                {/* Área */}
                <polygon points={areaPts} fill="url(#sg)"/>
                {/* Linha */}
                <polyline points={polyPts} fill="none" stroke="#00e5ff" strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round"/>
                {/* Pontos */}
                {pts.map((p,i)=>{
                  const isLast=i===pts.length-1;
                  const wt=WORKOUT_TYPES.find(t=>t.id===p.type);
                  return <g key={i}>
                    <circle cx={p.x} cy={p.y} r={isLast?5:3}
                      fill={isLast?"#00e5ff":wt?wt.color:"#00b4d8"}
                      stroke={isLast?"#fff":"none"} strokeWidth="1.5"/>
                    {(isLast||i===0||i===Math.floor(n/2))&&(
                      <text x={p.x} y={p.y-8} textAnchor="middle"
                        fontSize="9" fill={isLast?"#00e5ff":"#4a7a9b"}
                        fontWeight={isLast?"700":"400"}>
                        {p.score.toLocaleString()}
                      </text>
                    )}
                    <text x={p.x} y={H+12} textAnchor="middle" fontSize="8" fill="#2a5a7a">
                      {p.date}
                    </text>
                  </g>;
                })}
              </svg>
            </div>;
          })()}
          {/* Card do último treino */}
          {scoreData.at(-1)&&(()=>{
            const last=scoreData.at(-1);
            const prev=scoreData.at(-2);
            const diff=prev?last.score-prev.score:null;
            return <div style={{marginTop:10,display:"flex",gap:10,padding:"10px 12px",
              background:"rgba(0,229,255,0.04)",borderRadius:12,border:"1px solid rgba(0,229,255,0.12)"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"#4a7a9b"}}>Último treino · {last.date}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",marginTop:2}}>{last.planName}</div>
                <div style={{fontSize:11,color:"#4a7a9b",marginTop:1}}>{last.sets} séries · {last.duration}min</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:26,fontWeight:900,color:"#00e5ff",lineHeight:1}}>{last.score.toLocaleString()}</div>
                <div style={{fontSize:10,color:"#4a7a9b",marginTop:2}}>pts</div>
                {diff!==null&&<div style={{fontSize:11,fontWeight:700,color:diff>=0?"#00c864":"#ef4444",marginTop:2}}>
                  {diff>=0?"▲":"▼"} {Math.abs(diff).toLocaleString()}
                </div>}
              </div>
            </div>;
          })()}
        </div>
      }

      {/* Recordes por exercício */}
      {activePlan&&activePlan.exercises.length>0&&<div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14}}>
        <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:10}}>🏆 RECORDES PESSOAIS</div>
        {activePlan.exercises.map(ex=>{
          const exL=logs.filter(l=>l.exerciseId===ex.id&&!(/aquecimento/i.test(l.name||"")));
          const best=exL.reduce((b,l)=>{
            const w=Math.max(...l.sets.filter(s=>!s.isWarmup).map(s=>parseFloat(s.weight)||0),0);
            return w>b?w:b;
          },0);
          const rm1=exL.reduce((b,l)=>{
            const r=Math.max(...l.sets.filter(s=>!s.isWarmup).map(s=>calc1RM(parseFloat(s.weight)||0,parseInt(s.reps)||1)),0);
            return r>b?r:b;
          },0);
          if(!best) return null;
          return <div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #0a1e30"}}>
            <div style={{fontSize:13,color:"#aaa"}}>{ex.name}</div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:14,fontWeight:800,color:"#fff"}}>{best}kg</span>
              {rm1>0&&<span style={{fontSize:10,color:"#4a7a9b"}}>1RM ~{rm1.toFixed(0)}kg</span>}
            </div>
          </div>;
        })}
      </div>}
    </div>}

    {/* ── CARGAS ── */}
    {subTab==="carga"&&<div>
      {/* Seletor de plano */}
      {plans?.length>1&&<div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:10,paddingBottom:4,scrollbarWidth:"none"}}>
        {plans.map(p=>(
          <button key={p.id} onClick={()=>{setSelPlan(p.id);setSelEx(null);}}
            style={{flex:"0 0 auto",padding:"5px 12px",borderRadius:20,fontSize:11,cursor:"pointer",
              border:"1px solid "+(selPlan===p.id?"#00e5ff":"#0e2035"),
              background:selPlan===p.id?"rgba(0,229,255,0.1)":"transparent",
              color:selPlan===p.id?"#00e5ff":"#4a7a9b",fontWeight:selPlan===p.id?700:400,whiteSpace:"nowrap"}}>
            {p.name}
          </button>
        ))}
      </div>}
      {/* Seletor de exercício */}
      {activePlan&&<div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:14,paddingBottom:4,scrollbarWidth:"none"}}>
        {activePlan.exercises.map(ex=>(
          <button key={ex.id} onClick={()=>setSelEx(ex.id)}
            style={{flex:"0 0 auto",padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,whiteSpace:"nowrap",
              border:"1px solid "+((firstEx===ex.id)?"#00e5ff":"#0e2035"),
              background:(firstEx===ex.id)?"rgba(0,229,255,0.1)":"transparent",
              color:(firstEx===ex.id)?"#00e5ff":"#4a7a9b",fontWeight:(firstEx===ex.id)?700:400}}>
            {ex.name}
          </button>
        ))}
      </div>}

      {exLogs.length===0?
        <div style={{background:"#0a1628",borderRadius:16,padding:32,textAlign:"center",border:"1px solid #0e2035"}}>
          <div style={{fontSize:40,marginBottom:8}}>📈</div>
          <div style={{color:"#4a7a9b"}}>Sem dados para este exercício ainda.</div>
        </div>:<>
        {/* Cards resumo */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[
            {label:"Melhor carga",val:Math.max(...maxWts)+"kg",color:"#00e5ff"},
            {label:"1RM estimado",val:Math.max(...rm1s).toFixed(1)+"kg",color:"#00c864"},
            {label:"Volume atual",val:vols.at(-1)?.toLocaleString("pt-BR")+"kg",color:"#f97316"},
          ].map(c=>(
            <div key={c.label} style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#4a7a9b",marginBottom:3}}>{c.label}</div>
              <div style={{fontSize:16,fontWeight:800,color:c.color}}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Helper: linha SVG reutilizável */}
        {[
          {title:"CARGA MÁXIMA (kg)",data:maxWts,color:"#00e5ff",gradId:"cg"},
          {title:"1RM ESTIMADO (kg)",data:rm1s,color:"#00c864",gradId:"rg"},
        ].map(({title,data,color,gradId})=>{
          const mx=Math.max(...data,1);
          const W=320,H=80,P=8;
          const n=data.length;
          const pts=n<2?[]:(data.map((v,i)=>({
            x:P+(i/(n-1))*(W-P*2),
            y:H-P-((v/mx)*(H-P*2)),
            v,date:exLogs[i]?.date.slice(5)||""
          })));
          return <div key={title} style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:10}}>
            <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:10}}>{title}</div>
            {n<2?
              <div style={{textAlign:"center",color:"#4a7a9b",fontSize:12,padding:"20px 0"}}>
                Registre mais treinos para ver a evolução
              </div>:
              <div style={{overflowX:"auto"}}>
                <svg width="100%" viewBox={`0 0 ${W} ${H+16}`} style={{display:"block"}}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
                      <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  <polygon points={`${pts[0].x},${H} ${pts.map(p=>`${p.x},${p.y}`).join(" ")} ${pts.at(-1).x},${H}`}
                    fill={`url(#${gradId})`}/>
                  <polyline points={pts.map(p=>`${p.x},${p.y}`).join(" ")}
                    fill="none" stroke={color} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round"/>
                  {pts.map((p,i)=>{
                    const isLast=i===pts.length-1;
                    const up=i>0&&p.v>pts[i-1].v;
                    return <g key={i}>
                      <circle cx={p.x} cy={p.y} r={isLast?5:3}
                        fill={isLast?color:up?color+"aa":color+"44"}
                        stroke={isLast?"#fff":"none"} strokeWidth="1.5"/>
                      <text x={p.x} y={p.y-8} textAnchor="middle" fontSize="9"
                        fill={isLast?color:"#4a7a9b"} fontWeight={isLast?"700":"400"}>
                        {p.v}
                      </text>
                      <text x={p.x} y={H+12} textAnchor="middle" fontSize="8" fill="#2a5a7a">{p.date}</text>
                    </g>;
                  })}
                </svg>
              </div>
            }
          </div>;
        })}
      </>}
    </div>}

    {/* ── AVALIAÇÕES ── */}
    {subTab==="avaliacao"&&<div>
      {(!students||students.length===0)?
        <div style={{background:"#0a1628",borderRadius:16,padding:32,textAlign:"center",border:"1px solid #0e2035"}}>
          <div style={{fontSize:40,marginBottom:8}}>📏</div>
          <div style={{color:"#4a7a9b"}}>Registre avaliações físicas na aba Alunos para ver a evolução aqui.</div>
        </div>:
        <div>{students.flatMap(s=>(s.avaliacoes||[]).length<2?[]:[s]).map(s=>{
          const avs=[...(s.avaliacoes||[])].sort((a,b)=>a.data.localeCompare(b.data));
          const medidas=[
            {id:"peso",label:"Peso",unit:"kg",color:"#00e5ff"},
            {id:"cintura",label:"Cintura",unit:"cm",color:"#ef4444"},
            {id:"perna",label:"Perna",unit:"cm",color:"#8b5cf6"},
            {id:"braco",label:"Braço",unit:"cm",color:"#22c55e"},
          ].filter(m=>avs.some(a=>a[m.id]));
          return <div key={s.id} style={{marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:10}}>{s.nome}</div>
            {medidas.map(m=>{
              const vals=avs.map(a=>parseFloat(a[m.id])||0).filter(v=>v>0);
              const dates=avs.filter(a=>parseFloat(a[m.id])>0).map(a=>a.data.slice(5));
              if(vals.length<2) return null;
              const mx=Math.max(...vals),mn=Math.min(...vals);
              const delta=vals.at(-1)-vals[0];
              return <div key={m.id} style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:12,marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:m.color}}>{m.label}</span>
                  <span style={{fontSize:12,color:delta<0&&m.id!=="braco"?"#00c864":delta>0&&m.id!=="braco"?"#ef4444":"#4a7a9b"}}>
                    {delta>0?"+":""}{delta.toFixed(1)}{m.unit}
                  </span>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:50}}>
                  {vals.map((v,i)=>{
                    const h=mn===mx?40:Math.max(((v-mn)/(mx-mn))*42+8,8);
                    const isLast=i===vals.length-1;
                    return <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                      {isLast&&<div style={{fontSize:8,color:m.color,fontWeight:700}}>{v}</div>}
                      <div style={{width:"100%",borderRadius:"3px 3px 0 0",height:h+"px",
                        background:isLast?m.color:m.color+"55"}}/>
                      <div style={{fontSize:7,color:"#2a5a7a"}}>{dates[i]}</div>
                    </div>;
                  })}
                </div>
              </div>;
            })}
          </div>;
        })}</div>}
    </div>}
  </div>;
}

// ── VOLUME VIEW ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════
// SEÇÃO 9: ABA VOLUME (📊)
// Mostra volume semanal por grupo muscular
// - Barra sólida: volume direto
// - Barra clara: volume via sinergistas (toggle on/off)
// - Exercícios com (aquecimento) são excluídos
// ═══════════════════════════════════════════════════
function VolumeView({plans}){
  const [showSin,setShowSin]=useState(true);
  const totalVol={};MUSCLE_GROUPS.forEach(m=>{totalVol[m.id]=0;});
  const totalSin={};MUSCLE_GROUPS.forEach(m=>{totalSin[m.id]=0;});
  plans.forEach(plan=>plan.exercises.forEach(ex=>{
    if(/aquecimento/i.test(ex.name||"")) return; // não conta no volume
    const mg=ex.muscleGroup||detectMuscle(ex.name);
    if(mg&&totalVol[mg]!==undefined){
      totalVol[mg]+=ex.sets;
      (SINERGISTAS[mg]||[]).forEach(syn=>{
        if(totalSin[syn]!==undefined) totalSin[syn]+=ex.sets*0.4;
      });
    }
  }));
  const hasData=Object.values(totalVol).some(v=>v>0);
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
      <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase"}}>Volume Semanal</div>
      <button onClick={()=>setShowSin(!showSin)}
        style={{fontSize:11,color:showSin?"#00e5ff":"#4a7a9b",background:"transparent",
          border:"1px solid "+(showSin?"#00e5ff44":"#0e2035"),
          borderRadius:20,padding:"3px 10px",cursor:"pointer"}}>
        sinergistas {showSin?"on":"off"}
      </button>
    </div>
    <div style={{fontSize:12,color:"#2a5a7a",marginBottom:14}}>Séries por grupo muscular na semana</div>
    {!hasData&&<div style={{background:"#0a1628",borderRadius:16,padding:32,textAlign:"center",border:"1px solid #0e2035"}}><div style={{fontSize:36,marginBottom:8}}>💪</div><div style={{color:"#4a7a9b",fontSize:13}}>Monte seu plano para ver o volume.</div></div>}
    {hasData&&MUSCLE_GROUPS.map(m=>{
      const sets=totalVol[m.id],rec=VOLUME_REC[m.id]||8;
      const sinSets=showSin?(totalSin[m.id]||0):0;
      if(sets===0&&sinSets===0) return null; // hide empty muscles
      const pct=Math.min((sets/rec)*100,100);
      const barColor=sets===0?"#1a2a3a":sets>=rec?"#00c864":sets<rec*0.6?"#f59e0b":"#00b4d8";
      const totalSets=sets+sinSets;
      const pctSin=Math.min((totalSets/rec)*100,100);
      return <div key={m.id} style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:9,height:9,borderRadius:"50%",background:m.color}}/><span style={{fontSize:13,fontWeight:600,color:sets>0?m.color:"#2a5a7a"}}>{m.label}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            {(showSin?totalSets:sets)>0&&(showSin?totalSets:sets)<rec*0.6&&<span style={{fontSize:10,color:"#f59e0b"}}>⚠</span>}
            {(showSin?totalSets:sets)>=rec&&<span style={{fontSize:10,color:"#00c864"}}>✓</span>}
            <span style={{fontSize:14,fontWeight:800,color:sets>0?"#fff":"#2a5a7a"}}>{sets}</span>
            {showSin&&sinSets>0&&<span style={{fontSize:11,color:m.color,fontWeight:600}}>+{sinSets.toFixed(1)}</span>}
            <span style={{fontSize:11,color:"#2a5a7a"}}>/{rec}</span>
          </div>
        </div>
        <div style={{height:7,background:"#0a1628",borderRadius:4,overflow:"hidden",border:"1px solid #0e2035",position:"relative"}}>
          {/* Camada de fundo: volume total (direto + sinergistas) */}
          {showSin&&sinSets>0&&pctSin>pct&&(
            <div style={{position:"absolute",height:"100%",
              left:`${pct}%`,width:`${pctSin-pct}%`,
              background:m.color+"55",borderRadius:"0 4px 4px 0"}}/>
          )}
          {/* Barra principal: volume direto */}
          <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:4,transition:"width 0.5s",position:"relative",zIndex:1}}/>
        </div>
        {showSin&&sinSets>0&&<div style={{fontSize:9,color:"#2a5a7a",marginTop:1}}>
          {sets} direto + {sinSets.toFixed(1)} via sinergistas = {totalSets.toFixed(1)} total
        </div>}
      </div>;
    })}
  </div>;
}

// ── HISTORY VIEW ──────────────────────────────────────────────────────────────
// HistoryView: lista dos últimos 40 treinos concluídos (sessions), do mais recente
// pro mais antigo. Ao clicar num item (expanded), mostra os detalhes das séries feitas.
function HistoryView({sessions,logs,onDelete}){
  const [expanded,setExpanded]=useState(null); // id da sessão aberta, ou null se nenhuma
  const sorted=[...sessions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40);
  const typeMap=Object.fromEntries(WORKOUT_TYPES.map(t=>[t.id,t]));
  return <div>
    <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Histórico</div>
    <div style={{fontSize:12,color:"#2a5a7a",marginBottom:12}}>Toque para ver detalhes</div>
    {sorted.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#2a5a7a"}}><div style={{fontSize:40,marginBottom:8}}>📋</div>Nenhum treino ainda.</div>}
    {sorted.map(sess=>{
      const tv=sess.entries.reduce((a,e)=>a+e.sets.reduce((b,s)=>b+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0),0);
      const ts=sess.entries.reduce((a,e)=>a+e.sets.filter(s=>s.reps||s.weight).length,0);
      const isOpen=expanded===sess.id;const wt=typeMap[sess.workoutType];
      return <div key={sess.id} style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,marginBottom:10,overflow:"hidden"}}>
        <div onClick={()=>setExpanded(isOpen?null:sess.id)} style={{padding:"13px 16px",cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {wt&&<span style={{fontSize:16}}>{wt.emoji}</span>}
                <div style={{fontSize:15,fontWeight:700}}>{sess.planName}</div>
              </div>
              <div style={{fontSize:12,color:"#4a7a9b",marginTop:2}}>📅 {new Date(sess.date+"T12:00").toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}</div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <span style={{fontSize:12,color:"#2a7a5a"}}>⏱ {sess.duration}min</span>
                <span style={{fontSize:12,color:"#2a5a7a"}}>🔢 {ts} séries</span>
                <span style={{fontSize:12,color:"#4a9ebb"}}>📦 {Math.round(tv).toLocaleString("pt-BR")}kg</span>
                {wt&&<span style={{fontSize:12,color:wt.color}}>{wt.label}</span>}
              </div>
              {sess.notes&&<div style={{fontSize:12,color:"#4a7a9b",marginTop:4,fontStyle:"italic"}}>"{sess.notes}"</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <button onClick={e=>{e.stopPropagation();onDelete(sess.id);}} style={{background:"none",border:"none",color:"#2a3a4a",cursor:"pointer",fontSize:20}}>×</button>
              <span style={{fontSize:16,color:"#2a5a7a"}}>{isOpen?"▲":"▼"}</span>
            </div>
          </div>
        </div>
        {isOpen&&<div style={{borderTop:"1px solid #0e2035",padding:"12px 16px"}}>
          {sess.entries.map(e=>{
            const filled=e.sets.filter(s=>s.reps||s.weight);if(!filled.length)return null;
            const exLogs=logs.filter(l=>l.exerciseId===e.exerciseId).sort((a,b)=>a.date.localeCompare(b.date));
            const prev=exLogs.at(-2);
            const curB=Math.max(...filled.map(s=>parseFloat(s.weight)||0));
            const prevB=prev?Math.max(...prev.sets.map(s=>parseFloat(s.weight)||0)):null;
            const up=prevB!==null&&curB>prevB;
            return <div key={e.exerciseId} style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid #0a1e30"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <span style={{fontSize:14,fontWeight:700,color:up?"#00c864":"#fff"}}>{up?"▲ ":""}{e.name}</span>
                {up&&<span style={{fontSize:11,color:"#00c864"}}>🏆 {prevB}→{curB}kg</span>}
              </div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {filled.map((s,si)=>{
                  const ps=prev?.sets[si];const wd=ps&&parseFloat(s.weight)&&parseFloat(ps.weight)?(parseFloat(s.weight)-parseFloat(ps.weight)):null;
                  return <div key={si} style={{background:"#060d18",borderRadius:9,padding:"6px 10px",minWidth:60,border:`1px solid ${wd>0?"#0d3a1a":wd<0?"#3a1a1a":"#0e2035"}`}}>
                    <div style={{fontSize:9,color:"#4a7a9b"}}>S{si+1}</div>
                    <div style={{fontSize:14,fontWeight:800}}>{s.weight||"—"}kg</div>
                    <div style={{fontSize:11,color:"#4a9ebb"}}>{s.reps||"—"} reps</div>
                    {wd!==null&&<div style={{fontSize:10,color:wd>0?"#00c864":wd<0?"#ff4e6a":"#555"}}>{wd>0?"+":""}{wd}kg</div>}
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>}
      </div>;
    })}
  </div>;
}

// ── AVALIAÇÃO FÍSICA ─────────────────────────────────────────────────────────
// Medidas padrão — cada aluno pode ter as suas
const DEFAULT_MEDIDAS = [
  {id:"peso",      label:"Peso",        unit:"kg",  cat:"bio",  essential:true},
  {id:"gordura",   label:"% Gordura",   unit:"%",   cat:"bio"},
  {id:"musculo",   label:"Massa Musc.", unit:"kg",  cat:"bio"},
  {id:"agua",      label:"Água",        unit:"%",   cat:"bio"},
  {id:"cintura",   label:"Cintura",     unit:"cm",  cat:"circ", essential:true},
  {id:"quadril",   label:"Quadril",     unit:"cm",  cat:"circ", essential:true},
  {id:"peito",     label:"Peito",       unit:"cm",  cat:"circ"},
  {id:"ombro",     label:"Ombro",       unit:"cm",  cat:"circ"},
  {id:"braco",     label:"Braço",       unit:"cm",  cat:"circ"},
  {id:"antebraco", label:"Antebraço",   unit:"cm",  cat:"circ"},
  {id:"perna",     label:"Perna",       unit:"cm",  cat:"circ", essential:true},
  {id:"panturrilha",label:"Panturrilha",unit:"cm",  cat:"circ"},
  {id:"peitoral_d",label:"Peitoral",    unit:"mm",  cat:"dobra"},
  {id:"abdom_d",   label:"Abdominal",   unit:"mm",  cat:"dobra"},
  {id:"coxa_d",    label:"Coxa",        unit:"mm",  cat:"dobra"},
  {id:"triceps_d", label:"Tríceps",     unit:"mm",  cat:"dobra"},
  {id:"axilar_d",  label:"Axilar",      unit:"mm",  cat:"dobra"},
  {id:"subesc_d",  label:"Subescap.",   unit:"mm",  cat:"dobra"},
  {id:"suprai_d",  label:"Suprailíaca", unit:"mm",  cat:"dobra"},
];
const CAT_LABELS={bio:"📊 Bioimpedância",circ:"📏 Circunferências (cm)",dobra:"📐 Dobras Cutâneas (mm)"};
const CAT_COLORS={bio:"#00b4d8",circ:"#ec4899",dobra:"#f97316"};

// Mini gráfico SVG de linha
function MiniChart({values, color="#00e5ff", width=200, height=60, unit=""}){
  if(!values||values.length<2) return null;
  const nums=values.map(v=>parseFloat(v)||0);
  const mn=Math.min(...nums), mx=Math.max(...nums), rng=mx-mn||1;
  const pts=nums.map((v,i)=>`${(i/(nums.length-1))*width},${height-((v-mn)/rng)*(height-8)-4}`).join(" ");
  const last=pts.split(" ").at(-1).split(",");
  return <svg width={width} height={height} style={{overflow:"visible"}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
    {nums.map((v,i)=>{
      const x=(i/(nums.length-1))*width, y=height-((v-mn)/rng)*(height-8)-4;
      return <g key={i}>
        <circle cx={x} cy={y} r={i===nums.length-1?5:3} fill={i===nums.length-1?color:"rgba(255,255,255,0.3)"} stroke={color} strokeWidth="1.5"/>
        <text x={x} y={y-8} textAnchor="middle" fontSize="9" fill={color}>{v}{unit}</text>
      </g>;
    })}
  </svg>;
}

// AvaliacaoView: tela de avaliação física (medidas corporais) por aluno.
// Cada aluno guarda um array `avaliacoes` (uma por data) com os valores de cada medida.
// `medidasAtivas` no aluno controla QUAIS medidas aparecem pra ele (nem todo aluno mede tudo);
// se o aluno não tiver isso configurado ainda, usa como padrão só as medidas "essential".
