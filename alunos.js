function AvaliacaoView({students,onUpdate}){
  const now=new Date();
  const [sel,setSel]=useState(null); // id do aluno selecionado
  const [screen,setScreen]=useState("list"); // list | nova | historico | configurar
  const [chartMedida,setChartMedida]=useState("peso"); // qual medida está sendo exibida no gráfico

  const [form,setForm]=useState({}); // valores digitados na tela "nova avaliação"
  const [dataSel,setDataSel]=useState(now.toISOString().slice(0,10));

  const student=students.find(x=>x.id===sel);
  // medidas ativas deste aluno (padrão = essentials)
  const medidasAtivas=student?.medidasAtivas||DEFAULT_MEDIDAS.filter(m=>m.essential).map(m=>m.id);
  const medidasDoAluno=DEFAULT_MEDIDAS.filter(m=>medidasAtivas.includes(m.id));

  // salvarAvaliacao: cria um novo registro de avaliação com a data escolhida e os
  // valores do form, e acrescenta ao array avaliacoes do aluno (não sobrescreve as antigas).
  const salvarAvaliacao=()=>{
    const av={id:uid(),data:dataSel,...form,obs:form.obs||""};
    const avs=[...(student.avaliacoes||[]),av];
    onUpdate({...student,avaliacoes:avs});
    setScreen("historico");setForm({});
  };

  const delAvaliacao=id=>{
    onUpdate({...student,avaliacoes:(student.avaliacoes||[]).filter(a=>a.id!==id)});
  };

  const toggleMedida=mid=>{
    const cur=medidasAtivas;
    const nova=cur.includes(mid)?cur.filter(x=>x!==mid):[...cur,mid];
    onUpdate({...student,medidasAtivas:nova});
  };

  // alertas de avaliação pendente (última > 30 dias)
  const alertas=students.filter(s=>{
    const avs=(s.avaliacoes||[]);
    if(avs.length===0) return false;
    const ult=avs.sort((a,b)=>b.data.localeCompare(a.data))[0];
    return (new Date()-new Date(ult.data+"T12:00"))/86400000>30;
  });

  // ── LISTA ──
  if(screen==="list") return <div>
    <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Avaliação Física</div>
    {alertas.length>0&&<div style={{background:"rgba(234,179,8,0.08)",border:"1px solid #eab30833",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
      <div style={{fontSize:12,color:"#eab308",fontWeight:700,marginBottom:6}}>⏰ Avaliação pendente há +30 dias</div>
      {alertas.map(s=><div key={s.id} style={{fontSize:13,color:"#aaa",marginBottom:2}}>
        <span style={{color:"#fff",fontWeight:600}}>{s.nome}</span> — última: {fmtDate((s.avaliacoes||[]).sort((a,b)=>b.data.localeCompare(a.data))[0]?.data||"")}
      </div>)}
    </div>}
    {students.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:"#2a5a7a"}}>
      <div style={{fontSize:36,marginBottom:8}}>📏</div>
      <div>Cadastre alunos primeiro</div>
    </div>}
    {students.map(s=>{
      const avs=(s.avaliacoes||[]).sort((a,b)=>b.data.localeCompare(a.data));
      const ult=avs[0];
      const dias=ult?Math.round((new Date()-new Date(ult.data+"T12:00"))/86400000):null;
      return <div key={s.id} onClick={()=>{setSel(s.id);setScreen("historico");}}
        style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:19,fontWeight:800}}>{s.nome}</div>
            <div style={{fontSize:12,color:"#4a7a9b",marginTop:2}}>
              {avs.length===0?"Sem avaliações":`${avs.length} avaliação${avs.length>1?"ões":""} · última ${dias===0?"hoje":dias===1?"ontem":dias+"d atrás"}`}
            </div>
            {ult&&ult.peso&&<div style={{fontSize:12,color:"#00e5ff",marginTop:2}}>Peso: {ult.peso}kg</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {dias>30&&<span style={{fontSize:10,color:"#eab308",background:"rgba(234,179,8,0.1)",padding:"2px 8px",borderRadius:20}}>⏰ atrasada</span>}
            <span style={{fontSize:18,color:"#2a5a7a"}}>›</span>
          </div>
        </div>
      </div>;
    })}
  </div>;

  // ── HISTÓRICO + GRÁFICOS ──
  if(screen==="historico"&&student){
    const avs=[...(student.avaliacoes||[])].sort((a,b)=>b.data.localeCompare(a.data));
    const avsAsc=[...avs].reverse();
    const chartMed=DEFAULT_MEDIDAS.find(m=>m.id===chartMedida);
    const chartVals=avsAsc.map(av=>av[chartMedida]).filter(v=>v!==undefined&&v!=="");
    const chartDates=avsAsc.filter(av=>av[chartMedida]!==undefined&&av[chartMedida]!=="").map(av=>av.data.slice(5));
    // delta última vs anterior
    const delta=(mid)=>{
      const vals=avsAsc.map(av=>parseFloat(av[mid])).filter(v=>!isNaN(v));
      if(vals.length<2) return null;
      return vals.at(-1)-vals.at(-2);
    };
    return <div style={{paddingBottom:80}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={()=>setScreen("list")} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800}}>{student.nome}</div>
          <div style={{fontSize:12,color:"#4a7a9b"}}>{avs.length} avaliação{avs.length!==1?"ões":""}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>setScreen("configurar")} style={{padding:"7px 12px",borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:13}}>⚙️</button>
          <button onClick={()=>{setForm({});setDataSel(now.toISOString().slice(0,10));setScreen("nova");}}
            style={{padding:"7px 14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Nova</button>
        </div>
      </div>

      {/* seletor de medida para gráfico */}
      {avs.length>=2&&<div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:14}}>
        <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:8}}>GRÁFICO DE EVOLUÇÃO</div>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,marginBottom:12,scrollbarWidth:"none"}}>
          {medidasDoAluno.map(m=>{
            const vals=avsAsc.map(av=>av[m.id]).filter(v=>v!=="");
            if(vals.length<2) return null;
            return <button key={m.id} onClick={()=>setChartMedida(m.id)}
              style={{flex:"0 0 auto",padding:"5px 12px",borderRadius:20,border:`1px solid ${chartMedida===m.id?CAT_COLORS[m.cat]:"#0e2035"}`,
                background:chartMedida===m.id?CAT_COLORS[m.cat]+"22":"transparent",
                color:chartMedida===m.id?CAT_COLORS[m.cat]:"#4a7a9b",fontSize:12,fontWeight:chartMedida===m.id?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>
              {m.label}
            </button>;
          })}
        </div>
        {chartVals.length>=2?<div>
          <div style={{overflowX:"auto"}}>
            <MiniChart values={chartVals} color={CAT_COLORS[chartMed?.cat]||"#00e5ff"} width={Math.max(chartVals.length*56,200)} height={70} unit={chartMed?.unit||""}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            {chartDates.map((d,i)=><span key={i} style={{fontSize:9,color:"#2a5a7a",flex:1,textAlign:"center"}}>{d}</span>)}
          </div>
          {delta(chartMedida)!==null&&<div style={{marginTop:10,padding:"8px 12px",borderRadius:10,
            background:delta(chartMedida)<0&&chartMedida!=="musculo"?"rgba(0,200,100,0.08)":"rgba(0,229,255,0.08)",
            border:"1px solid rgba(0,229,255,0.15)",fontSize:13}}>
            <span style={{color:"#4a7a9b"}}>Variação: </span>
            <span style={{fontWeight:700,color:delta(chartMedida)===0?"#aaa":delta(chartMedida)<0?"#00c864":"#ef4444"}}>
              {delta(chartMedida)>0?"+":""}{delta(chartMedida)?.toFixed(1)}{chartMed?.unit}
            </span>
            <span style={{color:"#4a7a9b",fontSize:11}}> (última vs anterior)</span>
          </div>}
        </div>:<div style={{fontSize:12,color:"#2a5a7a",textAlign:"center",padding:"12px 0"}}>Precisa de 2+ avaliações para ver o gráfico</div>}
      </div>}

      {/* lista de avaliações */}
      {avs.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"#2a5a7a"}}>
        <div style={{fontSize:36,marginBottom:8}}>📏</div>
        <div>Nenhuma avaliação ainda</div>
      </div>}
      {avs.map((av,idx)=>{
        const prev=avs[idx+1];
        return <div key={av.id} style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>{fmtFull(av.data)}</div>
              {idx===0&&<span style={{fontSize:10,background:"rgba(0,229,255,0.1)",color:"#00e5ff",padding:"2px 8px",borderRadius:20}}>Mais recente</span>}
            </div>
            <button onClick={()=>delAvaliacao(av.id)} style={{background:"none",border:"none",color:"#2a3a4a",cursor:"pointer",fontSize:18}}>×</button>
          </div>
          {/* medidas em grid */}
          {Object.entries(CAT_LABELS).map(([cat,catLabel])=>{
            const meds=medidasDoAluno.filter(m=>m.cat===cat&&av[m.id]!==undefined&&av[m.id]!=="");
            if(meds.length===0) return null;
            return <div key={cat} style={{marginBottom:10}}>
              <div style={{fontSize:10,color:CAT_COLORS[cat],letterSpacing:1,marginBottom:6}}>{catLabel}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {meds.map(m=>{
                  const d=prev&&prev[m.id]!==undefined&&prev[m.id]!==""?(parseFloat(av[m.id])-parseFloat(prev[m.id])):null;
                  const melhora=d!==null&&(m.id==="musculo"?d>0:d<0);
                  return <div key={m.id} style={{background:"#060d18",borderRadius:10,padding:"8px 12px",minWidth:80,
                    border:`1px solid ${d!==null&&melhora?"#00c86433":d!==null&&!melhora&&d!==0?"#ef444433":"#0e2035"}`}}>
                    <div style={{fontSize:10,color:"#4a7a9b"}}>{m.label}</div>
                    <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{av[m.id]}<span style={{fontSize:10,color:"#4a7a9b"}}>{m.unit}</span></div>
                    {d!==null&&d!==0&&<div style={{fontSize:10,color:melhora?"#00c864":"#ef4444"}}>{d>0?"+":""}{d.toFixed(1)}</div>}
                  </div>;
                })}
              </div>
            </div>;
          })}
          {av.obs&&<div style={{fontSize:12,color:"#4a7a9b",fontStyle:"italic",marginTop:6}}>"{av.obs}"</div>}
        </div>;
      })}
    </div>;
  }

  // ── NOVA AVALIAÇÃO ──
  if(screen==="nova"&&student) return <div style={{paddingBottom:80}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <button onClick={()=>setScreen("historico")} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
      <div style={{fontSize:16,fontWeight:700}}>Nova Avaliação — {student.nome}</div>
    </div>
    <div style={{fontSize:10,color:"#4a7a9b",marginBottom:5}}>DATA</div>
    <input type="date" value={dataSel} onChange={e=>setDataSel(e.target.value)}
      style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,padding:"11px 14px",color:"#fff",fontSize:14,outline:"none",marginBottom:16}}/>
    {Object.entries(CAT_LABELS).map(([cat,catLabel])=>{
      const meds=medidasDoAluno.filter(m=>m.cat===cat);
      if(meds.length===0) return null;
      return <div key={cat} style={{marginBottom:16}}>
        <div style={{fontSize:11,color:CAT_COLORS[cat],letterSpacing:1,marginBottom:8}}>{catLabel}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {meds.map(m=><div key={m.id}>
            <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>{m.label} ({m.unit})</div>
            <input type="number" value={form[m.id]||""} onChange={e=>setForm(f=>({...f,[m.id]:e.target.value}))}
              style={{width:"100%",background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"9px 6px",color:"#fff",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
          </div>)}
        </div>
      </div>;
    })}
    <div style={{fontSize:10,color:"#4a7a9b",marginBottom:5}}>OBSERVAÇÕES</div>
    <textarea value={form.obs||""} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} placeholder="Anotações livres..."
      style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,padding:"11px 14px",color:"#fff",fontSize:14,outline:"none",resize:"none",marginBottom:16}}/>
    <button onClick={salvarAvaliacao} style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontSize:15,fontWeight:800,cursor:"pointer"}}>
      💾 Salvar Avaliação
    </button>
  </div>;

  // ── CONFIGURAR MEDIDAS ──
  if(screen==="configurar"&&student) return <div style={{paddingBottom:80}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <button onClick={()=>setScreen("historico")} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
      <div>
        <div style={{fontSize:16,fontWeight:700}}>Medidas de {student.nome}</div>
        <div style={{fontSize:12,color:"#4a7a9b"}}>Ative só as que você mede</div>
      </div>
    </div>
    {Object.entries(CAT_LABELS).map(([cat,catLabel])=>(
      <div key={cat} style={{marginBottom:16}}>
        <div style={{fontSize:11,color:CAT_COLORS[cat],letterSpacing:1,marginBottom:8}}>{catLabel}</div>
        {DEFAULT_MEDIDAS.filter(m=>m.cat===cat).map(m=>{
          const ativa=medidasAtivas.includes(m.id);
          return <div key={m.id} onClick={()=>toggleMedida(m.id)}
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",marginBottom:6,
              background:ativa?"rgba(0,180,216,0.08)":"#0a1628",
              border:`1px solid ${ativa?CAT_COLORS[cat]+"55":"#0e2035"}`,borderRadius:12,cursor:"pointer"}}>
            <div>
              <div style={{fontSize:14,fontWeight:ativa?600:400,color:ativa?"#fff":"#4a7a9b"}}>{m.label}</div>
              <div style={{fontSize:11,color:"#2a5a7a"}}>{m.unit}</div>
            </div>
            <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${ativa?CAT_COLORS[cat]:"#2a5a7a"}`,
              background:ativa?CAT_COLORS[cat]:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff"}}>
              {ativa?"✓":""}
            </div>
          </div>;
        })}
      </div>
    ))}
  </div>;

  return null;
}

// ── ALUNOS ────────────────────────────────────────────────────────────────────
// ── CALCULADOR DE PACOTE REAL ────────────────────────────────────────────────
// CALC PACOTE - conta exatamente quantas aulas cabem no mes pelos dias escolhidos
// PacoteCalc: mostra quantas aulas cabem no mês (atual, resto do mês, ou próximo mês)
// com base nos dias da semana do aluno (diasSemana). A contagem real de dias é feita
// pela função calcPacoteReal(), definida mais abaixo no arquivo (busque "SEÇÃO: PACOTE").
// onAplicar(aulas): botão que aplica o número calculado direto no campo "pacote" do aluno.
function PacoteCalc({onAplicar, pacoteAtual, diasSemana}){
  const now=new Date();
  const DIAS_LABEL=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  // Usa os dias já configurados no cadastro do aluno
  const diasSel=diasSemana&&diasSemana.length>0?diasSemana:[1,3];
  const [mesSel,setMesSel]=useState("atual"); // qual período está selecionado: atual | resto | proximo

  const calcular=()=>{
    if(diasSel.length===0) return 0;
    const ano=now.getFullYear();
    const mes=now.getMonth()+1;
    const proxAno=mes===12?ano+1:ano;
    const proxMes=mes===12?1:mes+1;
    if(mesSel==="atual")   return calcPacoteReal(ano,mes,diasSel,false);
    if(mesSel==="resto")   return calcPacoteReal(ano,mes,diasSel,true);
    if(mesSel==="proximo") return calcPacoteReal(proxAno,proxMes,diasSel,false);
    return 0;
  };

  const aulas=calcular();
  const mesNomeAtual=MONTHS[now.getMonth()]+" "+now.getFullYear();
  const proxM=now.getMonth()===11?0:now.getMonth()+1;
  const mesNomeProx=MONTHS[proxM]+(now.getMonth()===11?" "+(now.getFullYear()+1):" "+now.getFullYear());

  return <div style={{background:"#0a1628",border:"1px solid #1a3a5a",borderRadius:14,marginBottom:12,overflow:"hidden"}}>
    <div style={{padding:"12px 14px",borderBottom:"1px solid #0e2035"}}>
      <div style={{fontSize:11,color:"#4a9ebb",letterSpacing:1}}>📊 CALCULAR PACOTE REAL</div>
      <div style={{fontSize:11,color:"#2a5a7a",marginTop:2}}>
        {diasSel.length>0?`${diasSel.map(d=>DIAS_LABEL[d]).join(", ")} · baseado nos dias acima`:"Configure os dias acima"}
      </div>
    </div>
    <div style={{padding:"10px 14px"}}>
      {/* Período */}
      <div style={{display:"flex",gap:5,marginBottom:12}}>
        {[
          ["atual",   `Mês completo\n${mesNomeAtual}`],
          ["resto",   `Resto do mês\n(a partir de hoje)`],
          ["proximo", `Próximo mês\n${mesNomeProx}`],
        ].map(([v,lbl])=><button key={v} onClick={()=>setMesSel(v)}
          style={{flex:1,padding:"8px 4px",borderRadius:10,border:`2px solid ${mesSel===v?"#00e5ff":"#0e2035"}`,
            background:mesSel===v?"rgba(0,229,255,0.12)":"transparent",
            color:mesSel===v?"#00e5ff":"#4a7a9b",fontSize:10,fontWeight:mesSel===v?700:400,cursor:"pointer",
            lineHeight:1.4,whiteSpace:"pre-line"}}>
          {lbl}
        </button>)}
      </div>
      {/* Resultado */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        background:"rgba(0,229,255,0.07)",border:"1px solid rgba(0,229,255,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:10}}>
        <span style={{fontSize:13,color:"#4a9ebb"}}>
          {diasSel.map(d=>DIAS_LABEL[d]).join(", ")} · {mesSel==="atual"?mesNomeAtual:mesSel==="resto"?"resto de "+mesNomeAtual:mesNomeProx}
        </span>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:36,fontWeight:900,color:"#00e5ff",lineHeight:1}}>{aulas}</div>
          <div style={{fontSize:11,color:"#4a9ebb"}}>aulas</div>
        </div>
      </div>
      <button onClick={()=>aulas>0&&onAplicar(aulas)}
        style={{width:"100%",padding:"11px",borderRadius:11,border:"none",
          background:aulas>0?"linear-gradient(135deg,#00b4d8,#00e5ff)":"#0e2035",
          color:aulas>0?"#000":"#2a5a7a",fontSize:13,fontWeight:800,cursor:aulas>0?"pointer":"default"}}>
        {aulas>0?`Aplicar ${aulas} aulas ao pacote`:"Configure os dias acima primeiro"}
      </button>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════
// SEÇÃO 10: FORMULÁRIO DE ALUNO
// Campos: nome, WhatsApp, modelo pagamento, valor/aula,
//         frequência semanal (1-5x), dias opcionais
// Modelo "pacote fixo": valor mensal, aulas passam para o mês seguinte
// Modelo "por aula": cobra por aula feita
// ═══════════════════════════════════════════════════
// AlunoForm: formulário de cadastro/edição de aluno. `d` é o rascunho local editado nos
// inputs; só é gravado de verdade quando o usuário clica em Salvar (onSave(d)).
function AlunoForm({aluno,onSave,onCancel}){
  const now=new Date();
  const [d,setD]=useState(()=>aluno?{...aluno}:{
    id:uid(),nome:"",whatsapp:"",
    valorAula:0,diasSemana:[],
    pacotePago:0,aulas:[],pagamentos:[],avaliacoes:[]
  });
  const valid=d.nome.trim().length>0; // exige nome preenchido pra habilitar Salvar

  // calcAulasMes: conta quantos dias de um mês caem nos dias da semana escolhidos
  // (d.diasSemana, ex: [1,3] = Segunda e Quarta). Usado só como prévia informativa aqui
  // (a contagem "oficial" pro pacote é feita em calcPacoteReal, mais abaixo no arquivo).
  const calcAulasMes=(ano,mes)=>{
    const dias=d.diasSemana||[];
    if(!dias.length) return 0;
    const fim=new Date(ano,mes+1,0);let n=0;
    for(let dt=new Date(ano,mes,1);dt<=fim;dt.setDate(dt.getDate()+1))
      if(dias.includes(dt.getDay())) n++;
    return n;
  };
  const aulasMes=calcAulasMes(now.getFullYear(),now.getMonth());
  const proxMes=now.getMonth()===11?0:now.getMonth()+1;
  const proxAno=now.getMonth()===11?now.getFullYear()+1:now.getFullYear();
  const aulasMesProx=calcAulasMes(proxAno,proxMes);

  return <div style={{paddingBottom:80}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
      <button onClick={onCancel} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
      <div style={{fontSize:17,fontWeight:700}}>{aluno?"Editar Aluno":"Novo Aluno"}</div>
    </div>

    {/* Nome */}
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#4a7a9b",marginBottom:5,letterSpacing:1}}>NOME</div>
      <input value={d.nome} onChange={e=>setD(x=>({...x,nome:e.target.value}))}
        placeholder="Nome do aluno" autoFocus
        style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,
          padding:"13px 14px",color:"#fff",fontSize:16,fontWeight:600,outline:"none"}}/>
    </div>

    {/* WhatsApp */}
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#4a7a9b",marginBottom:5,letterSpacing:1}}>WHATSAPP</div>
      <input value={d.whatsapp||""} inputMode="numeric"
        onChange={e=>setD(x=>({...x,whatsapp:e.target.value.replace(/\D/g,"")}))}
        placeholder="11999999999"
        style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,
          padding:"13px 14px",color:"#fff",fontSize:15,outline:"none"}}/>
    </div>

    {/* Modelo de pagamento */}
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#4a7a9b",marginBottom:8,letterSpacing:1}}>MODELO DE PAGAMENTO</div>
      <div style={{display:"flex",gap:8}}>
        {[["poraula","Por aula"],["fixo","Pacote fixo"]].map(([v,l])=>(
          <button key={v} onClick={()=>setD(x=>({...x,modeloPag:v}))}
            style={{flex:1,padding:"10px",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:600,
              border:`1px solid ${(d.modeloPag||"poraula")===v?"#00e5ff":"#0e2035"}`,
              background:(d.modeloPag||"poraula")===v?"rgba(0,229,255,0.1)":"transparent",
              color:(d.modeloPag||"poraula")===v?"#00e5ff":"#4a7a9b"}}>{l}</button>
        ))}
      </div>
    </div>

    {/* Valor */}
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#4a7a9b",marginBottom:5,letterSpacing:1}}>
        {(d.modeloPag||"poraula")==="fixo"?"VALOR DO PACOTE (R$)":"VALOR POR AULA (R$)"}
      </div>
      <input type="number" inputMode="decimal"
        value={(d.modeloPag||"poraula")==="fixo"?(d.valorFixo||""):(d.valorAula||"")}
        onChange={e=>{
          const v=e.target.value===""?"":+e.target.value;
          if((d.modeloPag||"poraula")==="fixo") setD(x=>({...x,valorFixo:v}));
          else setD(x=>({...x,valorAula:v}));
        }}
        placeholder={(d.modeloPag||"poraula")==="fixo"?"Ex: 600":"Ex: 70"}
        style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:12,
          padding:"13px 14px",color:"#00e5ff",fontSize:22,fontWeight:800,outline:"none"}}/>
      {(d.modeloPag||"poraula")==="fixo"&&<div style={{fontSize:11,color:"#4a7a9b",marginTop:4}}>
        Aulas passam para o mês seguinte se não feitas
      </div>}
    </div>

    {/* Frequência semanal */}
    <div style={{marginBottom:14}}>
      <div style={{fontSize:10,color:"#4a7a9b",letterSpacing:1,marginBottom:8}}>FREQUÊNCIA SEMANAL</div>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        {[1,2,3,4,5].map(n=>{
          const sel=(d.vezesSemanais||0)===n;
          return <button key={n} onClick={()=>setD(x=>({...x,vezesSemanais:n}))}
            style={{flex:1,padding:"10px 0",borderRadius:9,cursor:"pointer",fontSize:14,fontWeight:700,
              border:`1px solid ${sel?"#00e5ff":"#0e2035"}`,
              background:sel?"rgba(0,229,255,0.12)":"transparent",
              color:sel?"#00e5ff":"#4a7a9b"}}>{n}x</button>;
        })}
      </div>
      <div style={{fontSize:11,color:"#4a7a9b",marginBottom:6}}>Dias fixos (opcional — deixe vazio se variam):</div>
      <div style={{display:"flex",gap:4}}>
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((dia,i)=>{
          const sel=(d.diasSemana||[]).includes(i);
          return <button key={i} onClick={()=>{
            const cur=d.diasSemana||[];
            setD(x=>({...x,diasSemana:sel?cur.filter(d=>d!==i):[...cur,i].sort()}));
          }} style={{flex:1,padding:"7px 0",borderRadius:8,cursor:"pointer",fontSize:10,
            border:`1px solid ${sel?"#00b4d8":"#0e2035"}`,
            background:sel?"rgba(0,180,216,0.12)":"transparent",
            color:sel?"#00b4d8":"#4a7a9b",fontWeight:sel?700:400}}>{dia}</button>;
        })}
      </div>
    </div>

    {/* Preview dos meses */}
    {(d.diasSemana||[]).length>0&&d.valorAula>0&&<div style={{
      background:"rgba(0,180,216,0.06)",border:"1px solid #00b4d822",borderRadius:14,padding:14,marginBottom:20}}>
      <div style={{fontSize:10,color:"#4a7a9b",letterSpacing:1,marginBottom:10}}>PREVISÃO DE AULAS</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[[MONTHS[now.getMonth()],aulasMes,"#00b4d8"],[MONTHS[proxMes]+" (próximo)",aulasMesProx,"#8b5cf6"]].map(([lbl,n,c])=>(
          <div key={lbl} style={{textAlign:"center",background:"#060d18",borderRadius:10,padding:"10px 6px",border:`1px solid ${c}22`}}>
            <div style={{fontSize:9,color:"#4a7a9b",marginBottom:3}}>{lbl}</div>
            <div style={{fontSize:26,fontWeight:900,color:c}}>{n}</div>
            <div style={{fontSize:11,color:"#2a5a7a"}}>R${n*(d.valorAula||0)}</div>
          </div>
        ))}
      </div>
    </div>}

    <div style={{display:"flex",gap:10}}>
      <button onClick={onCancel} style={{flex:1,padding:14,borderRadius:12,
        border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>
        Cancelar
      </button>
      <button onClick={()=>valid&&onSave(d)} style={{flex:2,padding:14,borderRadius:12,
        border:"none",fontSize:15,fontWeight:800,cursor:valid?"pointer":"default",
        background:valid?"linear-gradient(135deg,#00b4d8,#00e5ff)":"#0e2035",
        color:valid?"#000":"#2a5a7a"}}>
        Salvar
      </button>
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════
// SEÇÃO 11: BLOCO DE COBRANÇA
// Props: s (aluno), dadas (aulas feitas), mesAtual, onUpdate
// Lógica:
//   pacotePago = total pago pelo aluno (vem do X/Y da agenda)
//   restantes  = pacotePago - dadas
//   concluido  = dadas >= pacotePago → sugere cobrar mais
// Telas: principal → cobrar → relatório
// ═══════════════════════════════════════════════════
function CobrancaBlock({s,dadas,mesAtual,onUpdate,setSelected,meuPix,sessions=[]}){
  const now=new Date();
  const valorAula=parseFloat(s.valorAula)||0;
  const pacotePago=parseInt(s.pacotePago)||0;  // total aulas pagas
  const restantes=Math.max(0,pacotePago-dadas); // faltam fazer das pagas
  const concluido=pacotePago>0&&dadas>=pacotePago; // usou tudo que pagou

  // Próximo mês
  const calcAulasMes=(ano,mes)=>{
    const dias=s.diasSemana||[];
    if(!dias.length) return 0;
    const fim=new Date(ano,mes+1,0);let n=0;
    for(let dt=new Date(ano,mes,1);dt<=fim;dt.setDate(dt.getDate()+1))
      if(dias.includes(dt.getDay())) n++;
    return n;
  };
  const proxMes=now.getMonth()===11?0:now.getMonth()+1;
  const proxAno=now.getMonth()===11?now.getFullYear()+1:now.getFullYear();
  const aulasMesProx=calcAulasMes(proxAno,proxMes);

  const [modo,setModo]=useState(null); // null | "cobrar" | "relatorio"
  const [qtd,setQtd]=useState("");
  const [confirmado,setConfirmado]=useState(false);

  const vQtd=(parseInt(qtd)||0)*valorAula;

  // registrarPagamento: registra um novo pagamento e "rola" o pacote.
  // Em vez de simplesmente sobrescrever pacotePago, soma o pacote anterior (pacoteAnterior)
  // dentro de pacoteBase — assim, aulas que já passaram do pacote antigo (overage) continuam
  // contando corretamente no cálculo do novo pacote.
  const registrarPagamento=(numAulas)=>{
    const v=numAulas*valorAula;
    const pag={id:uid(),data:todayStr(),valor:v,aulas:numAulas,mes:mesAtual};
    // Rola o pacote: soma o pacote anterior na base, define o novo pacote
    // Assim, aulas extras já marcadas (overage) automaticamente contam no novo pacote
    const baseAnterior=parseInt(s.pacoteBase)||0;
    const pacoteAnterior=parseInt(s.pacotePago)||0;
    const novaBase=baseAnterior+pacoteAnterior;
    const updated={...s,
      pacoteBase:novaBase,
      pacotePago:numAulas,
      pagamentos:[...(s.pagamentos||[]),pag]};
    onUpdate(updated);setSelected(updated);
    setModo(null);setQtd("");setConfirmado(false);
  };

  const wpp=(txt)=>{
    const num=(s.whatsapp||"").replace(/\D/g,"");
    if(!num){alert("Adicione o WhatsApp do aluno.");return;}
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(txt)}`,"_blank");
  };

  // gerarRelatorio: monta o texto (pra mandar no WhatsApp) com a lista de aulas feitas.
  // Prioriza os eventos da Agenda (datasAgenda) como fonte de verdade — busca eventos cujo
  // título começa com o nome do aluno e tem um número de aula (ex: "Rafael 3/16", ver
  // parseEvTitle). Se não achar nada na agenda, cai no fallback: aulas marcadas manualmente
  // dentro do próprio app (aulasApp, campo s.aulas).
  const gerarRelatorio=()=>{
    const pacote=parseInt(s.pacotePago)||parseInt(s.creditos)||0;
    const nFalta=(s.aulas||[]).filter(a=>a.tipo==="falta").length;
    const nDesmarcou=(s.aulas||[]).filter(a=>a.tipo==="desmarcou").length;
    // Puxa eventos da agenda com o nome do aluno e número de aula
    const nomeAluno=(s.nome||"").trim().toLowerCase();
    const datasAgenda=(sessions||[])
      .filter(ev=>{
        const t=(ev.title||"").toLowerCase();
        const {numAula}=parseEvTitle(ev.title||"");
        return t.startsWith(nomeAluno)&&numAula&&numAula>0;
      })
      .map(ev=>({data:ev.start?new Date(ev.start).toISOString().slice(0,10):null}))
      .filter(e=>e.data)
      .sort((a,b)=>a.data.localeCompare(b.data));
    // Fallback: aulas marcadas no app
    const aulasApp=(s.aulas||[])
      .filter(a=>a.tipo==="feita"||(a.presente&&!a.tipo))
      .sort((a,b)=>a.data.localeCompare(b.data));
    const fonte=datasAgenda.length>0?datasAgenda:aulasApp;
    if(!fonte.length) return "Nenhuma aula registrada ainda.";
    const lista=pacote>0&&fonte.length>pacote?fonte.slice(-pacote):fonte;
    const linhas=lista.map((a,i)=>{
      const d=new Date(a.data+"T12:00");
      return (i+1)+". "+d.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
    });
    const total=lista.length;
    const info=pacote>0
      ?"\n\n"+total+"/"+pacote+" aulas"+(valorAula>0?" · R$"+total*valorAula:"")
      :"\n\nTotal: "+total+" aulas"+(valorAula>0?" · R$"+total*valorAula:"");
    const freq=nFalta||nDesmarcou?"\n\nFreq: "+total+" feitas, "+nFalta+" faltou, "+nDesmarcou+" desmarcou":"";
    const label=datasAgenda.length>0?" (agenda)":" (app)";
    return "Aulas feitas — "+s.nome+label+"\n\n"+linhas.join("\n")+info+freq;
  };

  // ── Tela: cobrar ─────────────────────────────────────────────────────────
  if(modo==="cobrar") return(
    <div style={{background:"#0a1628",border:"1px solid #00b4d8",borderRadius:16,padding:16,marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={()=>{setModo(null);setQtd("");setConfirmado(false);}}
          style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{fontSize:14,fontWeight:700}}>Cobrar — {s.nome}</div>
      </div>

      {/* Atalhos rápidos */}
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[restantes>0&&restantes,aulasMesProx,8,10,12].filter(Boolean)
          .filter((v,i,a)=>a.indexOf(v)===i).map(n=>(
          <button key={n} onClick={()=>setQtd(String(n))}
            style={{padding:"6px 14px",borderRadius:20,cursor:"pointer",fontSize:12,
              border:`1px solid ${qtd==n?"#00e5ff":"#0e2035"}`,
              background:qtd==n?"rgba(0,229,255,0.12)":"transparent",
              color:qtd==n?"#00e5ff":"#4a7a9b",fontWeight:qtd==n?700:400}}>
            {n}{n===restantes&&restantes?" (restam)":n===aulasMesProx?" (próx. mês)":""}
          </button>
        ))}
      </div>

      <input type="number" inputMode="numeric" value={qtd}
        onChange={e=>setQtd(e.target.value)} placeholder="Quantas aulas?"
        style={{width:"100%",background:"#060d18",border:"1px solid #00b4d8",borderRadius:10,
          padding:"12px 14px",color:"#fff",fontSize:24,fontWeight:900,outline:"none",marginBottom:8}}/>

      {qtd&&valorAula>0&&<div style={{background:"rgba(0,180,216,0.08)",borderRadius:10,
        padding:"12px 14px",marginBottom:12,textAlign:"center"}}>
        <div style={{fontSize:11,color:"#4a7a9b",marginBottom:4}}>{qtd} aulas × R${valorAula}</div>
        <div style={{fontSize:36,fontWeight:900,color:"#00e5ff"}}>R${vQtd}</div>
        {meuPix&&<div style={{fontSize:11,color:"#4a7a9b",marginTop:4}}>Pix: {meuPix}</div>}
      </div>}

      {!confirmado?<div style={{display:"flex",gap:8}}>
        <button onClick={()=>qtd&&wpp(
          `Olá ${s.nome}, tudo bem? 😊\n\nPassando para te lembrar sobre o pagamento das suas aulas!\n\n` +
          `📋 *${parseInt(qtd)} aulas* realizadas\n` +
          `💰 Valor: *R$ ${vQtd}*\n` +
          (meuPix?`💳 Pix: *${meuPix}*\n`:``) +
          `\nQualquer dúvida é só me chamar! Abraços 💪`
        )} style={{flex:1,padding:"11px",borderRadius:10,border:"none",
          background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
          📱 WhatsApp
        </button>
        <button onClick={()=>setConfirmado(true)}
          disabled={!qtd||parseInt(qtd)<=0}
          style={{flex:1,padding:"11px",borderRadius:10,border:"none",fontWeight:700,
            background:qtd&&parseInt(qtd)>0?"linear-gradient(135deg,#00c864,#00e5aa)":"#0e2035",
            color:qtd&&parseInt(qtd)>0?"#000":"#2a5a7a",cursor:"pointer"}}>
          ✓ Recebi!
        </button>
      </div>:
      <div>
        <div style={{background:"rgba(0,200,100,0.1)",borderRadius:12,padding:14,marginBottom:10,textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:700,color:"#00c864"}}>✓ Pagamento registrado</div>
          <div style={{fontSize:12,color:"#aaa",marginTop:4}}>+{qtd} aulas no pacote de {s.nome}</div>
        </div>
        <button onClick={()=>registrarPagamento(parseInt(qtd))}
          style={{width:"100%",padding:"12px",borderRadius:10,border:"none",
            background:"linear-gradient(135deg,#00b4d8,#00e5ff)",
            color:"#000",fontSize:14,fontWeight:800,cursor:"pointer"}}>
          Confirmar e fechar
        </button>
      </div>}
    </div>
  );

  // ── Tela: relatório ───────────────────────────────────────────────────────
  if(modo==="relatorio") return(
    <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:16,marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button onClick={()=>setModo(null)}
          style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{fontSize:14,fontWeight:700}}>Relatório — {s.nome}</div>
      </div>
      <div style={{background:"#060d18",borderRadius:12,padding:12,marginBottom:12,
        fontSize:12,color:"#aaa",lineHeight:1.8,whiteSpace:"pre-wrap"}}>
        {gerarRelatorio()}
      </div>
      <button onClick={()=>wpp(gerarRelatorio())}
        style={{width:"100%",padding:"11px",borderRadius:10,border:"none",
          background:"linear-gradient(135deg,#25d366,#128c7e)",
          color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
        📱 Enviar por WhatsApp
      </button>
    </div>
  );

  // ── Tela principal ────────────────────────────────────────────────────────
  return <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:8}}>
    <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:1,marginBottom:12}}>💰 {s.nome}</div>

    {!valorAula&&<div style={{fontSize:12,color:"#f59e0b",background:"rgba(234,179,8,0.08)",
      borderRadius:8,padding:"8px 10px",marginBottom:10}}>
      ⚠️ Configure o valor por aula no cadastro
    </div>}

    {/* Resumo simples: feitas / pacote pago */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
      {[
        {l:"Feitas",v:dadas,c:"#00c864",sub:valorAula?`R$${dadas*valorAula}`:""},
        {l:"Pagas",v:pacotePago,c:pacotePago>0?"#00b4d8":"#4a7a9b",sub:valorAula&&pacotePago?`R$${pacotePago*valorAula}`:"—"},
        {l:"Restam",v:restantes,c:restantes>0?"#eab308":concluido?"#00c864":"#4a7a9b",
          sub:concluido?"✓ ok":restantes>0?"a fazer":"—"},
      ].map(({l,v,c,sub})=>(
        <div key={l} style={{background:"#060d18",borderRadius:10,padding:"8px",
          textAlign:"center",border:"1px solid #0e2035"}}>
          <div style={{fontSize:9,color:"#4a7a9b",marginBottom:2}}>{l}</div>
          <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
          {sub&&<div style={{fontSize:10,color:"#2a5a7a"}}>{sub}</div>}
        </div>
      ))}
    </div>

    {/* Alerta quando usou tudo */}
    {concluido&&<div style={{background:"rgba(0,229,255,0.08)",border:"1px solid #00e5ff44",
      borderRadius:10,padding:"10px 12px",marginBottom:10}}>
      <div style={{fontSize:13,fontWeight:700,color:"#00e5ff",marginBottom:4}}>
        🎉 Pacote completo! Hora de cobrar mais.
      </div>
      <div style={{fontSize:11,color:"#4a7a9b"}}>
        Fez {dadas} aulas — próximo pacote: {aulasMesProx>0?aulasMesProx+" aulas previstas":"quantas quiser"}
      </div>
    </div>}

    {/* Botões */}
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <button onClick={()=>setModo("cobrar")}
        style={{padding:"13px 16px",borderRadius:11,border:"none",cursor:"pointer",
          background:concluido?"linear-gradient(135deg,#00b4d8,#00e5ff)":"linear-gradient(135deg,rgba(0,180,216,0.2),rgba(0,229,255,0.1))",
          color:concluido?"#000":"#00b4d8",fontSize:13,fontWeight:700}}>
        💰 {concluido?`Cobrar próximo pacote (${aulasMesProx>0?aulasMesProx:"??"} aulas — R$${aulasMesProx*valorAula})`:"Cobrar aulas"}
      </button>
      <button onClick={()=>setModo("relatorio")}
        style={{padding:"11px 16px",borderRadius:11,border:"1px solid #0e2035",cursor:"pointer",
          background:"transparent",color:"#4a7a9b",fontSize:12}}>
        📋 Ver relatório das {dadas} aulas feitas
      </button>
    </div>
  </div>;
}


// ALUNOS VIEW - listagem, check de aulas, cobranca
// Pagamento: "completo" zera mes | "parcial" continua contando
// ═══════════════════════════════════════════════════
// SEÇÃO 12: ABA ALUNOS (👥)
// Screens: list → detail → form-new → form-edit
// marcarAula: registra aula feita/falta em data específica
// toggleAula: chamado pela agenda — se título "X/Y":
//   reconstrói X sessões retroativas E define pacotePago=Y
// ═══════════════════════════════════════════════════
function AlunosView({students,onUpdate,onAdd,onDelete,meuPix,sessions=[]}){
  const [screen,setScreen]=useState("list");
  const [selected,setSelected]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [dtAdd,setDtAdd]=useState(todayStr());

  const [confirm,setConfirm]=useState(null);
  const now=new Date();
  const mesAtual=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const mesNome=`${MONTHS_PT[now.getMonth()]} ${now.getFullYear()}`;

  const aulasDoMes=s=>(s.aulas||[]).filter(a=>a.data&&a.data.startsWith(mesAtual));
  const aulasDadas=s=>{
    // Total histórico de feitas+faltas (ambas contam/cobram)
    const totalHist=(s.aulas||[]).filter(a=>
      a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo)
    ).length;
    // pacoteBase = soma de pacotes já cobrados anteriormente
    const base=parseInt(s.pacoteBase)||0;
    // dadas do pacote ATUAL = total - base (nunca negativo)
    return Math.max(0,totalHist-base);
  };
  const faltasDoMes=s=>(s.aulas||[]).filter(a=>a.data&&a.data.startsWith(mesAtual)&&(a.tipo==='falta')).length;
  // ✅ CORRIGIDO: `s.pacote` (campo que nunca existe) trocado por `s.pacotePago` (campo real)
  // nos 4 lugares do arquivo que usavam esse nome errado — busque "s.pacotePago||8" pra achar
  // as 4 correções (as outras 3 estão marcadas "✅ CORRIGIDO (s.pacote)" mais abaixo).
  const creditosMes=s=>{
    if(!s.carryOver)return 0;
    const mesPrev=new Date(now.getFullYear(),now.getMonth()-1,1);
    const mpStr=`${mesPrev.getFullYear()}-${String(mesPrev.getMonth()+1).padStart(2,"0")}`;
    const feitasPrev=(s.aulas||[]).filter(a=>a.data.startsWith(mpStr)&&a.presente).length;
    return Math.max(0,(s.pacotePago||8)-feitasPrev);
  };
  const totalMes=s=>{
    // Calcula aulas do mês pelos dias que o aluno vem
    const now=new Date();
    if((s.diasSemana||[]).length>0)
      return calcPacoteReal(now.getFullYear(),now.getMonth()+1,s.diasSemana,false);
    return s.creditos||s.pacotePago||8;
  };

  // ✓ = aula feita (conta no pacote)
  // ✗ = falta (conta no pacote — você estava disponível)
  // Para não cobrar: use o botão ↺ para remover o registro
  const marcarAula=(s,tipoArg,data)=>{
    const ds=data||todayStr();
    const tipo=tipoArg===true?"feita":tipoArg===false||tipoArg===null?false:tipoArg;
    const novasAulas=tipo===false
      ?(s.aulas||[]).filter(a=>a.data!==ds)
      :[...(s.aulas||[]).filter(a=>a.data!==ds),
        {id:uid(),data:ds,tipo,presente:tipo==="feita"}];
    const updated={...s,aulas:novasAulas};
    onUpdate(updated);if(selected?.id===s.id)setSelected(updated);
  };
  // Cicla: vazio→feita→falta→desmarcou→vazio (1 botão, 1-2-3 cliques)
  const cicloTipo={null:"feita",undefined:"feita","feita":"falta","falta":"desmarcou","desmarcou":null};
  const proximoTipo=t=>cicloTipo[t]===undefined?"feita":cicloTipo[t];

  const gerarRelatorio=s=>{
    const dadas=aulasDadas(s),faltas=faltasDoMes(s),total=totalMes(s);
    const cred=creditosMes(s);
    const aulas=aulasDoMes(s).filter(a=>a.presente).sort((a,b)=>a.data.localeCompare(b.data));
    const lista=aulas.map((a,i)=>`  Aula ${i+1}: ${new Date(a.data+"T12:00").toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}`).join("\n");
    const pixLine=meuPix?`\n💳 *Pix:* ${meuPix}`:"";
    const credLine=cred>0?`\n_(inclui ${cred} crédito${cred>1?"s":""} do mês anterior)_`:"";
    const faltaLine=faltas>0?`\n⚠️ ${faltas} falta${faltas>1?"s":""} registrada${faltas>1?"s":""}.`:"";
    const valorCobrar=(s.modeloCobranca||"fechado")==="mensal"
      ?(dadas*(s.valorAula||0))
      :s.valor;
    const cobrancaLine=dadas>=total
      ?`\n\n🎉 Pacote completo! Hora de renovar.\n💰 Valor: *R$ ${valorCobrar}*${pixLine}`
      :valorCobrar>0?`\n\n💰 Valor do mês: *R$ ${valorCobrar}*${pixLine}`:"";
    return `Olá ${s.nome}! 👋\n\nSuas aulas de *${mesNome}*:${credLine}\n\n${lista||"  (nenhuma aula registrada)"}\n\n✅ *${dadas} de ${total} aulas realizadas.*${faltaLine}${cobrancaLine}\n\nQualquer dúvida estou à disposição! 💪`;
  };

  const enviarWpp=s=>{
    const num=s.whatsapp?.replace(/\D/g,"");
    if(!num){alert("Adicione o WhatsApp.");return;}
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(gerarRelatorio(s))}`,"_blank");
  };

  if(screen==="form-new")return <AlunoForm onSave={a=>{onAdd(a);setScreen("list");}} onCancel={()=>setScreen("list")}/>;
  if(screen==="form-edit"&&selected)return <AlunoForm aluno={selected} onSave={a=>{onUpdate(a);setSelected(a);setScreen("detail");}} onCancel={()=>setScreen("detail")}/>;

  if(screen==="detail"&&selected){
    const s=students.find(x=>x.id===selected.id)||selected;
    const dadas=aulasDadas(s),faltas=faltasDoMes(s),total=totalMes(s),cred=creditosMes(s);
    const creditos=Math.max(0,parseInt(s.creditos)||0);
    const aulasMes=(()=>{
      const dias=s.diasSemana||[];if(!dias.length)return total;
      const n=new Date(),fim=new Date(n.getFullYear(),n.getMonth()+1,0);let cnt=0;
      for(let dt=new Date(n.getFullYear(),n.getMonth(),1);dt<=fim;dt.setDate(dt.getDate()+1))
        if(dias.includes(dt.getDay()))cnt++;
      return cnt;
    })();
      // Progresso = aulas feitas / total do mês
      const pacote=parseInt(s.pacotePago)||parseInt(s.creditos)||0;
      const totalReal=pacote>0?pacote:total;
      const pct=Math.min((dadas/Math.max(totalReal,1))*100,100);
      const completo=pacote>0&&dadas>=pacote;
    const aulaHoje=(s.aulas||[]).some(a=>a.data===todayStr());
    const bColor=completo?"#00c864":faltas>0?"#ef4444":"#0e2035";
    return <div style={{paddingBottom:80}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setScreen("list")} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:22,cursor:"pointer",padding:0}}>←</button>
          <div style={{width:40,height:40,borderRadius:12,background:`${bColor}22`,border:`1px solid ${bColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:bColor,flexShrink:0}}>{s.nome.charAt(0).toUpperCase()}</div>
          <div><div style={{fontSize:17,fontWeight:800}}>{s.nome}</div><div style={{fontSize:12,color:"#4a7a9b"}}>R${s.valorAula||"—"}/aula{(s.pacotePago||0)>0?" · "+s.pacotePago+" aulas":""}</div></div>
        </div>
        <button onClick={()=>{setSelected(s);setScreen("form-edit");}} style={{background:"none",border:"1px solid #0e2035",borderRadius:8,color:"#4a7a9b",padding:"6px 10px",cursor:"pointer",fontSize:14}}>✏️</button>
      </div>
      <div style={{background:"#0a1628",borderRadius:16,padding:16,border:`1px solid ${bColor}`,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:24,fontWeight:900,color:completo?"#00c864":"#fff"}}>{dadas}<span style={{fontSize:14,color:"#4a7a9b",fontWeight:400}}> / {pacote||total} aulas</span></span>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,color:"#4a7a9b"}}>{mesNome}</div>
            {faltas>0&&<div style={{fontSize:12,color:"#ef4444"}}>{faltas} falta{faltas>1?"s":""}</div>}
            {completo&&<div style={{fontSize:13,fontWeight:700,color:"#00c864"}}>🎉 Cobrar!</div>}
          </div>
        </div>
        <div style={{height:10,background:"#0e2035",borderRadius:5,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,borderRadius:5,background:completo?"linear-gradient(90deg,#00c864,#00e5aa)":faltas>0?"linear-gradient(90deg,#ef4444,#f87171)":"linear-gradient(90deg,#00b4d8,#00e5ff)",transition:"width 0.5s"}}/>
        </div>
                {/* Editar pacote rápido */}
        <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,marginTop:6}}>
          {s.valorAula>0&&<span style={{fontSize:11,color:"#2a5a7a"}}>R${s.valorAula}/aula</span>}
          <button onClick={()=>{
            const restAtual=Math.max(0,(parseInt(s.pacotePago)||0)-dadas);
            const n=parseInt(prompt("Quantas aulas o aluno AINDA TEM (restantes)?",restAtual||""));
            if(n>=0){
              // Reseta a base para o total atual, e define pacotePago = restantes desejado
              // Assim dadas_do_pacote_atual = total - novaBase = 0, e restam N
              const totalHist=(s.aulas||[]).filter(a=>
                a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo)
              ).length;
              const u={...s,pacoteBase:totalHist,pacotePago:n};
              onUpdate(u);setSelected(u);
            }
          }} style={{fontSize:11,color:"#00b4d8",background:"rgba(0,180,216,0.1)",
            border:"1px solid #00b4d844",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontWeight:600}}>
            ✏️ definir restantes
          </button>
        </div>
      </div>

      {/* Adicionar aula manual em qualquer data */}
      <div style={{marginBottom:8}}>
        {!showAdd
          ?<button onClick={()=>{setShowAdd(true);setDtAdd(todayStr());}}
            style={{width:"100%",padding:"8px",borderRadius:10,
              border:"1px dashed #0e2035",background:"transparent",
              color:"#4a7a9b",fontSize:12,cursor:"pointer"}}>
            + Registrar aula em data diferente
          </button>
          :<div style={{background:"#0a1628",border:"1px solid #00b4d8",borderRadius:12,padding:12,display:"flex",gap:8,alignItems:"center"}}>
            <input type="date" value={dtAdd} onChange={e=>setDtAdd(e.target.value)}
              style={{flex:1,background:"#060d18",border:"1px solid #0e2035",borderRadius:8,
                padding:"8px 10px",color:"#fff",fontSize:14,outline:"none"}}/>
            <button onClick={()=>{marcarAula(s,true,dtAdd);setShowAdd(false);}}
              style={{padding:"8px 14px",borderRadius:8,border:"none",
                background:"linear-gradient(135deg,#00c864,#00e5aa)",
                color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ Feita</button>
            <button onClick={()=>{marcarAula(s,false,dtAdd);setShowAdd(false);}}
              style={{padding:"8px 10px",borderRadius:8,border:"none",
                background:"rgba(239,68,68,0.15)",color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer"}}>✗ Faltou</button>
            <button onClick={()=>setShowAdd(false)}
              style={{padding:"6px 8px",borderRadius:8,border:"none",
                background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>✕</button>
          </div>}
      </div>

      {/* DASHBOARD: resumo de frequência */}
      {(()=>{
        const mesStr=mesAtual;
        const mesAulas=(s.aulas||[]).filter(a=>a.data&&a.data.startsWith(mesStr));
        const nFeitas=mesAulas.filter(a=>a.tipo==="feita"||(a.presente&&!a.tipo)).length;
        const nFalta=mesAulas.filter(a=>a.tipo==="falta").length;
        const nDesmarcou=mesAulas.filter(a=>a.tipo==="desmarcou").length;
        if(!nFeitas&&!nFalta&&!nDesmarcou) return null;
        return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
          {[
            {l:"Feitas",v:nFeitas,c:"#00c864",bg:"rgba(0,200,100,0.08)"},
            {l:"Faltou",v:nFalta,c:"#ef4444",bg:"rgba(239,68,68,0.08)"},
            {l:"Desmarcou",v:nDesmarcou,c:"#eab308",bg:"rgba(234,179,8,0.08)"},
          ].map(({l,v,c,bg})=>(
            <div key={l} style={{background:bg,borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#4a7a9b",marginBottom:2}}>{l}</div>
              <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
            </div>
          ))}
        </div>;
      })()}

      {/* LISTA DE AULAS */}
      {(()=>{
        const agora=new Date();
        const ano=agora.getFullYear(),mes2=agora.getMonth();
        const hojeStr=agora.toISOString().slice(0,10);
        const diasConf=s.diasSemana||[];
        const diasLista=[];
        for(let dt=new Date(ano,mes2,1);dt.toISOString().slice(0,10)<=hojeStr;dt.setDate(dt.getDate()+1)){
          const dStr=dt.toISOString().slice(0,10);
          if(!diasConf.length||diasConf.includes(dt.getDay())) diasLista.push(dStr);
        }
        if(!diasLista.length) return null;
        const aulasArr2=s.aulas||[];
        const semAno=diasLista.filter(d=>!aulasArr2.find(a=>a.data===d));
        const marcarTodas2=()=>{
          const novas=[...aulasArr2.filter(a=>!diasLista.includes(a.data))];
          diasLista.forEach(d=>novas.push({id:uid(),data:d,tipo:"feita",presente:true}));
          const u={...s,aulas:novas};onUpdate(u);setSelected(u);
        };
        let nAulaCount=0; // contador sequencial de feitas
        return <div style={{background:"#0a1628",borderRadius:14,padding:12,border:"1px solid #0e2035",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:10,color:"#4a7a9b",letterSpacing:1}}>{mesNome.toUpperCase()}</div>
            {semAno.length>0&&<button onClick={marcarTodas2}
              style={{fontSize:11,padding:"4px 10px",borderRadius:8,border:"none",
                background:"rgba(0,200,100,0.15)",color:"#00c864",cursor:"pointer",fontWeight:700}}>
              ✓ Marcar todas
            </button>}
          </div>
          {diasLista.map((dStr,idx2)=>{
            const aulaItem=aulasArr2.find(a=>a.data===dStr);
            const tipoItem=aulaItem?.tipo||(aulaItem?.presente?"feita":aulaItem?"falta":null);
            if(tipoItem==="feita") nAulaCount++;
            const numDisplay=tipoItem==="feita"?nAulaCount:tipoItem==="falta"?"✗":tipoItem==="desmarcou"?"⚠":"·";
            const cor=tipoItem==="feita"?"#00c864":tipoItem==="falta"?"#ef4444":tipoItem==="desmarcou"?"#eab308":"#2a5a7a";
            const bg=tipoItem==="feita"?"rgba(0,200,100,0.15)":tipoItem==="falta"?"rgba(239,68,68,0.12)":tipoItem==="desmarcou"?"rgba(234,179,8,0.12)":"#060d18";
            const dObj=new Date(dStr+"T12:00");
            const lbl=dObj.toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"});
            return <div key={dStr} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",
              borderTop:idx2>0?"1px solid #0a1e30":"none"}}>
              <div style={{width:26,height:26,borderRadius:7,flexShrink:0,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,
                background:bg,color:cor,border:"1px solid "+cor+"33"}}>
                {numDisplay}
              </div>
              <span style={{flex:1,fontSize:15,fontWeight:600,color:tipoItem?"#fff":"#7a9ab9"}}>{lbl}</span>
              <button onClick={()=>marcarAula(s,proximoTipo(tipoItem),dStr)}
                style={{minWidth:84,height:36,borderRadius:9,border:"none",cursor:"pointer",
                  fontSize:13,fontWeight:700,padding:"0 12px",
                  background:tipoItem==="feita"?"linear-gradient(135deg,#00c864,#00e5aa)":
                             tipoItem==="falta"?"rgba(239,68,68,0.25)":
                             tipoItem==="desmarcou"?"rgba(234,179,8,0.25)":"rgba(255,255,255,0.06)",
                  color:tipoItem==="feita"?"#000":tipoItem==="falta"?"#ef4444":
                        tipoItem==="desmarcou"?"#eab308":"#4a7a9b"}}>
                {tipoItem==="feita"?"✓ Veio":tipoItem==="falta"?"✗ Faltou":tipoItem==="desmarcou"?"⚠ Cancelou":"Marcar"}
              </button>
            </div>;
          })}
        </div>;
      })()}

            {/* ADICIONAR AULA EM DATA DIFERENTE */}
      <div style={{marginBottom:8}}>
        {!showAdd
          ?<button onClick={()=>{setShowAdd(true);setDtAdd(todayStr());}}
            style={{width:"100%",padding:"7px",borderRadius:10,border:"1px dashed #0e2035",
              background:"transparent",color:"#4a7a9b",fontSize:12,cursor:"pointer"}}>
            + Registrar aula em outra data
          </button>
          :<div style={{background:"#0a1628",border:"1px solid #00b4d8",borderRadius:12,padding:10,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <input type="date" value={dtAdd} onChange={e=>setDtAdd(e.target.value)}
              style={{flex:1,minWidth:120,background:"#060d18",border:"1px solid #0e2035",borderRadius:8,
                padding:"8px",color:"#fff",fontSize:14,outline:"none"}}/>
            {[{t:"feita",l:"✓ Feita",c:"#00c864"},{t:"falta",l:"✗ Faltou",c:"#ef4444"},{t:"desmarcou",l:"⚠ Desmarcou",c:"#eab308"}].map(({t,l,c})=>(
              <button key={t} onClick={()=>{marcarAula(s,t,dtAdd);setShowAdd(false);}}
                style={{padding:"7px 10px",borderRadius:8,border:"none",background:c+"22",
                  color:c,fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>
            ))}
            <button onClick={()=>setShowAdd(false)}
              style={{padding:"7px",borderRadius:8,border:"none",background:"transparent",color:"#4a7a9b",cursor:"pointer"}}>✕</button>
          </div>}
      </div>

            <CobrancaBlock s={s} dadas={dadas} mesAtual={mesAtual} onUpdate={onUpdate} setSelected={setSelected} meuPix={meuPix} sessions={sessions}/>

      {(s.pagamentos||[]).length>0&&<div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14}}>
        <div style={{fontSize:10,color:"#4a7a9b",letterSpacing:1,marginBottom:10}}>HISTÓRICO DE PAGAMENTOS</div>
        {[...(s.pagamentos||[])].sort((a,b)=>b.data.localeCompare(a.data)).map(p=>(
          <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #0a1e30"}}>
            <div><div style={{fontSize:13,fontWeight:600}}>{fmtDate(p.data)}</div><div style={{fontSize:11,color:"#4a7a9b"}}>{p.aulas} aulas</div></div>
            <div style={{fontSize:15,fontWeight:800,color:"#00c864"}}>R$ {p.valor||"—"}</div>
          </div>
        ))}
      </div>}
      {confirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#0a1628",borderRadius:20,padding:24,maxWidth:320,width:"100%",border:"1px solid #0e2035"}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Apagar aluno?</div>
          <div style={{fontSize:13,color:"#4a7a9b",marginBottom:20}}>Todos os dados serão apagados.</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setConfirm(null)} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#aaa",cursor:"pointer"}}>Cancelar</button>
            <button onClick={()=>{onDelete(confirm);setScreen("list");setConfirm(null);}} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"#ef4444",color:"#fff",fontWeight:700,cursor:"pointer"}}>Apagar</button>
          </div>
        </div>
      </div>}
      <div style={{height:1,background:"#0a1e30",margin:"20px 0"}}/>
      <button onClick={()=>setConfirm(s.id)} style={{width:"100%",padding:"10px",borderRadius:12,border:"1px solid #3a1a1a",background:"transparent",color:"#ef4444",fontSize:12,cursor:"pointer",opacity:0.6}}>🗑 Apagar aluno</button>
    </div>;
  }

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div><div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase"}}>Meus Alunos</div><div style={{fontSize:12,color:"#2a5a7a"}}>{mesNome}</div></div>
      <button onClick={()=>setScreen("form-new")} style={{padding:"9px 16px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:14}}>+ Aluno</button>
    </div>
    {students.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#2a5a7a"}}><div style={{fontSize:48,marginBottom:10}}>👥</div><div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Nenhum aluno ainda</div><div style={{fontSize:13}}>Toque em "+ Aluno" para começar</div></div>}
    {students.map(s=>{
      const dadas=aulasDadas(s),faltas=faltasDoMes(s),total=totalMes(s),cred=creditosMes(s);
      const pacotePago2=parseInt(s.pacotePago)||parseInt(s.creditos)||0;
      const totalList=pacotePago2>0?pacotePago2:Math.max(dadas,total);
      const pct=Math.min((dadas/Math.max(totalList,1))*100,100);
      const completo=pacotePago2>0&&dadas>=pacotePago2;
      const bColor=completo?"#00c864":faltas>0?"#ef4444":"#0e2035";
      return <div key={s.id} onClick={()=>{setSelected(s);setScreen("detail");}} style={{background:"#0a1628",border:`1px solid ${bColor}`,borderRadius:16,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:12,background:`${bColor}22`,border:`1px solid ${bColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:bColor,flexShrink:0}}>{s.nome.charAt(0).toUpperCase()}</div>
            <div><div style={{fontSize:19,fontWeight:800}}>{s.nome}</div><div style={{fontSize:12,color:"#4a7a9b"}}>R${s.valorAula||"—"}/aula</div></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:900,color:completo?"#00c864":"#fff"}}>{dadas}<span style={{fontSize:12,color:"#4a7a9b",fontWeight:400}}>/{total}</span></div>
            {completo&&<div style={{fontSize:10,color:"#00c864",fontWeight:700}}>COBRAR 💰</div>}
            {faltas>0&&!completo&&<div style={{fontSize:10,color:"#ef4444"}}>{faltas} falta{faltas>1?"s":""}</div>}
          </div>
        </div>
        <div style={{height:5,background:"#0e2035",borderRadius:3,overflow:"hidden",marginTop:10}}>
          <div style={{height:"100%",width:`${pct}%`,borderRadius:3,background:completo?"linear-gradient(90deg,#00c864,#00e5aa)":faltas>0?"linear-gradient(90deg,#ef4444,#f87171)":"linear-gradient(90deg,#00b4d8,#00e5ff)"}}/>
        </div>
      </div>;
    })}
    {confirm&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#0a1628",borderRadius:20,padding:24,maxWidth:320,width:"100%",border:"1px solid #0e2035"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Apagar aluno?</div>
        <div style={{fontSize:13,color:"#4a7a9b",marginBottom:20}}>Todos os dados serão apagados.</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setConfirm(null)} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#aaa",cursor:"pointer"}}>Cancelar</button>
          <button onClick={()=>{onDelete(confirm);setConfirm(null);}} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"#ef4444",color:"#fff",fontWeight:700,cursor:"pointer"}}>Apagar</button>
        </div>
      </div>
    </div>}
  </div>;
}

// ── FINANCEIRO VIEW ───────────────────────────────────────────────────────────
// FINANCEIRO - receitas (pagamentos), despesas manuais, potencial a receber
// ═══════════════════════════════════════════════════
// SEÇÃO 14: ABA FINANCEIRO (R$)
// Receitas: soma pagamentos dos alunos por mês
// Despesas: registro manual de gastos
// Potencial: total de aulas previstas × valor/aula
// ═══════════════════════════════════════════════════
