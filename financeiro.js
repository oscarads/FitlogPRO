function FinanceiroView({students,onUpdate}){
  const now=new Date();
  const [mesSel,setMesSel]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [addDespesa,setAddDespesa]=useState(false);
  const [despesas,setDespesas]=useState(()=>ll("fl_despesas",[]));
  const [formD,setFormD]=useState({descricao:"",valor:"",data:todayStr(),categoria:"outro"});

  // saveDespesas: atualiza o estado local, o cache (localStorage) e envia pro Google Sheets.
  // Repara que ls() e gsSave() já salvam no localStorage — o ls() aqui é redundante com o
  // que gsSave() já faz internamente, mas não causa bug, só uma escrita a mais.
  const saveDespesas=d=>{setDespesas(d);ls("fl_despesas",d);gsSave("despesas",d);};

  const CATS=[
    {id:"aluguel",label:"Aluguel",emoji:"🏠",color:"#ef4444"},
    {id:"equipamento",label:"Equipamento",emoji:"🏋️",color:"#f97316"},
    {id:"marketing",label:"Marketing",emoji:"📣",color:"#eab308"},
    {id:"transporte",label:"Transporte",emoji:"🚗",color:"#84cc16"},
    {id:"alimentacao",label:"Alimentação",emoji:"🥗",color:"#14b8a6"},
    {id:"curso",label:"Cursos",emoji:"📚",color:"#8b5cf6"},
    {id:"outro",label:"Outro",emoji:"📌",color:"#4a7a9b"},
  ];

  // Aulas cobráveis do mês: feitas + falta (ambas cobram)
  const aulasCobraveisDoMes=students.flatMap(s=>{
    const vAula=parseFloat(s.valorAula)||0;
    if(!vAula) return [];
    return (s.aulas||[])
      .filter(a=>a.data&&a.data.startsWith(mesSel)&&(a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo)))
      .map(a=>({
        id:a.id||uid(),
        data:a.data,
        aluno:s.nome,
        tipo:a.tipo||"feita",
        valor:vAula,
        whatsapp:s.whatsapp,
      }));
  }).sort((a,b)=>b.data.localeCompare(a.data));

  const totalAulasCobraveis=aulasCobraveisDoMes.reduce((acc,a)=>acc+a.valor,0);

  // receitas do mês = pagamentos registrados
  const receitasMes=students.flatMap(s=>
    (s.pagamentos||[]).filter(p=>p.mes===mesSel||p.data?.startsWith(mesSel))
      .map(p=>({...p,aluno:s.nome}))
  ).sort((a,b)=>b.data.localeCompare(a.data));

  const despesasMes=despesas.filter(d=>d.data.startsWith(mesSel)).sort((a,b)=>b.data.localeCompare(a.data));

  const totalReceitas=receitasMes.reduce((a,p)=>a+(parseFloat(p.valor)||0),0);
  const totalDespesas=despesasMes.reduce((a,d)=>a+(parseFloat(d.valor)||0),0);
  const lucro=totalReceitas-totalDespesas;

  // Potencial: soma dos valores de todos os alunos ativos (ainda não pagaram este mês)
  const potencial=students.reduce((a,s)=>{
    const jaPagou=(s.pagamentos||[]).some(p=>p.mes===mesSel||p.data?.startsWith(mesSel));
    return jaPagou?a:a+(parseFloat(s.valor)||0);
  },0);

  // gera lista dos últimos 6 meses para o seletor
  const meses=Array.from({length:6},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    return{val:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,label:`${MONTHS[d.getMonth()]} ${d.getFullYear()}`};
  });

  // alunos inadimplentes (completaram pacote mas não pagaram este mês)
  // ✅ CORRIGIDO (s.pacote): trocado por s.pacotePago (campo real do aluno)
  const inadimplentes=students.filter(s=>{
    const dadas=(s.aulas||[]).filter(a=>a.data.startsWith(mesSel)&&a.presente).length;
    const pagou=(s.pagamentos||[]).some(p=>p.mes===mesSel||p.data?.startsWith(mesSel));
    return dadas>=(s.pacotePago||8)&&!pagou;
  });

  // despesas por categoria
  const porCat=CATS.map(c=>({
    ...c,total:despesasMes.filter(d=>d.categoria===c.id).reduce((a,d)=>a+(parseFloat(d.valor)||0),0)
  })).filter(c=>c.total>0);

  return <div>
    <div style={{fontSize:11,color:"#4a7a9b",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Financeiro</div>

    {/* seletor de mês */}
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:16,scrollbarWidth:"none"}}>
      {meses.map(m=><button key={m.val} onClick={()=>setMesSel(m.val)} style={{flex:"0 0 auto",padding:"7px 14px",borderRadius:20,border:`1px solid ${mesSel===m.val?"#00e5ff":"#0e2035"}`,background:mesSel===m.val?"rgba(0,229,255,0.1)":"transparent",color:mesSel===m.val?"#00e5ff":"#4a7a9b",fontSize:13,fontWeight:mesSel===m.val?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>{m.label}</button>)}
    </div>

    {/* cards resumo */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
      {/* Aulas cobráveis do mês */}
      {aulasCobraveisDoMes.length>0&&<div style={{background:"rgba(234,179,8,0.06)",border:"1px solid #eab30833",borderRadius:14,padding:"12px 14px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:11,color:"#eab308",fontWeight:700,letterSpacing:1}}>⚡ AULAS NO MÊS</div>
            <div style={{fontSize:11,color:"#4a7a9b",marginTop:2}}>{aulasCobraveisDoMes.length} aulas · cobrável R${totalAulasCobraveis}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:20,fontWeight:900,color:"#eab308"}}>R${totalAulasCobraveis}</div>
            <div style={{fontSize:10,color:totalReceitas>=totalAulasCobraveis?"#00c864":"#f97316"}}>
              {totalReceitas>=totalAulasCobraveis?"✓ quitado":"R$"+(totalAulasCobraveis-totalReceitas)+" pendente"}
            </div>
          </div>
        </div>
        {/* Lista por aluno */}
        {Object.entries(aulasCobraveisDoMes.reduce((acc,a)=>{
          if(!acc[a.aluno]) acc[a.aluno]={nome:a.aluno,count:0,total:0,tipos:{feita:0,falta:0}};
          acc[a.aluno].count++;
          acc[a.aluno].total+=a.valor;
          acc[a.aluno].tipos[a.tipo]=(acc[a.aluno].tipos[a.tipo]||0)+1;
          return acc;
        },{})).map(([nome,info])=>(
          <div key={nome} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"6px 0",borderTop:"1px solid #0e2035"}}>
            <div>
              <span style={{fontSize:13,color:"#fff",fontWeight:600}}>{nome}</span>
              <span style={{fontSize:11,color:"#4a7a9b",marginLeft:8}}>
                {info.count} aulas
                {info.tipos.falta>0&&<span style={{color:"#ef4444"}}> · {info.tipos.falta} falta</span>}
              </span>
            </div>
            <span style={{fontSize:14,fontWeight:700,color:"#eab308"}}>R${info.total}</span>
          </div>
        ))}
      </div>}

      {[
        {label:"Recebido",value:totalReceitas,color:"#00c864",bg:"rgba(0,200,100,0.08)",border:"rgba(0,200,100,0.2)"},
        {label:"Despesas",value:totalDespesas,color:"#ef4444",bg:"rgba(239,68,68,0.08)",border:"rgba(239,68,68,0.2)"},
        {label:"Lucro",value:lucro,color:lucro>=0?"#00e5ff":"#f87171",bg:lucro>=0?"rgba(0,229,255,0.08)":"rgba(239,68,68,0.08)",border:lucro>=0?"rgba(0,229,255,0.2)":"rgba(239,68,68,0.2)"},
      ].map(c=><div key={c.label} style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:14,padding:"12px 10px",textAlign:"center"}}>
        <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>{c.label}</div>
        <div style={{fontSize:16,fontWeight:800,color:c.color}}>R${Math.round(c.value)}</div>
      </div>)}
      {potencial>0&&<div style={{background:"rgba(234,179,8,0.07)",border:"1px solid #eab30833",borderRadius:14,padding:"12px 10px",textAlign:"center",gridColumn:"1/-1"}}>
        <div style={{fontSize:10,color:"#eab308",marginBottom:2}}>A RECEBER (alunos sem pagamento este mês)</div>
        <div style={{fontSize:20,fontWeight:800,color:"#eab308"}}>R$ {Math.round(potencial)}</div>
        <div style={{fontSize:11,color:"#2a5a7a",marginTop:2}}>Registre o pagamento na aba Alunos para mover para Recebido</div>
      </div>}
    </div>

    {/* inadimplentes */}
    {inadimplentes.length>0&&<div style={{background:"rgba(234,179,8,0.07)",border:"1px solid #eab30833",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
      <div style={{fontSize:12,color:"#eab308",fontWeight:700,marginBottom:8}}>⚠️ Aguardando pagamento</div>
      {inadimplentes.map(s=><div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #1a2a1a"}}>
        <span style={{fontSize:13,fontWeight:600}}>{s.nome}</span>
        <span style={{fontSize:14,fontWeight:800,color:"#eab308"}}>R$ {s.valor||"—"}</span>
      </div>)}
    </div>}

    {/* receitas */}
    <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:12}}>
      <div style={{fontSize:12,color:"#00c864",fontWeight:700,marginBottom:10}}>💰 Receitas — R$ {Math.round(totalReceitas)}</div>
      {receitasMes.length===0&&<div style={{fontSize:13,color:"#2a5a7a",textAlign:"center",padding:"12px 0"}}>Nenhuma receita registrada</div>}
      {receitasMes.map(p=><div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #0a1e30"}}>
        <div>
          <div style={{fontSize:13,fontWeight:600}}>{p.aluno}</div>
          <div style={{fontSize:11,color:"#4a7a9b"}}>{fmtDate(p.data)} · {p.aulas} aulas</div>
        </div>
        <div style={{fontSize:15,fontWeight:800,color:"#00c864"}}>R$ {p.valor||"—"}</div>
      </div>)}
    </div>

    {/* despesas */}
    <div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,color:"#ef4444",fontWeight:700}}>💸 Despesas — R$ {Math.round(totalDespesas)}</div>
        <button onClick={()=>setAddDespesa(!addDespesa)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"rgba(239,68,68,0.15)",color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Adicionar</button>
      </div>

      {addDespesa&&<div style={{background:"#060d18",borderRadius:12,padding:14,marginBottom:12,border:"1px solid #0e2035"}}>
        <input value={formD.descricao} onChange={e=>setFormD(f=>({...f,descricao:e.target.value}))} placeholder="Descrição"
          style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:14,outline:"none",marginBottom:8}}/>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>VALOR (R$)</div>
            <input type="number" value={formD.valor} onChange={e=>setFormD(f=>({...f,valor:e.target.value}))}
              style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:10,padding:"10px 6px",color:"#fff",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"#4a7a9b",marginBottom:4}}>DATA</div>
            <input type="date" value={formD.data} onChange={e=>setFormD(f=>({...f,data:e.target.value}))}
              style={{width:"100%",background:"#0a1628",border:"1px solid #0e2035",borderRadius:10,padding:"10px 6px",color:"#fff",fontSize:13,outline:"none"}}/>
          </div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
          {CATS.map(c=><button key={c.id} onClick={()=>setFormD(f=>({...f,categoria:c.id}))} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${formD.categoria===c.id?c.color:"#0e2035"}`,background:formD.categoria===c.id?c.color+"22":"transparent",color:formD.categoria===c.id?c.color:"#2a5a7a",fontSize:11,cursor:"pointer"}}>{c.emoji} {c.label}</button>)}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setAddDespesa(false)} style={{flex:1,padding:10,borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:13}}>Cancelar</button>
          <button onClick={()=>{
            if(!formD.descricao||!formD.valor)return;
            saveDespesas([...despesas,{...formD,id:uid(),valor:parseFloat(formD.valor)}]);
            setFormD({descricao:"",valor:"",data:todayStr(),categoria:"outro"});
            setAddDespesa(false);
          }} style={{flex:2,padding:10,borderRadius:10,border:"none",background:"linear-gradient(135deg,#ef4444,#f87171)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>Salvar Despesa</button>
        </div>
      </div>}

      {despesasMes.length===0&&!addDespesa&&<div style={{fontSize:13,color:"#2a5a7a",textAlign:"center",padding:"12px 0"}}>Nenhuma despesa registrada</div>}
      {despesasMes.map(d=>{
        const cat=CATS.find(c=>c.id===d.categoria)||CATS.at(-1);
        return <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #0a1e30"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>{cat.emoji}</span>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{d.descricao}</div>
              <div style={{fontSize:11,color:"#4a7a9b"}}>{fmtDate(d.data)} · {cat.label}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:15,fontWeight:800,color:"#ef4444"}}>R$ {d.valor}</div>
            <button onClick={()=>saveDespesas(despesas.filter(x=>x.id!==d.id))} style={{background:"none",border:"none",color:"#2a3a4a",cursor:"pointer",fontSize:16}}>×</button>
          </div>
        </div>;
      })}
    </div>

    {/* gráfico por categoria */}
    {porCat.length>0&&<div style={{background:"#0a1628",border:"1px solid #0e2035",borderRadius:16,padding:14}}>
      <div style={{fontSize:12,color:"#4a7a9b",marginBottom:12}}>Despesas por categoria</div>
      {porCat.map(c=><div key={c.id} style={{marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:12,color:c.color}}>{c.emoji} {c.label}</span>
          <span style={{fontSize:12,color:"#aaa"}}>R$ {c.total}</span>
        </div>
        <div style={{height:6,background:"#0e2035",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${(c.total/totalDespesas)*100}%`,background:c.color,borderRadius:3,transition:"width 0.5s"}}/>
        </div>
      </div>)}
    </div>}
  </div>;
}

