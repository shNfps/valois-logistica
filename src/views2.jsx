import { useState, useEffect, useRef, useCallback } from 'react'
import { fmt, fmtMoney, getRef, groupByDate, groupByCidade, filterPedidos, CIDADES, CATEGORIAS_PRODUTO, inputStyle, btnPrimary, btnSmall, card, fetchProdutos, addHistorico, uploadPdf, createPedido, updatePedido } from './db.js'
import { Badge, PdfViewer, SearchBar, DateGroup, CidadeGroup, HistoricoView, PedidoDetail, SignaturePad } from './components.jsx'

// ─── COMERCIAL VIEW ───
export function ComercialView({ pedidos, refresh, user }) {
  const [cliente,setCliente]=useState('');const [motorista,setMotorista]=useState('');const [cidade,setCidade]=useState('')
  const [uploading,setUploading]=useState(false);const [search,setSearch]=useState('')
  const fileRef=useRef(null);const nfFileRefs=useRef({})
  const handleOrcamento=async(e)=>{
    const file=e.target.files[0];if(!file)return;if(!cliente.trim()){alert('Informe o cliente');return};if(!cidade){alert('Selecione a cidade');return}
    setUploading(true)
    try{const url=await uploadPdf(file,'orcamentos');if(url){const pedido=await createPedido(cliente.trim(),motorista.trim(),cidade,url,user.nome);if(pedido)await addHistorico(pedido.id,user.nome,'Criou o pedido');setCliente('');setMotorista('');setCidade('');refresh()}}finally{setUploading(false);e.target.value=''}
  }
  const handleNf=async(pedidoId,e)=>{
    const file=e.target.files[0];if(!file)return;setUploading(true)
    try{const url=await uploadPdf(file,'notas-fiscais');if(url){await updatePedido(pedidoId,{nf_url:url,status:'NF_EMITIDA'});await addHistorico(pedidoId,user.nome,'Anexou NF');refresh()}}finally{setUploading(false);e.target.value=''}
  }
  const filtrados=filterPedidos(pedidos,search);const agrupados=groupByDate(filtrados)
  const renderCard=(p)=>(<div key={p.id} style={card}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{background:'#F1F5F9',color:'#64748B',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,fontFamily:'monospace'}}>{getRef(p)}</span>
        <span style={{fontWeight:700,color:'#0A1628',fontSize:15}}>{p.cliente}</span>
        {p.cidade&&<span style={{fontSize:11,color:'#94A3B8'}}>📍{p.cidade}</span>}
      </div><Badge status={p.status}/>
    </div>
    <div style={{fontSize:12,color:'#94A3B8',marginBottom:4}}>{p.motorista&&<span>Motorista: {p.motorista} · </span>}{p.criado_por&&<span>Por: {p.criado_por} · </span>}{fmt(p.criado_em)}</div>
    {p.obs&&<div style={{background:'#FEF3C7',padding:'6px 10px',borderRadius:8,fontSize:12,color:'#92400E',marginBottom:6}}>📋 Obs: {p.obs}</div>}
    {(p.status==='CONFERIDO'||p.status==='INCOMPLETO')&&(<div style={{marginTop:8}}>
      <input type="file" accept=".pdf" ref={el=>nfFileRefs.current[p.id]=el} style={{display:'none'}} onChange={e=>handleNf(p.id,e)}/>
      <button onClick={()=>nfFileRefs.current[p.id]?.click()} disabled={uploading} style={{...btnSmall,background:p.status==='CONFERIDO'?'#10B981':'#3B82F6',color:'#fff',border:'none'}}>{p.status==='CONFERIDO'?'✓ Anexar NF':'📎 Corrigir e Anexar NF'}</button>
    </div>)}
    <PedidoDetail pedido={p}/><HistoricoView pedidoId={p.id}/>
  </div>)
  return(<div>
    <div style={{...card,padding:24,marginBottom:20}}>
      <h3 style={{margin:'0 0 16px',fontSize:16,fontWeight:700,color:'#0A1628'}}>Novo Pedido</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:10}}>
        <input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Nome do Cliente / Unidade" style={inputStyle}/>
        <input value={motorista} onChange={e=>setMotorista(e.target.value)} placeholder="Motorista (opcional)" style={inputStyle}/>
      </div>
      <select value={cidade} onChange={e=>setCidade(e.target.value)} style={{...inputStyle,marginBottom:14,cursor:'pointer',color:cidade?'#0A1628':'#94A3B8'}}>
        <option value="">Selecione a cidade...</option>{CIDADES.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
      <input type="file" accept=".pdf" ref={fileRef} onChange={handleOrcamento} style={{display:'none'}}/>
      <button onClick={()=>{if(!cliente.trim()){alert('Informe o cliente');return};if(!cidade){alert('Selecione a cidade');return};fileRef.current.click()}} disabled={uploading} style={{...btnPrimary,width:'100%',opacity:uploading?0.6:1}}>{uploading?'Enviando...':'📄 Upload PDF do Orçamento'}</button>
    </div>
    <SearchBar value={search} onChange={setSearch} placeholder="Buscar nº, cliente, cidade..."/>
    {agrupados.map(g=><DateGroup key={g.label} label={g.label} count={g.items.length} defaultOpen={g.label==='Hoje'||g.label==='Ontem'}>{g.items.map(renderCard)}</DateGroup>)}
    {agrupados.length===0&&<div style={{textAlign:'center',padding:40,color:'#94A3B8'}}>Nenhum pedido encontrado</div>}
  </div>)
}

