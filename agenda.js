function parseEvTitle(title){
  const t=title.trim();
  // ✅ CORRIGIDO: "Rafael 15/20" agora extrai numAula=15 E totalAula=20 (mFrac[3]).
  // Antes o totalAula vinha sempre null (código morto) — troquei "totalAula:null" por
  // "totalAula:parseInt(mFrac[3])" pra pegar o segundo número do formato X/Y.
  const mFrac=t.match(/^(.+?)\s+(\d+)[\/\\](\d+)(\s+.*)?$/);
  if(mFrac)return{nome:mFrac[1].trim(),numAula:parseInt(mFrac[2]),totalAula:parseInt(mFrac[3])};
  // "Rafael 15" → numAula=15 (sem formato X/Y, não dá pra saber o total do pacote)
  const m=t.match(/^(.+?)\s+(\d+)(\s+.*)?$/);
  if(m)return{nome:m[1].trim(),numAula:parseInt(m[2]),totalAula:null};
  return{nome:t,numAula:null,totalAula:null};
}

// ═══════════════════════════════════════════════════
// SEÇÃO 13: ABA AGENDA (📅)
// Integração com Google Calendar via API
// Modo "Hoje": mostra eventos do dia
// Modo "Semana": mostra semana com eventos por hora
// EventCard: cada evento de aluno tem botões ✓ e ✗
// Horários Livres: slots sem evento na janela 6h-11h
// parseEvTitle: lê "Rafael 5/8" → {numAula:5, totalAula:8} (corrigido em 07/2026)
// ═══════════════════════════════════════════════════
function AgendaView({students,onUpdate,gsUrl}){
  const now=new Date();
  const dateStr=d=>d.toISOString().slice(0,10);
  const addDays=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};
  const getWeekStart=(off=0)=>{const d=new Date();d.setDate(d.getDate()-d.getDay()+1+(off*7));d.setHours(0,0,0,0);return d;};

  const [viewMode,setViewMode]=useState("hoje");
  const [weekOffset,setWeekOffset]=useState(0);
  const [events,setEvents]=useState([]);
  const [loading,setLoading]=useState(false);
  const [calError,setCalError]=useState("");
  const [cmd,setCmd]=useState("");
  const [cmdFeedback,setCmdFeedback]=useState("");
  const [showRelatorio,setShowRelatorio]=useState(false);

  const weekStart=getWeekStart(weekOffset);
  const weekDays=Array.from({length:7},(_,i)=>addDays(weekStart,i));
  const todayDs=dateStr(now);
  const mesAtual=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const fetchEvents=useCallback(async()=>{
    setLoading(true);setCalError("");
    // "mensal" busca de hoje até o fim do mês que vem (janela maior, pra dar pra prever a
    // contagem do resto deste mês + o mês seguinte inteiro)
    const fimMesQueVem=new Date(now.getFullYear(),now.getMonth()+2,0); // dia 0 do mês+2 = último dia do mês+1
    const start=viewMode==="hoje"?todayDs:viewMode==="mensal"?todayDs:dateStr(weekStart);
    const end=viewMode==="hoje"?todayDs:viewMode==="mensal"?dateStr(fimMesQueVem):dateStr(addDays(weekStart,6));
    try{
      const r=await fetch(`${gsUrl}?action=calendar&start=${start}&end=${end}`);
      const j=await r.json();
      if(j.ok)setEvents(j.events||[]);
      else setCalError("Erro: "+j.error);
    }catch{
      setCalError("Não foi possível conectar.\n\nSolução: Apps Script → Executar → Autorizar acesso ao Google Agenda → volte e toque ↻");
    }
    setLoading(false);
  },[viewMode,weekOffset,gsUrl]);

  useEffect(()=>{fetchEvents();},[fetchEvents]);

  // Encontra aluno pelo primeiro nome — "Rafael 8" → busca "Rafael"
  const findStudent=title=>{
    const{nome}=parseEvTitle(title);
    const first=nome.split(" ")[0].toLowerCase();
    return students.find(s=>s.nome.toLowerCase().startsWith(first));
  };

  const eventsOfDay=ds=>[...events]
    .filter(ev=>ev.start.slice(0,10)===ds)
    .sort((a,b)=>a.start.localeCompare(b.start));

  // ⚠️ NÃO USADA MAIS (desde a correção de 07/2026): o botão que chamava essa função foi
  // trocado pra usar marcarAulaAgenda (veja mais abaixo), pra unificar os dois botões de
  // check da agenda no mesmo sistema (feita/falta/desmarcou), já que essa função só entendia
  // presente=sim/não e não conversava com o outro botão. Deixei o código aqui só de histórico
  // — pode apagar com segurança se quiser, ou reaproveitar reconstruirHistorico() em outro lugar
  // (ela é útil pra preencher rápido um histórico grande de aulas passadas de uma vez).
  // toggleAula: chamado ao clicar ✓ num evento da agenda com o título "Nome N" (ex: "Rafael 17").
  // Se o título tem número (numAula), NÃO faz um simples toggle: reconstrói N sessões
  // retroativas a partir da data marcada (reconstruirHistorico), substituindo o histórico
  // automático desse período. Se o título não tem número, faz o toggle simples de sempre.
  const toggleAula=(student,ds,evTitle)=>{
    const aulas=student.aulas||[];
    const ex=aulas.find(a=>a.data===ds);
    const eraPresente=ex?.presente;
    const {numAula}=parseEvTitle(evTitle||"");

    // reconstruirHistorico: gera N datas passadas (incluindo dataMarcada) contando pra trás.
    // Se o aluno tem diasSemana configurados, só conta os dias certos da semana; senão,
    // conta qualquer dia de Segunda a Sábado (pula domingo).
    const reconstruirHistorico=(n,dataMarcada)=>{
      if(!n||n<=0) return [dataMarcada];
      const dias=student.diasSemana||[];
      const vezesSemanais=student.vezesSemanais||0;
      const sessoes=[];
      let dt=new Date(dataMarcada+"T12:00");
      let encontradas=0;
      if(dias.length>0){
        // Usa dias configurados
        while(encontradas<n&&sessoes.length<500){
          if(dias.includes(dt.getDay())){
            sessoes.unshift(dt.toISOString().slice(0,10));
            encontradas++;
          }
          dt.setDate(dt.getDate()-1);
        }
      } else {
        // Sem dias fixos: pega qualquer dia útil (seg-sex), N vezes
        // Pula finais de semana pois personal trainer raramente atende dom/sab
        while(encontradas<n&&sessoes.length<500){
          const dow=dt.getDay();
          if(dow>=1&&dow<=6){ // Seg a Sáb
            sessoes.unshift(dt.toISOString().slice(0,10));
            encontradas++;
          }
          dt.setDate(dt.getDate()-1);
        }
      }
      return sessoes;
    };

    let novas=[...aulas];
    if(numAula&&numAula>0&&!eraPresente){
      // Reconstrói EXATAMENTE N sessões — SUBSTITUI registros no período
      const datas=reconstruirHistorico(numAula,ds);
      // Remove registros automáticos anteriores no mesmo período (evita duplicatas)
      const maisAntiga=datas[0];
      novas=novas.filter(a=>a.data>ds||a.data<maisAntiga||a._manual);
      // Adiciona as N sessões reconstruídas
      datas.forEach(d=>{
        if(!novas.find(a=>a.data===d))
          novas.push({id:uid(),data:d,presente:true});
      });
    } else if(!numAula){
      // Toggle normal (sem número no título)
      if(!ex)              novas=[...aulas,{id:uid(),data:ds,presente:true,_manual:true}];
      else if(ex.presente) novas=[...aulas.filter(a=>a.data!==ds),{...ex,presente:false}];
      else                 novas=aulas.filter(a=>a.data!==ds);
    }

    // ✅ CORRIGIDO (2 partes):
    // 1) Antes o totalAula vinha sempre null (bug do parseEvTitle, já corrigido acima) — agora
    //    "if(totalAula&&totalAula>0) novoPacote=totalAula" realmente funciona.
    // 2) NOVO: além de pacotePago, agora recalculamos pacoteBase toda vez que o título tem um
    //    número (numAula). A ideia: o app conta "aulas feitas no ciclo atual" como
    //    (total de aulas de sempre − pacoteBase). Se você escreve "Nome 5/15" na agenda, o
    //    numAula (5) É a fonte da verdade de "quantas aulas desse pacote atual já foram feitas
    //    até esta data" — então recalculamos pacoteBase = (total de aulas até agora) − numAula,
    //    o que faz o contador bater com o título mesmo se o aluno começou um pacote novo do
    //    MESMO tamanho do anterior (ex: 15 → 15), caso em que não dava pra perceber a troca de
    //    ciclo só comparando totalAula com o pacotePago antigo.
    const {numAula:_nAula,totalAula}=parseEvTitle(evTitle||"");
    let novoPacote=parseInt(student.pacotePago)||0;
    let novoPacoteBase=parseInt(student.pacoteBase)||0;
    if(totalAula&&totalAula>0){
      novoPacote=totalAula;
      if(_nAula&&_nAula>0){
        const totalHistAfter=novas.filter(a=>a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo)).length;
        novoPacoteBase=Math.max(0,totalHistAfter-_nAula);
      }
    }
    // Atualiza contador interno
    const updatedStudent={...student,aulas:novas,pacotePago:novoPacote,pacoteBase:novoPacoteBase};
    onUpdate(updatedStudent);
  };

  // marcarAulaAgenda: registra o resultado de uma aula em uma data (ds) com 3 estados
  // possíveis: "feita" | "falta" | "desmarcou". tipo=false remove o registro daquele dia.
  // ✅ CORRIGIDO: agora recebe também evTitle (4º parâmetro) e sincroniza pacotePago/pacoteBase
  // a partir do "X/Y" do título — igual o toggleAula já fazia, só que ESTA função é a que os
  // dois botões de check (aba Hoje detalhada E grade compacta) agora chamam, então o pacote
  // atualiza não importa qual botão você usa.
  const marcarAulaAgenda=(student,tipo,ds,evTitle)=>{
    const tipoNorm=tipo===true?"feita":tipo===false?false:tipo;
    const novas=tipoNorm===false
      ?(student.aulas||[]).filter(a=>a.data!==ds)
      :[...(student.aulas||[]).filter(a=>a.data!==ds),
        {id:uid(),data:ds,tipo:tipoNorm,presente:tipoNorm==="feita"}];
    const {numAula,totalAula}=parseEvTitle(evTitle||"");
    let novoPacote=parseInt(student.pacotePago)||0;
    let novoPacoteBase=parseInt(student.pacoteBase)||0;
    if(totalAula&&totalAula>0){
      novoPacote=totalAula;
      // Só recalcula pacoteBase quando o clique deixa a aula em um estado que REALMENTE
      // consome o pacote (feita ou falta). Em "desmarcou" (cancelamento avisado) ou ao
      // limpar o estado, o pacoteBase fica como estava — assim cancelar uma aula não
      // "trava" o contador em 5 pra sempre, ele volta a refletir o que realmente aconteceu.
      if(numAula&&numAula>0&&(tipoNorm==="feita"||tipoNorm==="falta")){
        const totalHistAfter=novas.filter(a=>a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo)).length;
        novoPacoteBase=Math.max(0,totalHistAfter-numAula);
      }
    }
    const updated={...student,aulas:novas,pacotePago:novoPacote,pacoteBase:novoPacoteBase};
    onUpdate(updated);
  };
  // Cicla: vazio→feita→falta→desmarcou→vazio
  const cicloTipoAg={null:"feita",undefined:"feita","feita":"falta","falta":"desmarcou","desmarcou":null};
  const proximoTipo=t=>cicloTipoAg[t]===undefined?"feita":cicloTipoAg[t];
  const marcarFalta=(student,ds)=>marcarAulaAgenda(student,"falta",ds);

  // getHorariosLivres: dada uma data (ds), devolve os "buracos" (blocos livres de pelo
  // menos 1h) na janela [inicio,fim) — padrão 6h às 11h. Percorre os eventos do dia em
  // ordem e vai "avançando" o cursor `cur`; qualquer espaço entre `cur` e o próximo evento
  // vira um horário livre. Fins de semana (dow 0 ou 6) sempre retornam vazio.
  const getHorariosLivres=(ds,inicio=6,fim=11)=>{
    const dow=new Date(ds+"T12:00").getDay();
    if(dow===0||dow===6) return [];
    // Filtra e ordena eventos dentro da janela
    const evs=eventsOfDay(ds)
      .filter(ev=>new Date(ev.start).getHours()<fim && (new Date(ev.end).getHours()||new Date(ev.start).getHours()+1)>inicio)
      .sort((a,b)=>a.start.localeCompare(b.start));
    const livres=[];
    let cur=inicio;
    evs.forEach(ev=>{
      const h=Math.max(new Date(ev.start).getHours(),inicio);
      const hEnd=Math.min(new Date(ev.end).getHours()||(new Date(ev.start).getHours()+1),fim);
      if(h>cur) livres.push({de:cur,ate:h});
      cur=Math.max(cur,hEnd);
    });
    if(cur<fim) livres.push({de:cur,ate:fim});
    return livres.filter(l=>l.ate-l.de>=1);
  };

  // Relatório semanal de horários livres
  const relatorio=()=>{
    const linhas=[];
    weekDays.forEach(d=>{
      const ds=dateStr(d);
      const livres=getHorariosLivres(ds);
      if(livres.length>0){
        const dia=d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"short"});
        const slots=livres.map(l=>`${String(l.de).padStart(2,"0")}:00–${String(l.ate).padStart(2,"0")}:00`).join(", ");
        linhas.push(`${dia}: ${slots}`);
      }
    });
    return linhas.length>0?linhas.join("\n"):"Nenhum horário livre esta semana.";
  };

  // ── CARD DE EVENTO ─────────────────────────────────────────────────────────
  // EventCard: card de 1 evento da agenda. Se o título bate com um aluno cadastrado
  // (findStudent), mostra o botão de check e a barra de progresso "dadas/total aulas".
  // Senão, mostra só como evento genérico (ícone 📅, sem interação de aula).
  const EventCard=({ev,ds})=>{
    const s=findStudent(ev.title);
    const{nome,numAula}=parseEvTitle(ev.title);
    const aula=s?(s.aulas||[]).find(a=>a.data===ds):null;
    const status=!aula?"pendente":(aula.tipo||( aula.presente?"feita":"falta"));const aulaSt=aula;
    const hora=new Date(ev.start).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    const horaFim=new Date(ev.end).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    // ✅ CORRIGIDO: antes contava só aulas "presente" dentro do MÊS DO CALENDÁRIO atual
    // (mesAtual) + um campo solto "aulasAnteriores" que nunca era atualizado por nada — por
    // isso sempre mostrava um número baixo tipo "1", ignorando todo o histórico do pacote.
    // Agora usa a MESMA conta do resto do app: total de aulas feitas/faltadas de sempre,
    // menos pacoteBase (o que já foi "zerado" em ciclos/pacotes anteriores).
    const dadas=s?(s.aulas||[]).filter(a=>a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo)).length-(parseInt(s?.pacoteBase)||0):0;
    // Usa totalAula do título (ex: "15/17"→17) se disponível, senão pacote do aluno
    // ✅ Agora evTotal funciona de verdade (parseEvTitle corrigido). Continua priorizando
    // s.pacotePago quando ele existe — evTotal só é usado como fallback se pacotePago for 0.
    const{totalAula:evTotal}=parseEvTitle(ev.title);
    const total=parseInt(s?.pacotePago)||evTotal||8;
    const pct=Math.min((dadas/Math.max(total,1))*100,100);

    // cores por status
    const isAluno=!!s;
    const bgMap={feita:"rgba(0,200,100,0.09)",falta:"rgba(239,68,68,0.08)",pendente:isAluno?"#0a1628":"rgba(255,255,255,0.03)"};
    const borderMap={feita:"#00c86455",falta:"#ef444444",pendente:isAluno?"#1a3a5a":"#1a2030"};
    const accentColor=status==="feita"?"#00c864":status==="falta"?"#ef4444":"#4a9ebb";

    return <div style={{background:bgMap[status],border:`1px solid ${borderMap[status]}`,borderRadius:16,padding:"14px 16px",marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}>

        {/* botão check — só aparece para alunos cadastrados */}
        {isAluno?(()=>{
          const tipoEv=aulaSt?.tipo||(aulaSt?.presente&&!aulaSt?.tipo?"feita":null);
          const corEv=tipoEv==="feita"?"#00c864":tipoEv==="falta"?"#ef4444":tipoEv==="desmarcou"?"#eab308":"#4a7a9b";
          const txtEv=tipoEv==="feita"?"✓":tipoEv==="falta"?"✗":tipoEv==="desmarcou"?"⚠":"·";
          return <button onClick={()=>marcarAulaAgenda(s,proximoTipo(tipoEv),ds,ev.title)}
            title="Clique para mudar: vazio→feita→faltou→desmarcou"
            style={{width:36,height:54,borderRadius:10,border:"none",cursor:"pointer",
              fontSize:20,fontWeight:800,flexShrink:0,
              background:tipoEv?corEv+"22":"rgba(255,255,255,0.05)",
              color:corEv}}>
            {txtEv}
          </button>;
        })():
        <div style={{width:54,height:54,borderRadius:14,flexShrink:0,background:"rgba(255,255,255,0.04)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>
          📅
        </div>}

        <div style={{flex:1,minWidth:0}}>
          {/* nome e horário */}
          <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:3,flexWrap:"wrap"}}>
            <span style={{fontSize:18,fontWeight:800,color:isAluno?"#fff":"#aaa"}}>{ev.title}</span>
          </div>
          <div style={{fontSize:12,color:"#4a7a9b",marginBottom:isAluno?6:0}}>{hora}{horaFim&&horaFim!==hora?" – "+horaFim:""}</div>

          {/* progresso do mês — só alunos */}
          {isAluno&&<>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
              <span style={{fontSize:20,fontWeight:900,color:dadas>=parseInt(s?.pacotePago||total)?"#00c864":accentColor}}>{dadas}</span>
              <span style={{fontSize:13,color:"#4a7a9b"}}>/ {total} aulas</span>
              {numAula&&<span style={{fontSize:11,background:"rgba(0,200,100,0.1)",color:"#00c864",padding:"2px 8px",borderRadius:20}}>✓ {numAula} aulas na agenda</span>}
              {dadas>=total&&<span style={{fontSize:12,color:"#00c864",fontWeight:700}}>💰 cobrar!</span>}
            </div>
            <div style={{height:5,background:"#0e2035",borderRadius:3,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,borderRadius:3,transition:"width 0.4s",
                background:dadas>=total?"linear-gradient(90deg,#00c864,#00e5aa)":"linear-gradient(90deg,#00b4d8,#00e5ff)"}}/>
            </div>
          </>}
          {!isAluno&&<div style={{fontSize:11,color:"#2a4a5a"}}>Não cadastrado · só agenda</div>}
        </div>

        {/* botão falta — só alunos */}
        {isAluno&&(status!=="falta"?
          <button onClick={()=>marcarFalta(s,ds)}
            style={{width:42,height:42,borderRadius:11,border:"1px solid rgba(239,68,68,0.3)",
              background:"rgba(239,68,68,0.07)",cursor:"pointer",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✗</button>:
          <button onClick={()=>onUpdate({...s,aulas:(s.aulas||[]).filter(a=>a.data!==ds)})}
            style={{width:42,height:42,borderRadius:11,border:"1px solid #2a3a4a",
              background:"transparent",cursor:"pointer",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#4a7a9b"}}>↺</button>)}
      </div>

      {status==="feita"&&dadas>=total&&
        <div style={{marginTop:10,padding:"8px 12px",background:"rgba(0,200,100,0.1)",borderRadius:10,fontSize:13,color:"#00c864",fontWeight:700}}>
          🎉 Pacote completo! Hora de cobrar.
        </div>}
    </div>;
  };

  // ── SLOT LIVRE ─────────────────────────────────────────────────────────────
  const SlotLivre=({de,ate})=>
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",marginBottom:8,
      borderRadius:12,border:"1px dashed #1a3a2a",background:"rgba(0,200,100,0.04)"}}>
      <span style={{fontSize:16}}>🟢</span>
      <span style={{fontSize:13,color:"#2a6a4a",fontWeight:600}}>
        Livre {String(de).padStart(2,"0")}:00 – {String(ate).padStart(2,"0")}:00
      </span>
      <span style={{fontSize:11,color:"#1a4a3a",marginLeft:"auto"}}>{ate-de}h disponível</span>
    </div>;

  // ── DIA COMPLETO (lista de eventos + slots livres intercalados) ─────────────
  const DayView=({ds,showFree=true})=>{
    const dow=new Date(ds+"T12:00").getDay();
    const isWeekend=dow===0||dow===6;
    const INICIO=6,FIM=11; // janela de trabalho
    const evs=eventsOfDay(ds);
    const livres=showFree&&!isWeekend?getHorariosLivres(ds):[];

    // intercala eventos dentro da janela + slots livres
    const allItems=[];
    const eventosDentro=evs.filter(ev=>{
      const h=new Date(ev.start).getHours();
      return h>=INICIO&&h<=FIM;
    });
    const eventosForaDaJanela=evs.filter(ev=>{
      const h=new Date(ev.start).getHours();
      return h<INICIO||h>FIM;
    });
    const eventosPorHora={};
    eventosDentro.forEach(ev=>{const h=new Date(ev.start).getHours();(eventosPorHora[h]=eventosPorHora[h]||[]).push(ev);});

    let curH=INICIO;
    Object.keys(eventosPorHora).sort((a,b)=>+a-+b).forEach(h=>{
      const hN=parseInt(h);
      if(showFree&&!isWeekend&&hN>curH&&hN<FIM) allItems.push({type:"livre",de:curH,ate:hN});
      eventosPorHora[h].forEach(ev=>allItems.push({type:"evento",ev}));
      const endH=Math.min(new Date(eventosPorHora[h].at(-1)?.end||"").getHours()||hN+1,FIM);
      curH=Math.max(curH,endH);
    });
    if(showFree&&!isWeekend&&curH<FIM) allItems.push({type:"livre",de:curH,ate:FIM});

    // eventos fora da janela (Oscar 11h, eventos da tarde etc) — lista separada
    const temEventosFora=eventosForaDaJanela.length>0;

    if(evs.length===0) return <div>
      {!isWeekend&&showFree&&<SlotLivre de={INICIO} ate={FIM}/>}
      {isWeekend&&<div style={{textAlign:"center",padding:"20px 0",color:"#2a5a7a",fontSize:13}}>Sem atendimento no fim de semana</div>}
    </div>;

    return <div>
      {allItems.map((item,i)=>item.type==="evento"?
        <EventCard key={item.ev.id} ev={item.ev} ds={ds}/>:
        <SlotLivre key={"l"+i} de={item.de} ate={item.ate}/>
      )}
      {temEventosFora&&<div style={{marginTop:8}}>
        <div style={{fontSize:10,color:"#2a3a4a",letterSpacing:1,marginBottom:6,paddingLeft:2}}>FORA DA JANELA DE ATENDIMENTO</div>
        {eventosForaDaJanela.map(ev=><EventCard key={ev.id} ev={ev} ds={ds}/>)}
      </div>}
    </div>;
  };

  // ── VISÃO HOJE ─────────────────────────────────────────────────────────────
  const HojeView=()=>{
    const evs=eventsOfDay(todayDs);
    const alunosEvs=evs.filter(ev=>findStudent(ev.title));
    const feitas=alunosEvs.filter(ev=>{const s=findStudent(ev.title);return s&&(s.aulas||[]).find(a=>a.data===todayDs&&a.presente);}).length;
    const total=alunosEvs.length;
    return <div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:19,fontWeight:800}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}>
          <span style={{fontSize:14,color:feitas===total&&total>0?"#00c864":"#aaa",fontWeight:600}}>
            {feitas}/{total} alunos marcados
          </span>
          {feitas===total&&total>0&&<span style={{fontSize:13,color:"#00c864",fontWeight:700}}>✓ Dia completo!</span>}
        </div>
        {total>0&&<div style={{height:6,background:"#0e2035",borderRadius:3,overflow:"hidden",marginTop:8}}>
          <div style={{height:"100%",width:`${total>0?(feitas/total)*100:0}%`,
            background:"linear-gradient(90deg,#00b4d8,#00e5ff)",borderRadius:3,transition:"width 0.4s"}}/>
        </div>}
      </div>
      <DayView ds={todayDs} showFree={true}/>

    </div>;
  };

  // ── VISÃO SEMANA ──────────────────────────────────────────────────────────
  const SemanaView=()=><div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <button onClick={()=>setWeekOffset(w=>w-1)}
        style={{background:"none",border:"1px solid #0e2035",borderRadius:10,color:"#4a7a9b",padding:"10px 18px",cursor:"pointer",fontSize:18}}>‹</button>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:700}}>{dateStr(weekStart).slice(5).replace("-","/")} — {dateStr(addDays(weekStart,6)).slice(5).replace("-","/")}</div>
        <div style={{fontSize:11,color:"#4a7a9b"}}>{weekOffset===0?"Esta semana":weekOffset===1?"Próxima":weekOffset===-1?"Semana passada":""}</div>
      </div>
      <button onClick={()=>setWeekOffset(w=>w+1)}
        style={{background:"none",border:"1px solid #0e2035",borderRadius:10,color:"#4a7a9b",padding:"10px 18px",cursor:"pointer",fontSize:18}}>›</button>
    </div>
    {weekDays.map(d=>{
      const ds=dateStr(d);
      const evs=eventsOfDay(ds);
      const isToday=ds===todayDs;
      const alunosEvs=evs.filter(ev=>findStudent(ev.title));
      const feitas=alunosEvs.filter(ev=>{const s=findStudent(ev.title);return s&&(s.aulas||[]).find(a=>a.data===ds&&a.presente);}).length;
      const dow=d.getDay();
      const livres=dow===0||dow===6?[]:getHorariosLivres(ds);
      return <div key={ds} style={{marginBottom:6,borderBottom:"1px solid #0a1e30",paddingBottom:6}}>
        {/* cabeçalho do dia — clicável para expandir */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
          <div style={{width:46,height:46,borderRadius:12,flexShrink:0,
            background:isToday?"linear-gradient(135deg,#00b4d8,#00e5ff)":"#0a1628",
            border:`1px solid ${isToday?"transparent":"#0e2035"}`,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:10,color:isToday?"#000":"#4a7a9b",fontWeight:700}}>{DAYS[d.getDay()]}</span>
            <span style={{fontSize:17,fontWeight:900,color:isToday?"#000":"#fff",lineHeight:1}}>{d.getDate()}</span>
          </div>
          <div style={{flex:1}}>
            {evs.length===0?
              <span style={{fontSize:13,color:"#1a3a4a"}}>Dia livre</span>:
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {evs.map(ev=>{
                  const s=findStudent(ev.title);
                  const aula=s&&(s.aulas||[]).find(a=>a.data===ds);
                  const status=!aula?"pendente":(aula.tipo||( aula.presente?"feita":"falta"));const aulaSt=aula;
                  const hora=new Date(ev.start).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
                  const cl={feita:"#00c864",falta:"#ef4444",pendente:s?"#4a9ebb":"#2a3a4a"};
                  const ic={feita:"✓",falta:"✗",pendente:s?"·":"📅"};
                  // ✅ CORRIGIDO: antes chamava toggleAula (só entendia presente sim/não, sem
                  // falta/desmarcou, e não conversava com o botão da lista detalhada). Agora
                  // usa marcarAulaAgenda com o mesmo ciclo vazio→feita→falta→desmarcou do
                  // outro botão, então os dois ficam sempre sincronizados.
                  const tipoEvGrade=aulaSt?.tipo||(aulaSt?.presente&&!aulaSt?.tipo?"feita":null);
                  return <button key={ev.id}
                    onClick={()=>s&&marcarAulaAgenda(s,proximoTipo(tipoEvGrade),ds,ev.title)}
                    style={{display:"inline-flex",alignItems:"center",gap:5,padding:"7px 12px",
                      borderRadius:12,border:`1px solid ${cl[status]}44`,background:`${cl[status]}15`,
                      cursor:s?"pointer":"default",minWidth:0}}>
                    <span style={{fontSize:15,fontWeight:700,color:cl[status]}}>{ic[status]}</span>
                    <span style={{fontSize:17,fontWeight:700,color:"#fff"}}>{parseEvTitle(ev.title).nome}</span>
                    <span style={{fontSize:11,color:"#4a7a9b"}}>{hora}</span>
                  </button>;
                })}
              </div>
            }
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            {alunosEvs.length>0&&<div style={{fontSize:14,fontWeight:800,color:feitas===alunosEvs.length?"#00c864":"#fff"}}>{feitas}/{alunosEvs.length}</div>}
            {livres.length>0&&<div style={{fontSize:10,color:"#2a6a4a"}}>🟢 {livres.length} livre{livres.length>1?"s":""}</div>}
          </div>
        </div>
        {/* expandido somente para hoje */}
        {isToday&&evs.length>0&&<div style={{marginLeft:56,marginTop:4}}>
          <DayView ds={ds} showFree={true}/>
        </div>}
      </div>;
    })}
  </div>;

  // ── PREVISÃO MENSAL (📅 Mensal) ────────────────────────────────────────────
  // Ideia: NUNCA grava número no evento do Google Agenda. Em vez disso, toda vez que essa
  // tela abre, ela: 1) pega quantas aulas do pacote ATUAL cada aluno já tem contabilizadas
  // (mesma conta usada em EventCard/aulasDadas: total feita+falta menos pacoteBase — ou
  // seja, já reflete tudo que você marcou até agora, em qualquer aba); 2) pega TODOS os
  // eventos da agenda que baterem com aquele aluno, em ordem cronológica, dali pra frente;
  // 3) vai contando +1 a cada evento, voltando pra 1 quando bater o tamanho do pacote
  // (pacotePago). Como isso é recalculado do zero a cada abertura da tela, se você excluir
  // ou mover um evento no Google Agenda, a numeração dos que vêm depois muda sozinha —
  // não precisa reescrever nada manualmente.
  const dadasAtualDe=s=>(s.aulas||[]).filter(a=>a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo)).length-(parseInt(s?.pacoteBase)||0);

  const eventosComPrevisao=(()=>{
    // pega só eventos de hoje em diante (o passado já está registrado nas abas Hoje/Semana)
    const futuros=[...events].filter(ev=>ev.start.slice(0,10)>=todayDs).sort((a,b)=>a.start.localeCompare(b.start));
    const contadores={}; // id do aluno -> contador corrente (começa em dadasAtual)
    return futuros.map(ev=>{
      const s=findStudent(ev.title);
      if(!s)return{...ev,aluno:null};
      if(!(s.id in contadores))contadores[s.id]=dadasAtualDe(s);
      const pacote=parseInt(s.pacotePago)||8;
      contadores[s.id]=contadores[s.id]>=pacote?1:contadores[s.id]+1;
      return{...ev,aluno:s,predNum:contadores[s.id],predTotal:pacote,completou:contadores[s.id]===pacote};
    });
  })();

  const MensalView=()=>{
    const hoje=new Date();
    const mesAtualStr=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
    const proxMesDate=new Date(hoje.getFullYear(),hoje.getMonth()+1,1);
    const mesQueVemStr=`${proxMesDate.getFullYear()}-${String(proxMesDate.getMonth()+1).padStart(2,"0")}`;

    // ── Mensagem de cobrança por aluno ──
    // "Bom dia Rafael, fizemos X aulas [este mês]. Mês que vem vamos fazer Y aulas, valor Z."
    // X = aulas já feitas/faltadas este mês (histórico) + as que ainda faltam este mês (previsão)
    // Y = quantas aulas a agenda tem prevista pro aluno no mês que vem
    // Z = Y × valor da aula do aluno
    const resumoAluno=s=>{
      const feitasEsteMes=(s.aulas||[]).filter(a=>a.data.startsWith(mesAtualStr)&&(a.tipo==="feita"||a.tipo==="falta"||(a.presente&&!a.tipo))).length;
      const restantesEsteMes=eventosComPrevisao.filter(ev=>ev.aluno?.id===s.id&&ev.start.slice(0,7)===mesAtualStr).length;
      const proxMes=eventosComPrevisao.filter(ev=>ev.aluno?.id===s.id&&ev.start.slice(0,7)===mesQueVemStr).length;
      const totalEsteMes=feitasEsteMes+restantesEsteMes;
      const valor=proxMes*(parseFloat(s.valorAula)||0);
      return{totalEsteMes,proxMes,valor};
    };
    const enviarCobranca=s=>{
      const num=(s.whatsapp||"").replace(/\D/g,"");
      if(!num){alert("Adicione o WhatsApp do aluno em Alunos antes de gerar a mensagem.");return;}
      const{totalEsteMes,proxMes,valor}=resumoAluno(s);
      const msg=`Bom dia, ${s.nome.split(" ")[0]}! Fizemos ${totalEsteMes} aula${totalEsteMes===1?"":"s"} esse mês. Mês que vem (${MONTHS_PT[proxMesDate.getMonth()]}) vamos fazer ${proxMes} aula${proxMes===1?"":"s"}, no valor de R$ ${valor.toFixed(2).replace(".",",")}.`;
      window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`,"_blank");
    };

    // agrupa por mês (Set/2026, Out/2026...) e dentro por dia
    const porMes={};
    eventosComPrevisao.forEach(ev=>{
      const d=new Date(ev.start);
      const chaveMes=`${d.getFullYear()}-${d.getMonth()}`;
      (porMes[chaveMes]=porMes[chaveMes]||[]).push(ev);
    });
    const chaves=Object.keys(porMes).sort();
    // lista de alunos únicos que aparecem na previsão, pra mostrar o botão de cobrança de cada um
    const alunosUnicos=[...new Map(eventosComPrevisao.filter(ev=>ev.aluno).map(ev=>[ev.aluno.id,ev.aluno])).values()];
    if(chaves.length===0)return<div style={{textAlign:"center",padding:28,color:"#4a7a9b",fontSize:14}}>Nenhum evento encontrado de hoje até o fim do mês que vem.</div>;
    return<div>
      <div style={{fontSize:12,color:"#4a7a9b",marginBottom:14,lineHeight:1.6}}>
        Números calculados na hora a partir da sua Agenda do Google — não são gravados em lugar nenhum.
        Editar/excluir um evento lá recalcula tudo aqui sozinho.
      </div>

      {alunosUnicos.length>0&&<div style={{marginBottom:20,padding:12,borderRadius:12,background:"rgba(255,255,255,0.03)"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#4a7a9b",marginBottom:8,textTransform:"uppercase"}}>💬 Cobrança rápida</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {alunosUnicos.map(s=>{
            const{totalEsteMes,proxMes,valor}=resumoAluno(s);
            return<button key={s.id} onClick={()=>enviarCobranca(s)}
              style={{padding:"8px 12px",borderRadius:10,border:"1px solid #25d36644",background:"#25d36615",
                color:"#fff",fontSize:12,textAlign:"left",cursor:"pointer"}}>
              <div style={{fontWeight:700}}>{s.nome.split(" ")[0]}</div>
              <div style={{color:"#8fe0b0",fontSize:11}}>{totalEsteMes} feitas · {proxMes} mês que vem · R$ {valor.toFixed(2).replace(".",",")}</div>
            </button>;
          })}
        </div>
      </div>}

      {chaves.map(chaveMes=>{
        const [ano,mes]=chaveMes.split("-").map(Number);
        const evsMes=porMes[chaveMes];
        const porDia={};
        evsMes.forEach(ev=>{const ds=ev.start.slice(0,10);(porDia[ds]=porDia[ds]||[]).push(ev);});
        const diasOrdenados=Object.keys(porDia).sort();
        return<div key={chaveMes} style={{marginBottom:22}}>
          <div style={{fontSize:15,fontWeight:800,color:"#00e5ff",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>
            {MONTHS_PT[mes]} de {ano}
          </div>
          {diasOrdenados.map(ds=>{
            const d=new Date(ds+"T12:00");
            return<div key={ds} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
              <div style={{width:44,flexShrink:0,textAlign:"center",paddingTop:4}}>
                <div style={{fontSize:10,color:"#4a7a9b",fontWeight:700}}>{DAYS[d.getDay()]}</div>
                <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{d.getDate()}</div>
              </div>
              <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:6}}>
                {porDia[ds].map(ev=>{
                  const hora=new Date(ev.start).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
                  if(!ev.aluno)return<div key={ev.id} style={{padding:"7px 12px",borderRadius:12,background:"rgba(255,255,255,0.03)",fontSize:12,color:"#4a7a9b"}}>📅 {parseEvTitle(ev.title).nome} · {hora}</div>;
                  // estado atual (feita/falta/desmarcou/nenhum) desse evento pro aluno nesse dia,
                  // pra saber pra qual estado o clique deve avançar (mesmo ciclo das outras abas)
                  const aulaSt=(ev.aluno.aulas||[]).find(a=>a.data===ds);
                  const tipoAtual=aulaSt?.tipo||(aulaSt?.presente&&!aulaSt?.tipo?"feita":null);
                  const cores={feita:"#00c864",falta:"#ef4444",desmarcou:"#6b7280"};
                  return<button key={ev.id} onClick={()=>marcarAulaAgenda(ev.aluno,proximoTipo(tipoAtual),ds,ev.title)}
                    style={{padding:"7px 12px",borderRadius:12,cursor:"pointer",
                    background:ev.completou?"rgba(234,179,8,0.12)":"rgba(0,180,216,0.08)",
                    border:`1px solid ${ev.completou?"#eab30855":"#00b4d833"}`,
                    display:"flex",alignItems:"center",gap:6,fontSize:13}}>
                    {tipoAtual&&<span style={{fontWeight:700,color:cores[tipoAtual]||"#4a9ebb"}}>{tipoAtual==="feita"?"✓":tipoAtual==="falta"?"✗":"·"}</span>}
                    <span style={{fontWeight:700,color:"#fff"}}>{ev.aluno.nome.split(" ")[0]}</span>
                    <span style={{fontWeight:800,color:ev.completou?"#eab308":"#00e5ff"}}>{ev.predNum}/{ev.predTotal}</span>
                    {ev.completou&&<span title="Pacote completa aqui">🏁</span>}
                    <span style={{color:"#4a7a9b",fontSize:11}}>{hora}</span>
                  </button>;
                })}
              </div>
            </div>;
          })}
        </div>;
      })}
    </div>;
  };

  // ── RELATÓRIO DE HORÁRIOS LIVRES ───────────────────────────────────────────
  const RelatorioModal=()=>{
    const linhas=weekDays.map(d=>{
      const ds=dateStr(d);
      const evs=eventsOfDay(ds);
      const livres=getHorariosLivres(ds);
      const dia=d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"short"});
      return{dia,evs,livres};
    });
    const texto=linhas.map(l=>{
      if(l.livres.length===0) return `${l.dia}: Sem horários livres`;
      const slots=l.livres.map(lr=>`${String(lr.de).padStart(2,"0")}:00–${String(lr.ate).padStart(2,"0")}:00 (${lr.ate-lr.de}h)`).join(", ");
      return `${l.dia}:\n  Livres: ${slots}\n  Ocupados: ${l.evs.length} evento${l.evs.length!==1?"s":""}`;
    }).join("\n\n");
    const compartilhar=()=>{
      const slotsTexto=linhas.filter(l=>l.livres.length>0).map(l=>{
        const slots=l.livres.map(lr=>`${String(lr.de).padStart(2,"0")}:00–${String(lr.ate).padStart(2,"0")}:00`).join(", ");
        return `*${l.dia}:* ${slots}`;
      }).join("\n");
      const msg=`📅 *Horários disponíveis esta semana (6h–11h):*\n\n${slotsTexto||"Sem horários livres esta semana."}\n\nInteresse em treinar? Me chame! 💪`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
    };
    return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:50,display:"flex",alignItems:"flex-end"}}>
      <div style={{background:"#0a1628",borderRadius:"24px 24px 0 0",width:"100%",maxWidth:960,margin:"0 auto",padding:20,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>Horários Livres</div>
            <div style={{fontSize:12,color:"#4a7a9b"}}>Seg–Sex · 6h às 11h · {dateStr(weekStart).slice(5)} – {dateStr(addDays(weekStart,6)).slice(5)}</div>
          </div>
          <button onClick={()=>setShowRelatorio(false)} style={{background:"none",border:"none",color:"#4a7a9b",fontSize:24,cursor:"pointer"}}>×</button>
        </div>
        {linhas.map(({dia,evs,livres},i)=><div key={i} style={{marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:6}}>{dia}</div>
          {evs.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
            {evs.map(ev=><span key={ev.id} style={{fontSize:11,background:"rgba(239,68,68,0.1)",color:"#ef4444",padding:"2px 8px",borderRadius:20,border:"1px solid #ef444433"}}>
              🔴 {parseEvTitle(ev.title).nome} {new Date(ev.start).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
            </span>)}
          </div>}
          {livres.length>0?livres.map((l,j)=><div key={j} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(0,200,100,0.07)",borderRadius:10,marginBottom:4,border:"1px solid #00c86422"}}>
            <span style={{fontSize:14}}>🟢</span>
            <span style={{fontSize:13,fontWeight:600,color:"#00c864"}}>{String(l.de).padStart(2,"0")}:00 – {String(l.ate).padStart(2,"0")}:00</span>
            <span style={{fontSize:11,color:"#2a7a4a",marginLeft:"auto"}}>{l.ate-l.de}h livre</span>
          </div>):
          <div style={{fontSize:12,color:"#2a5a7a",padding:"4px 10px"}}>Sem horários livres</div>}
        </div>)}
        <button onClick={compartilhar} style={{width:"100%",padding:"14px",borderRadius:14,border:"none",
          background:"linear-gradient(135deg,#25d366,#128c7e)",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          📱 Compartilhar no WhatsApp
        </button>
      </div>
    </div>;
  };

  // ── COMANDO TEXTO ─────────────────────────────────────────────────────────
  // executarCmd: interpreta comandos digitados em linguagem natural simples via regex.
  // Reconhece 2 padrões: "desmarcar/cancelar/remover [nome] ... dia X ao Y" (remove um
  // intervalo de datas) e "falta/faltou [nome] ... dia X" (marca 1 falta). Qualquer outra
  // frase cai no fallback de "não entendi" (fb = mensagem de ajuda).
  // Atenção: o "dia X ao Y" assume sempre o MÊS ATUAL — não dá pra marcar em outro mês por aqui.
  const executarCmd=()=>{
    const c=cmd.toLowerCase().trim();let fb="";
    const mRange=c.match(/(desmarcar|cancelar|remover)\s+(\w+).*?(?:dia\s+)?(\d+)\s+(?:ao?\s+|a\s+|até\s+)(\d+)/i);
    if(mRange){
      const nome=mRange[2],d1=parseInt(mRange[3]),d2=parseInt(mRange[4]);
      const s=students.find(x=>x.nome.toLowerCase().startsWith(nome));
      if(!s){fb=`❌ "${nome}" não encontrado.`;}
      else{
        const mes=now.getMonth()+1,ano=now.getFullYear();
        const datas=[];for(let d=d1;d<=d2;d++)datas.push(`${ano}-${String(mes).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
        onUpdate({...s,aulas:(s.aulas||[]).filter(a=>!datas.includes(a.data))});
        fb=`✓ Aulas de ${s.nome} removidas do dia ${d1} ao ${d2}.`;
      }
    } else {
      const mFalta=c.match(/(falta|faltou)\s+(\w+).*?dia\s+(\d+)/i);
      if(mFalta){
        const s=students.find(x=>x.nome.toLowerCase().startsWith(mFalta[2]));
        if(!s){fb=`❌ "${mFalta[2]}" não encontrado.`;}
        else{
          const ds=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(parseInt(mFalta[3])).padStart(2,"0")}`;
          // ✅ CORRIGIDO: antes gravava só {presente:false}, sem tipo:"falta" — e todo o
          // resto do app conta falta olhando pro campo `tipo`, não pro `presente`. Por isso
          // uma falta marcada por aqui nunca aparecia contada em lugar nenhum.
          onUpdate({...s,aulas:[...(s.aulas||[]).filter(a=>a.data!==ds),{id:uid(),data:ds,tipo:"falta",presente:false}]});
          fb=`✓ Falta de ${s.nome} no dia ${mFalta[3]}.`;
        }
      } else fb="❓ Tente: 'desmarcar Rafael do dia 6 ao 17'";
    }
    setCmdFeedback(fb);setCmd("");setTimeout(()=>setCmdFeedback(""),4000);
  };

  return <div>
    {showRelatorio&&<RelatorioModal/>}

    {/* Tabs + botões */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",gap:0,background:"#0a1628",borderRadius:12,padding:3,border:"1px solid #0e2035"}}>
        {[["hoje","Hoje"],["semana","Semana"],["mensal","Mensal"]].map(([v,l])=><button key={v} onClick={()=>setViewMode(v)}
          style={{padding:"9px 20px",borderRadius:9,border:"none",cursor:"pointer",fontSize:14,fontWeight:viewMode===v?700:400,
            background:viewMode===v?"linear-gradient(135deg,#00b4d8,#00e5ff)":"transparent",
            color:viewMode===v?"#000":"#4a7a9b"}}>{l}</button>)}
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setShowRelatorio(true)}
          style={{padding:"9px 12px",borderRadius:10,border:"1px solid #00c86444",background:"rgba(0,200,100,0.07)",color:"#00c864",cursor:"pointer",fontSize:13,fontWeight:600}}>
          🟢 Livres
        </button>
        <button onClick={fetchEvents}
          style={{padding:"9px 12px",borderRadius:10,border:"1px solid #0e2035",background:"transparent",color:"#4a7a9b",cursor:"pointer",fontSize:16}}>↻</button>
      </div>
    </div>

    {loading&&<div style={{textAlign:"center",padding:28,color:"#4a7a9b",fontSize:15}}>⟳ Carregando agenda...</div>}

    {calError&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid #ef444433",borderRadius:14,padding:16,marginBottom:14}}>
      <div style={{fontSize:14,color:"#ef4444",fontWeight:700,marginBottom:8}}>Erro ao carregar agenda</div>
      <div style={{fontSize:12,color:"#ef4444aa",lineHeight:1.7,whiteSpace:"pre-line",marginBottom:12}}>{calError}</div>
      <button onClick={fetchEvents} style={{width:"100%",padding:"11px",borderRadius:10,border:"none",background:"rgba(0,229,255,0.1)",color:"#00e5ff",fontSize:14,fontWeight:700,cursor:"pointer"}}>↻ Tentar novamente</button>
    </div>}

    {!loading&&!calError&&viewMode==="hoje"&&<HojeView/>}
    {!loading&&!calError&&viewMode==="semana"&&<SemanaView/>}
    {!loading&&!calError&&viewMode==="mensal"&&<MensalView/>}

    {!loading&&!calError&&<div style={{marginTop:16,background:"#0a1628",border:"1px solid #0e2035",borderRadius:14,padding:14}}>
      <div style={{fontSize:10,color:"#4a7a9b",letterSpacing:1,marginBottom:5}}>COMANDO RÁPIDO</div>
      <div style={{fontSize:11,color:"#2a5a7a",marginBottom:8}}>"desmarcar Rafael do dia 6 ao 17" · "falta Rachel dia 12"</div>
      <div style={{display:"flex",gap:8}}>
        <input value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&executarCmd()}
          placeholder="Digite um comando..."
          style={{flex:1,background:"#060d18",border:"1px solid #0e2035",borderRadius:10,padding:"11px 12px",color:"#fff",fontSize:14,outline:"none"}}/>
        <button onClick={executarCmd}
          style={{padding:"11px 16px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#00b4d8,#00e5ff)",color:"#000",fontWeight:700,cursor:"pointer",fontSize:15}}>→</button>
      </div>
      {cmdFeedback&&<div style={{marginTop:8,fontSize:13,color:cmdFeedback.startsWith("✓")?"#00c864":"#f59e0b"}}>{cmdFeedback}</div>}
    </div>}
  </div>;
}


// ── APP ───────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════
// SEÇÃO 15: APP PRINCIPAL
// Estado global: plans, logs, students, sessions
// Sincronização: carrega do Google Sheets na inicialização
// Abas: Home(🏠) Agenda(📅) Alunos(👥) Treino(✏️)
// MeuDia(⚡) Clipboard(📋) Progresso(📈) Volume(📊)
// ═══════════════════════════════════════════════════