// ── CÁLCULO DE PACOTE REAL ───────────────────────────────────────────────────
// Conta exatamente quantas vezes cada dia da semana aparece no mês/período
// diasSemana: array de ints 0-6 (0=dom,1=seg,...,6=sab)
// se fromToday=true, conta apenas a partir de hoje
// ═══════════════════════════════════════════════════
// SEÇÃO 4: FUNÇÕES UTILITÁRIAS
// - calcPacoteReal: calcula aulas num mês pelos diasSemana
// - detectMuscle: detecta grupo muscular pelo nome do exercício
// - uid, todayStr, dateStr, addDays, fmtDate, fmtFull: helpers
// ═══════════════════════════════════════════════════
function calcPacoteReal(ano, mes, diasSemana, fromToday=false){
  const start=fromToday?new Date():new Date(ano,mes-1,1);
  start.setHours(0,0,0,0);
  const end=new Date(ano,mes,0); // último dia do mês
  end.setHours(23,59,59,0);
  let count=0;
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    if(diasSemana.includes(d.getDay())) count++;
  }
  return count;
}

// Próximo mês
function calcPacoteProxMes(diasSemana){
  const now=new Date();
  const ano=now.getMonth()===11?now.getFullYear()+1:now.getFullYear();
  const mes=now.getMonth()===11?1:now.getMonth()+2;
  return calcPacoteReal(ano,mes,diasSemana,false);
}

// ── MEU DIA VIEW ──────────────────────────────────────────────────────────────
// MEU DIA - tarefas com prioridade, habitos com streak, metas mensais