// ─── GALPÃO VIEW ───
export function GalpaoView({ pedidos, refresh, user }) {
  const [viewing,setViewing]=useState(null);const [obs,setObs]=useState('');const [saving,setSaving]=useState(false)
  const relevantes=pedidos.filter(p=>['PENDENTE','INCOMPLETO'].includes(p.status))
  const aprovar=async(id)=>{setSaving(true);await updatePedido(id,{status:'CONFERIDO',conferido_por:user.nome});await addHistorico(id,user.nome,'Conferiu e aprovou');refresh();setViewing(null);setSaving(false)}
  const rejeitar=async(id)=>{if(!obs.trim()){alert('Escreva a observação');return};setSaving(true);await updatePedido(id,{status:'INCOMPLETO',obs:obs.trim(),conferido_por:user.nome});await addHistorico(id,user.nome,'Rejeitou: '+obs.trim());refresh();setViewing(null);setObs('');setSaving(false)}
  if(viewing){const p=pedidos.find(x=>x.id===viewing);if(!p){setViewing(null);return null}
    return(<div>
      <button onClick={()=>{setViewing(null);setObs('')}} style={{...btnSmall,marginBottom:16}}>← Voltar</button>
      <div style={{...card,padding:20,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><h3 style={{margin:0,fontSize:17,color:'#0A1628'}}>{p.cliente}</h3><Badge status={p.status}/></div>
        {p.cidade&&<div style={{fontSize:12,color:'#94A3B8',marginBottom:6}}>📍 {p.cidade}</div>}
        {p.criado_por&&<div style={{fontSize:12,color:'#94A3B8',marginBottom:10}}>Criado por: <b>{p.criado_por}</b></div>}
        <PdfViewer url={p.orcamento_url} title="PDF do Orçamento"/>
      </div>
      {p.obs&&<div style={{background:'#FEF3C7',padding:'12px 16px',borderRadius:10,fontSize:14,color:'#92400E',marginBottom:16}}>Obs anterior: {p.obs}</div>}
      <div style={{...card,padding:20}}>
        <label style={{display:'block',fontSize:13,fontWeight:600,color:'#334155',marginBottom:8}}>Observação (se faltar itens)</label>
        <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} placeholder="Ex: Faltam 2 caixas de luva P..." style={{...inputStyle,resize:'vertical'}}/>
        <div style={{display:'flex',gap:10,marginTop:14}}>
          <button onClick={()=>rejeitar(p.id)} disabled={saving} style={{...btnPrimary,flex:1,background:'#EF4444',opacity:saving?0.6:1}}>✗ Itens Faltando</button>
          <button onClick={()=>aprovar(p.id)} disabled={saving} style={{...btnPrimary,flex:1,background:'#10B981',opacity:saving?0.6:1}}>✓ Tudo Conferido</button>
        </div>
      </div>
    </div>)}
  return(<div>
    <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Conferência ({relevantes.length})</h3>
    {relevantes.length===0&&<div style={{textAlign:'center',padding:40,color:'#94A3B8'}}>Nenhum pedido para conferir 👍</div>}
    {relevantes.map(p=>(<div key={p.id} onClick={()=>setViewing(p.id)} style={{...card,cursor:'pointer',border:'2px solid transparent'}} onMouseEnter={e=>e.currentTarget.style.borderColor='#CBD5E1'} onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{background:'#F1F5F9',color:'#64748B',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,fontFamily:'monospace'}}>{getRef(p)}</span><span style={{fontWeight:700,color:'#0A1628',fontSize:15}}>{p.cliente}</span>{p.cidade&&<span style={{fontSize:11,color:'#94A3B8'}}>📍{p.cidade}</span>}</div><Badge status={p.status}/>
      </div>
      <div style={{fontSize:12,color:'#94A3B8',marginTop:6}}>{p.criado_por&&'Por: '+p.criado_por+' · '}{fmt(p.criado_em)}</div>
      {p.obs&&<div style={{fontSize:12,color:'#EF4444',marginTop:4}}>⚠ {p.obs}</div>}
    </div>))}
  </div>)
}

// ─── MOTORISTA VIEW ───
export function MotoristaView({ pedidos, refresh, user }) {
  const [viewing,setViewing]=useState(null);const [signing,setSigning]=useState(false);const [saving,setSaving]=useState(false)
  const pendentes=pedidos.filter(p=>['NF_EMITIDA','EM_ROTA'].includes(p.status));const entregues=pedidos.filter(p=>p.status==='ENTREGUE')
  const porCidade=groupByCidade(pendentes)
  const iniciarRota=async(id)=>{setSaving(true);await updatePedido(id,{status:'EM_ROTA',entregue_por:user.nome});await addHistorico(id,user.nome,'Iniciou rota');refresh();setSaving(false)}
  const confirmarEntrega=async(id,{assinatura,cpf})=>{setSaving(true);await updatePedido(id,{status:'ENTREGUE',entrega_assinatura:assinatura,entrega_cpf:cpf,entrega_data:new Date().toISOString(),entregue_por:user.nome});await addHistorico(id,user.nome,'Entregou — CPF: '+cpf);refresh();setSigning(false);setViewing(null);setSaving(false)}
  if(viewing){const p=pedidos.find(x=>x.id===viewing);if(!p){setViewing(null);return null}
    if(signing)return<SignaturePad onSave={data=>confirmarEntrega(p.id,data)} onCancel={()=>setSigning(false)}/>
    return(<div>
      <button onClick={()=>setViewing(null)} style={{...btnSmall,marginBottom:16}}>← Voltar</button>
      <div style={{...card,padding:20,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><h3 style={{margin:0,fontSize:17,color:'#0A1628'}}>{p.cliente}</h3><Badge status={p.status}/></div>
        {p.cidade&&<div style={{fontSize:13,color:'#64748B',marginBottom:10}}>📍 {p.cidade}</div>}
        {p.nf_url&&<PdfViewer url={p.nf_url} title="Nota Fiscal"/>}
      </div>
      <div style={{display:'flex',gap:10}}>
        {p.status==='NF_EMITIDA'&&<button onClick={()=>iniciarRota(p.id)} disabled={saving} style={{...btnPrimary,flex:1,background:'#8B5CF6'}}>🚛 Iniciar Rota</button>}
        {p.status==='EM_ROTA'&&<button onClick={()=>setSigning(true)} style={{...btnPrimary,flex:1,background:'#059669'}}>✍ Coletar Assinatura</button>}
      </div>
    </div>)}
  return(<div>
    <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Entregas por Rota ({pendentes.length})</h3>
    {pendentes.length===0&&<div style={{textAlign:'center',padding:40,color:'#94A3B8'}}>Nenhuma entrega pendente</div>}
    {porCidade.map(g=>(<CidadeGroup key={g.cidade} cidade={g.cidade} count={g.items.length}>
      {g.items.map(p=>(<div key={p.id} onClick={()=>setViewing(p.id)} style={{...card,cursor:'pointer',border:'2px solid transparent'}} onMouseEnter={e=>e.currentTarget.style.borderColor='#CBD5E1'} onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{background:'#F1F5F9',color:'#64748B',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,fontFamily:'monospace'}}>{getRef(p)}</span><span style={{fontWeight:700,color:'#0A1628'}}>{p.cliente}</span></div><Badge status={p.status}/>
        </div><div style={{fontSize:12,color:'#94A3B8',marginTop:6}}>{p.motorista&&'🚛 '+p.motorista+' · '}{fmt(p.atualizado_em)}</div>
      </div>))}
    </CidadeGroup>))}
    {entregues.length>0&&(<>
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'28px 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Entregues ({entregues.length})</h3>
      {entregues.slice(0,20).map(p=>(<div key={p.id} style={{...card,background:'#F0FDF4',opacity:0.85}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{background:'#D1FAE5',color:'#059669',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,fontFamily:'monospace'}}>{getRef(p)}</span><span style={{fontWeight:700,color:'#0A1628'}}>{p.cliente}</span>{p.cidade&&<span style={{fontSize:10,color:'#94A3B8'}}>📍{p.cidade}</span>}</div><Badge status={p.status}/>
        </div>{p.entrega_cpf&&<div style={{fontSize:12,color:'#059669',marginTop:6}}>CPF: {p.entrega_cpf} · {fmt(p.entrega_data)}</div>}
      </div>))}
    </>)}
  </div>)
}

// ─── VENDEDOR VIEW ───
export function VendedorView({ user }) {
  const [produtos,setProdutos]=useState([]);const [search,setSearch]=useState('');const [catFilter,setCatFilter]=useState('')
  const [carrinho,setCarrinho]=useState([]);const [clienteOrc,setClienteOrc]=useState('')
  const loadProdutos=useCallback(async()=>{setProdutos(await fetchProdutos())},[])
  useEffect(()=>{loadProdutos()},[loadProdutos])
  const filtrados=produtos.filter(p=>{
    const matchSearch=!search||p.nome.toLowerCase().includes(search.toLowerCase())||p.categoria.toLowerCase().includes(search.toLowerCase())
    const matchCat=!catFilter||p.categoria===catFilter;return matchSearch&&matchCat
  })
  const addCarrinho=(prod)=>{setCarrinho(prev=>{const ex=prev.find(x=>x.id===prod.id);if(ex)return prev.map(x=>x.id===prod.id?{...x,qtd:x.qtd+1}:x);return[...prev,{...prod,qtd:1}]})}
  const removerItem=(id)=>{setCarrinho(prev=>prev.filter(x=>x.id!==id))}
  const alterarQtd=(id,qtd)=>{if(qtd<1)return removerItem(id);setCarrinho(prev=>prev.map(x=>x.id===id?{...x,qtd}:x))}
  const total=carrinho.reduce((s,i)=>s+i.preco*i.qtd,0)
  const gerarOrcamento=()=>{
    if(!clienteOrc.trim()){alert('Informe o cliente');return}
    let txt=`ORÇAMENTO - VALOIS DESCARTÁVEIS\nCliente: ${clienteOrc}\nVendedor: ${user.nome}\nData: ${new Date().toLocaleDateString('pt-BR')}\n${'─'.repeat(40)}\n`
    carrinho.forEach(i=>{txt+=`\n${i.nome}\n  ${i.qtd}x ${fmtMoney(i.preco)} = ${fmtMoney(i.preco*i.qtd)}\n`})
    txt+=`\n${'─'.repeat(40)}\nTOTAL: ${fmtMoney(total)}\n`
    const blob=new Blob([txt],{type:'text/plain'});const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url;a.download=`orcamento_${clienteOrc.replace(/\s/g,'_')}.txt`;a.click();URL.revokeObjectURL(url)
  }
  const cats=[...new Set(produtos.map(p=>p.categoria))].sort()

  return(<div>
    <SearchBar value={search} onChange={setSearch} placeholder="Buscar produto..."/>
    <div style={{display:'flex',gap:4,marginBottom:16,flexWrap:'wrap'}}>
      <button onClick={()=>setCatFilter('')} style={{padding:'5px 12px',borderRadius:8,border:'none',cursor:'pointer',background:!catFilter?'#0A1628':'#E2E8F0',color:!catFilter?'#fff':'#64748B',fontSize:11,fontWeight:700,fontFamily:'inherit'}}>Todos</button>
      {cats.map(c=>(<button key={c} onClick={()=>setCatFilter(catFilter===c?'':c)} style={{padding:'5px 12px',borderRadius:8,border:'none',cursor:'pointer',background:catFilter===c?'#EC4899':'#E2E8F0',color:catFilter===c?'#fff':'#64748B',fontSize:11,fontWeight:700,fontFamily:'inherit'}}>{c}</button>))}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
      {filtrados.map(p=>(<div key={p.id} style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
        {p.img_url?<img src={p.img_url} style={{width:'100%',height:120,objectFit:'cover'}}/>:<div style={{width:'100%',height:120,background:'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>📦</div>}
        <div style={{padding:10}}>
          <div style={{fontWeight:700,fontSize:13,color:'#0A1628',marginBottom:2}}>{p.nome}</div>
          <div style={{fontSize:11,color:'#94A3B8',marginBottom:6}}>{p.categoria}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:800,color:'#059669',fontSize:15}}>{fmtMoney(p.preco)}</span>
            <button onClick={()=>addCarrinho(p)} style={{background:'#EC4899',border:'none',borderRadius:8,color:'#fff',fontSize:11,fontWeight:700,padding:'5px 10px',cursor:'pointer'}}>+ Add</button>
          </div>
        </div>
      </div>))}
    </div>
    {filtrados.length===0&&<div style={{textAlign:'center',padding:40,color:'#94A3B8'}}>Nenhum produto encontrado</div>}

    {carrinho.length>0&&(<div style={{...card,padding:20,background:'#FDF2F8',border:'2px solid #EC4899',position:'sticky',bottom:16}}>
      <h3 style={{margin:'0 0 12px',fontSize:15,fontWeight:700,color:'#0A1628'}}>🛒 Orçamento ({carrinho.length} itens)</h3>
      <input value={clienteOrc} onChange={e=>setClienteOrc(e.target.value)} placeholder="Nome do cliente" style={{...inputStyle,marginBottom:10}}/>
      {carrinho.map(i=>(<div key={i.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #F9A8D4'}}>
        <span style={{flex:1,fontSize:13,fontWeight:600,color:'#0A1628'}}>{i.nome}</span>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <button onClick={()=>alterarQtd(i.id,i.qtd-1)} style={{width:24,height:24,borderRadius:6,border:'1px solid #CBD5E1',background:'#fff',cursor:'pointer',fontWeight:700}}>-</button>
          <span style={{fontSize:13,fontWeight:700,width:24,textAlign:'center'}}>{i.qtd}</span>
          <button onClick={()=>alterarQtd(i.id,i.qtd+1)} style={{width:24,height:24,borderRadius:6,border:'1px solid #CBD5E1',background:'#fff',cursor:'pointer',fontWeight:700}}>+</button>
        </div>
        <span style={{fontSize:13,fontWeight:700,color:'#059669',width:70,textAlign:'right'}}>{fmtMoney(i.preco*i.qtd)}</span>
        <button onClick={()=>removerItem(i.id)} style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',fontSize:14}}>✕</button>
      </div>))}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:12,borderTop:'2px solid #EC4899'}}>
        <span style={{fontSize:16,fontWeight:800,color:'#0A1628'}}>Total</span>
        <span style={{fontSize:18,fontWeight:800,color:'#059669'}}>{fmtMoney(total)}</span>
      </div>
      <button onClick={gerarOrcamento} style={{...btnPrimary,width:'100%',marginTop:12,background:'#EC4899'}}>📄 Gerar Orçamento</button>
    </div>)}
  </div>)
}
