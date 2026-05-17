import { useState, useEffect, useRef, useCallback } from 'react'
import { fmt, fmtMoney, groupByDate, groupByDateDetalhado, groupByCidade, filterPedidos, CIDADES, CATEGORIAS_PRODUTO, inputStyle, btnPrimary, btnSmall, card, fetchProdutos, fetchClientes, fetchMetas, addHistorico, uploadPdf, createPedido, updatePedido, fmtCnpj } from './db.js'
import { criarNotificacao } from './notificacoes.js'
import { Badge, RefBadge, PdfViewer, SearchBar, DateGroup, CidadeGroup, HistoricoView, PedidoDetail, SignaturePad } from './components.jsx'
import { CarrinhoFlutuante } from './carrinho-panel.jsx'
import { ExtractorPanel, ClienteCombobox } from './views3.jsx'
import { ClientesTab, NovoClienteRapidoModal } from './views4.jsx'
import { VendedorRotasTab } from './views7.jsx'
import { VendedorDashboardTab } from './vendedor-dashboard.jsx'
import { PopupMetaDia, ConfetesMetaBatida, semanaKey, mesKey } from './vendedor-celebracao.jsx'
import { PerformanceVendedorTab } from './performance-vendedor.jsx'
import { PerformanceComercialTab } from './performance-comercial.jsx'
import { SolicitarManutencaoTab } from './manutencao-solicit.jsx'
import { ReembolsosFuncionarioTab } from './reembolsos.jsx'
import { criarContaReceberDoPedido } from './financeiro-db.js'
import { InadimplenciaReadonly } from './financeiro-inadimplencia.jsx'
import { ObsComercialInput, ObsComercialBanner, ObsComercialInline, ObsEditModal, isUrgente } from './obs-comercial.jsx'
import { RoteirosTab } from './roteiros-tab.jsx'

const FORMAS_PAGAMENTO_PEDIDO = [
  { v: 'a_vista', l: 'À vista', dias: 0 },
  { v: 'boleto_7', l: 'Boleto 7 dias', dias: 7 },
  { v: 'boleto_14', l: 'Boleto 14 dias', dias: 14 },
  { v: 'boleto_28', l: 'Boleto 28 dias', dias: 28 },
  { v: 'cartao', l: 'Cartão', dias: 0 },
  { v: 'pix', l: 'PIX', dias: 0 }
]

const tabBtn=(active)=>({padding:'8px 16px',borderRadius:'8px 8px 0 0',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:13,background:active?'#0A1628':'transparent',color:active?'#fff':'#64748B'})

function ProdutoPopup({prod,onClose,onAdd}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:360,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        {prod.img_url?<img src={prod.img_url} style={{width:'100%',height:300,objectFit:'cover'}}/>:<div style={{width:'100%',height:300,background:'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:64}}>📦</div>}
        <div style={{padding:20}}>
          {prod.codigo&&<span style={{background:'#F1F5F9',color:'#64748B',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,fontFamily:'monospace',display:'inline-block',marginBottom:8}}>{prod.codigo}</span>}
          <div style={{fontWeight:800,fontSize:18,color:'#0A1628',marginBottom:4}}>{prod.nome}</div>
          <div style={{fontSize:13,color:'#94A3B8',marginBottom:4}}>{prod.categoria}</div>
          {prod.categoria==='Químicos'&&prod.diluicao&&<div style={{fontSize:13,color:'#0EA5E9',marginBottom:8}}>💧 Diluição: {prod.diluicao}</div>}
          <div style={{fontSize:24,fontWeight:800,color:'#059669',marginBottom:16}}>{fmtMoney(prod.preco)}</div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={onClose} style={{flex:1,...btnSmall,justifyContent:'center'}}>Fechar</button>
            <button onClick={onAdd} style={{flex:2,background:'#0EA5E9',border:'none',borderRadius:10,color:'#fff',fontSize:13,fontWeight:700,padding:'11px',cursor:'pointer',fontFamily:'inherit'}}>+ Adicionar ao orçamento</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── COMERCIAL VIEW ───
export function ComercialView({ pedidos, refresh, user }) {
  const [tab,setTab]=useState('pedidos')
  const [numero,setNumero]=useState('');const [cliente,setCliente]=useState('');const [cidade,setCidade]=useState('')
  const [arquivo,setArquivo]=useState(null);const [uploading,setUploading]=useState(false);const [search,setSearch]=useState('');const [nfNumeros,setNfNumeros]=useState({})
  const [clientes,setClientes]=useState([]);const [clienteId,setClienteId]=useState(null);const [extractingPedido,setExtractingPedido]=useState(null)
  const [novoClienteNome,setNovoClienteNome]=useState(null);const [expandedId,setExpandedId]=useState(null)
  const [formaPagamento,setFormaPagamento]=useState('a_vista')
  const [obsComercial,setObsComercial]=useState('')
  const [editObsPedido,setEditObsPedido]=useState(null)
  const fileRef=useRef(null);const nfFileRefs=useRef({});const orcCorrigidoRefs=useRef({})
  useEffect(()=>{fetchClientes().then(setClientes)},[]) // eslint-disable-line
  const handleFileSelect=(e)=>{const file=e.target.files[0];if(file)setArquivo(file)}
  const handleSubmit=async()=>{
    if(!cliente.trim()){alert('Informe o nome do cliente');return}
    if(!cidade){alert('Selecione a cidade');return}
    if(!arquivo){alert('Selecione o PDF do orçamento');return}
    setUploading(true)
    try{const url=await uploadPdf(arquivo,'orcamentos');if(url){const fp=FORMAS_PAGAMENTO_PEDIDO.find(x=>x.v===formaPagamento);const obsTxt=obsComercial.trim();const pedido=await createPedido(cliente.trim(),'',cidade,url,user.nome,numero.trim(),clienteId,formaPagamento,fp?.dias||0,obsTxt||null);if(pedido){const acaoCriar=obsTxt?`Criou o pedido com observação: ${obsTxt}`:'Criou o pedido';await addHistorico(pedido.id,user.nome,acaoCriar);const msgObs=obsTxt?(isUrgente(obsTxt)?` · 📢 ${obsTxt}`:` · 📢 Obs do comercial`):'';await criarNotificacao('galpao',`📦 Novo pedido de ${cliente.trim()} - ${cidade}`,`Aguardando conferência · Por: ${user.nome}${msgObs}`,pedido.id)}setNumero('');setCliente('');setCidade('');setClienteId(null);setArquivo(null);setFormaPagamento('a_vista');setObsComercial('');if(fileRef.current)fileRef.current.value='';refresh()}}finally{setUploading(false)}
  }
  const handleNf=async(pedidoId,e)=>{
    const file=e.target.files[0];if(!file)return
    const numero_nf=(nfNumeros[pedidoId]||'').trim()
    if(!numero_nf){alert('Informe o número da NF');e.target.value='';return}
    setUploading(true)
    try{const url=await uploadPdf(file,'notas-fiscais');if(url){await updatePedido(pedidoId,{nf_url:url,status:'NF_EMITIDA',numero_nf});await addHistorico(pedidoId,user.nome,`Anexou NF nº ${numero_nf}`);const _pnf=pedidos.find(x=>x.id===pedidoId);await criarNotificacao('motorista',`🚛 NF ${numero_nf} de ${_pnf?.cliente||''} - ${_pnf?.cidade||''}`,`Pronta para entrega · Por: ${user.nome}`,pedidoId);if(_pnf){const cr=await criarContaReceberDoPedido({..._pnf,numero_nf});if(cr)await criarNotificacao('financeiro',`📥 Nova conta a receber: ${_pnf.cliente}`,`NF ${numero_nf} · ${fmtMoney(_pnf.valor_total||0)} · venc. ${cr.data_vencimento}`,pedidoId)}setNfNumeros(prev=>{const n={...prev};delete n[pedidoId];return n});refresh()}}finally{setUploading(false);e.target.value=''}
  }
  const handleOrcamentoCorrigido=async(pedidoId,e)=>{
    const file=e.target.files[0];if(!file)return;setUploading(true)
    try{const url=await uploadPdf(file,'orcamentos');if(url){await updatePedido(pedidoId,{orcamento_url:url,status:'PENDENTE'});await addHistorico(pedidoId,user.nome,'Enviou orçamento corrigido');refresh()}}finally{setUploading(false);e.target.value=''}
  }
  const filtrados=filterPedidos(pedidos,search);const agrupados=groupByDateDetalhado(filtrados)
  const renderRow=(p)=>{const isExp=expandedId===p.id
    return(<div key={p.id}>
      <div onClick={()=>setExpandedId(v=>v===p.id?null:p.id)} onMouseEnter={e=>{if(!isExp)e.currentTarget.style.background='#F8FAFC'}} onMouseLeave={e=>{if(!isExp)e.currentTarget.style.background='#fff'}} style={{display:'flex',alignItems:'center',gap:6,padding:'10px 14px',borderBottom:'1px solid #F1F5F9',cursor:'pointer',background:isExp?'#F8FAFC':'#fff'}}>
        <RefBadge pedido={p}/><span style={{fontWeight:700,color:'#0A1628',fontSize:13,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.cliente}</span>
        {p.cidade&&<span style={{fontSize:11,color:'#94A3B8',whiteSpace:'nowrap'}}>📍{p.cidade}</span>}<Badge status={p.status}/>
        {p.valor_total>0&&<span style={{fontSize:12,fontWeight:700,color:'#059669',whiteSpace:'nowrap'}}>{fmtMoney(p.valor_total)}</span>}
        <span style={{fontSize:11,color:'#94A3B8',whiteSpace:'nowrap'}}>{fmt(p.criado_em)}</span>
        <span style={{fontSize:10,color:'#94A3B8',transition:'transform 0.2s',display:'inline-block',transform:isExp?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
      </div>
      {isExp&&(<div style={{padding:'10px 14px',background:'#F8FAFC',borderBottom:'1px solid #F1F5F9'}}>
        <ObsComercialInline texto={p.obs_comercial}/>
        {p.status==='PENDENTE'&&<div style={{marginBottom:8}}><button onClick={e=>{e.stopPropagation();setEditObsPedido(p)}} style={{...btnSmall,fontSize:11,padding:'4px 10px',color:'#92400E',borderColor:'#FDE68A'}}>✏️ {p.obs_comercial?'Editar':'Adicionar'} observação</button></div>}
        {p.obs&&p.status==='INCOMPLETO'&&<div style={{background:'#FEE2E2',padding:'8px 12px',borderRadius:8,fontSize:13,color:'#991B1B',marginBottom:8,fontWeight:600,border:'1px solid #FECACA'}}>⚠️ Galpão: {p.obs}</div>}
        {p.obs&&p.status!=='INCOMPLETO'&&<div style={{background:'#FEF3C7',padding:'6px 10px',borderRadius:8,fontSize:12,color:'#92400E',marginBottom:8}}>📋 {p.obs}</div>}
        {p.status==='INCOMPLETO'&&(<div style={{marginBottom:8}}><input type="file" accept=".pdf" ref={el=>orcCorrigidoRefs.current[p.id]=el} style={{display:'none'}} onChange={e=>handleOrcamentoCorrigido(p.id,e)}/><button onClick={e=>{e.stopPropagation();orcCorrigidoRefs.current[p.id]?.click()}} disabled={uploading} style={{...btnSmall,background:'#F59E0B',color:'#fff',border:'none'}}>📄 Enviar orçamento corrigido</button></div>)}
        {p.status==='CONFERIDO'&&(<div style={{marginBottom:8}}><input type="file" accept=".pdf" ref={el=>nfFileRefs.current[p.id]=el} style={{display:'none'}} onChange={e=>handleNf(p.id,e)}/><div style={{display:'flex',gap:8,alignItems:'center'}}><input type="text" inputMode="numeric" value={nfNumeros[p.id]||''} onChange={e=>setNfNumeros(prev=>({...prev,[p.id]:e.target.value.replace(/\D/g,'')}))} placeholder="Número da NF *" style={{...inputStyle,flex:1,padding:'7px 12px',fontSize:13}}/><button onClick={e=>{e.stopPropagation();if(!(nfNumeros[p.id]||'').trim()){alert('Informe o número da NF');return};nfFileRefs.current[p.id]?.click()}} disabled={uploading} style={{...btnSmall,background:'#10B981',color:'#fff',border:'none',whiteSpace:'nowrap'}}>✓ Anexar NF</button></div></div>)}
        {p.orcamento_url&&<div style={{marginBottom:8}}><button onClick={e=>{e.stopPropagation();setExtractingPedido(p)}} style={{...btnSmall,fontSize:11,padding:'5px 10px',color:'#7C3AED'}}>🤖 Extrair itens</button></div>}
        <PedidoDetail pedido={p}/><HistoricoView pedidoId={p.id}/>
      </div>)}
    </div>)
  }
  return(<div>
    <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'2px solid #E2E8F0',paddingBottom:0}}>
      <button onClick={()=>setTab('pedidos')} style={tabBtn(tab==='pedidos')}>📋 Pedidos</button>
      <button onClick={()=>setTab('roteiros')} style={tabBtn(tab==='roteiros')}>🗺️ Roteiros</button>
      <button onClick={()=>setTab('clientes')} style={tabBtn(tab==='clientes')}>👥 Clientes</button>
      <button onClick={()=>setTab('manutencao')} style={tabBtn(tab==='manutencao')}>🔧 Manutenção</button>
      <button onClick={()=>setTab('reembolsos')} style={tabBtn(tab==='reembolsos')}>💸 Reembolsos</button>
      <button onClick={()=>setTab('inadimplencia')} style={tabBtn(tab==='inadimplencia')}>🚨 Inadimplência</button>
      <button onClick={()=>setTab('performance')} style={tabBtn(tab==='performance')}>📊 Performance</button>
    </div>
    {tab==='roteiros'&&<RoteirosTab pedidos={pedidos} user={user}/>}
    {tab==='clientes'&&<ClientesTab pedidos={pedidos} user={user}/>}
    {tab==='manutencao'&&<SolicitarManutencaoTab user={user}/>}
    {tab==='reembolsos'&&<ReembolsosFuncionarioTab user={user}/>}
    {tab==='inadimplencia'&&<InadimplenciaReadonly user={user} role="comercial"/>}
    {tab==='performance'&&<PerformanceComercialTab user={user} pedidos={pedidos}/>}
    {tab==='pedidos'&&<>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar nº, cliente, cidade..."/>
      <div style={{...card,padding:24,marginBottom:20}}>
        <h3 style={{margin:'0 0 16px',fontSize:16,fontWeight:700,color:'#0A1628'}}>Novo Pedido</h3>
        <div style={{display:'grid',gridTemplateColumns:'90px 1fr',gap:12,marginBottom:10}}>
          <input value={numero} onChange={e=>setNumero(e.target.value)} placeholder="Nº" style={inputStyle}/>
          <ClienteCombobox clientes={clientes} value={cliente} onChange={v=>{setCliente(v);setClienteId(null)}} onSelect={c=>{if(c){setCliente(c.nome);setClienteId(c.id)}}} onCreateNew={nome=>setNovoClienteNome(nome)}/>
        </div>
        <select value={cidade} onChange={e=>setCidade(e.target.value)} style={{...inputStyle,marginBottom:10,cursor:'pointer',color:cidade?'#0A1628':'#94A3B8'}}>
          <option value="">Selecione a cidade...</option>{CIDADES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={formaPagamento} onChange={e=>setFormaPagamento(e.target.value)} style={{...inputStyle,marginBottom:12,cursor:'pointer'}}>
          {FORMAS_PAGAMENTO_PEDIDO.map(f=><option key={f.v} value={f.v}>💳 {f.l}</option>)}
        </select>
        <ObsComercialInput value={obsComercial} onChange={setObsComercial}/>
        <input type="file" accept=".pdf" ref={fileRef} onChange={handleFileSelect} style={{display:'none'}}/>
        <button onClick={()=>fileRef.current.click()} style={{...btnSmall,width:'100%',justifyContent:'center',marginBottom:12,borderColor:arquivo?'#10B981':'#CBD5E1',color:arquivo?'#10B981':'#64748B'}}>
          {arquivo?`✓ ${arquivo.name}`:'📎 Selecionar PDF do Orçamento *'}
        </button>
        <button onClick={handleSubmit} disabled={uploading} style={{...btnPrimary,width:'100%',opacity:uploading?0.6:1}}>{uploading?'Enviando...':'+ Criar Pedido'}</button>
      </div>
      {agrupados.map(g=><DateGroup key={g.label} label={g.label} count={g.items.length} valor={g.items.reduce((s,p)=>s+(Number(p.valor_total)||0),0)} defaultOpen={g.label==='Hoje'}><div style={{background:'#fff',borderRadius:10,border:'1px solid #E2E8F0',overflow:'hidden'}}>{g.items.map(renderRow)}</div></DateGroup>)}
      {agrupados.length===0&&<div style={{textAlign:'center',padding:40,color:'#94A3B8'}}>Nenhum pedido encontrado</div>}
      {extractingPedido&&<ExtractorPanel pedido={extractingPedido} onClose={()=>setExtractingPedido(null)} onSaved={refresh}/>}
    </>}
    {novoClienteNome&&<NovoClienteRapidoModal nomeInicial={novoClienteNome} user={user} onClose={()=>setNovoClienteNome(null)} onCriado={c=>{if(c){setCliente(c.nome);setClienteId(c.id);setClientes(prev=>[...prev,c])}}}/>}
    {editObsPedido&&<ObsEditModal pedido={editObsPedido} user={user} onClose={()=>setEditObsPedido(null)} onSaved={refresh}/>}
  </div>)
}

// ─── GALPÃO VIEW ───
export function GalpaoView({ pedidos, refresh, user }) {
  const [tab,setTab]=useState('conferencia')
  const [viewing,setViewing]=useState(null);const [obs,setObs]=useState('');const [saving,setSaving]=useState(false)
  const relevantes=pedidos.filter(p=>['PENDENTE','INCOMPLETO'].includes(p.status))
  const aprovar=async(id)=>{setSaving(true);await updatePedido(id,{status:'CONFERIDO',conferido_por:user.nome});await addHistorico(id,user.nome,'Conferiu e aprovou');const _pa=pedidos.find(x=>x.id===id);await criarNotificacao('comercial',`✅ Pedido ${_pa?.numero_ref||id.slice(0,8).toUpperCase()} de ${_pa?.cliente||''} conferido`,`Anexe a NF · Galpão: ${user.nome}`,id);refresh();setViewing(null);setSaving(false)}
  const rejeitar=async(id)=>{if(!obs.trim()){alert('Escreva a observação');return};setSaving(true);await updatePedido(id,{status:'INCOMPLETO',obs:obs.trim(),conferido_por:user.nome});await addHistorico(id,user.nome,'Rejeitou: '+obs.trim());const _pr=pedidos.find(x=>x.id===id);await criarNotificacao('comercial',`⚠️ Pedido ${_pr?.numero_ref||id.slice(0,8).toUpperCase()} de ${_pr?.cliente||''} incompleto`,`${obs.trim()} · Galpão: ${user.nome}`,id);refresh();setViewing(null);setObs('');setSaving(false)}
  if(viewing){const p=pedidos.find(x=>x.id===viewing);if(!p){setViewing(null);return null}
    return(<div>
      <button onClick={()=>{setViewing(null);setObs('')}} style={{...btnSmall,marginBottom:16}}>← Voltar</button>
      <div style={{...card,padding:20,marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}><h3 style={{margin:0,fontSize:17,color:'#0A1628'}}>{p.cliente}</h3><Badge status={p.status}/></div>
        {p.cidade&&<div style={{fontSize:12,color:'#94A3B8',marginBottom:6}}>📍 {p.cidade}</div>}
        {p.criado_por&&<div style={{fontSize:12,color:'#94A3B8',marginBottom:10}}>Criado por: <b>{p.criado_por}</b></div>}
        <ObsComercialBanner texto={p.obs_comercial} large/>
        <PdfViewer url={p.orcamento_url} title="PDF do Orçamento"/>
      </div>
      {p.obs&&<div style={{background:'#FEE2E2',padding:'12px 16px',borderRadius:10,fontSize:14,color:'#991B1B',marginBottom:16,border:'1px solid #FECACA'}}>⚠️ Obs anterior do galpão: {p.obs}</div>}
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
    <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'2px solid #E2E8F0',paddingBottom:0}}>
      <button onClick={()=>setTab('conferencia')} style={tabBtn(tab==='conferencia')}>📦 Conferência</button>
      <button onClick={()=>setTab('reembolsos')} style={tabBtn(tab==='reembolsos')}>💸 Reembolsos</button>
    </div>
    {tab==='reembolsos' && <ReembolsosFuncionarioTab user={user}/>}
    {tab==='conferencia' && <>
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Conferência ({relevantes.length})</h3>
      {relevantes.length===0&&<div style={{textAlign:'center',padding:40,color:'#94A3B8'}}>Nenhum pedido para conferir 👍</div>}
      <div style={{background:'#fff',borderRadius:10,border:'1px solid #E2E8F0',overflow:'hidden'}}>
      {relevantes.map(p=>{const urg=isUrgente(p.obs_comercial);return(<div key={p.id} onClick={()=>setViewing(p.id)} onMouseEnter={e=>e.currentTarget.style.background='#F8FAFC'} onMouseLeave={e=>e.currentTarget.style.background=p.obs_comercial?'#FFFBEB':'#fff'} style={{display:'block',padding:'10px 14px',borderBottom:'1px solid #F1F5F9',borderLeft:p.obs_comercial?'4px solid #F59E0B':'4px solid transparent',cursor:'pointer',background:p.obs_comercial?'#FFFBEB':'#fff',animation:urg?'obs-pulse 1.4s ease-in-out infinite':'none'}}>
        <style>{`@keyframes obs-pulse{0%,100%{box-shadow:inset 0 0 0 0 rgba(245,158,11,0.45)}50%{box-shadow:inset 0 0 0 4px rgba(245,158,11,0.18)}}`}</style>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <RefBadge pedido={p}/><span style={{fontWeight:700,color:'#0A1628',fontSize:13,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.cliente}</span>
          {p.cidade&&<span style={{fontSize:11,color:'#94A3B8',whiteSpace:'nowrap'}}>📍{p.cidade}</span>}<Badge status={p.status}/>
          <span style={{fontSize:11,color:'#94A3B8',whiteSpace:'nowrap'}}>{fmt(p.criado_em)}</span>
          {p.obs&&<span style={{fontSize:11,color:'#EF4444',marginLeft:4}}>⚠</span>}
        </div>
        {p.obs_comercial&&<div style={{marginTop:6,fontSize:12,color:'#78350F',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>📢 {p.obs_comercial}</div>}
      </div>)})}
      </div>
    </>}
  </div>)
}


// ─── VENDEDOR VIEW ───
export function VendedorView({ user, pedidos=[] }) {
  const [tab,setTab]=useState('catalogo')
  const [produtos,setProdutos]=useState([]);const [search,setSearch]=useState('');const [catFilter,setCatFilter]=useState('')
  const [carrinho,setCarrinho]=useState([]);const [prodPopup,setProdPopup]=useState(null)
  const [showPopup,setShowPopup]=useState(false);const [confetesData,setConfetesData]=useState(null)
  const [metas,setMetas]=useState([]);const [clientes,setClientes]=useState([])
  const loadProdutos=useCallback(async()=>{setProdutos(await fetchProdutos())},[])
  useEffect(()=>{loadProdutos()},[loadProdutos])
  useEffect(()=>{fetchMetas().then(setMetas);fetchClientes().then(setClientes)},[])
  useEffect(()=>{
    if(!user)return
    const k=`valois-meta-popup-${user.usuario}`;const hoje=new Date().toISOString().slice(0,10)
    if(localStorage.getItem(k)!==hoje)setShowPopup(true)
  },[user])
  useEffect(()=>{
    if(!metas.length||!clientes.length||!pedidos.length)return
    const mv=pedidos.filter(p=>{const c=clientes.find(x=>x.id===p.cliente_id||x.nome?.toLowerCase()===p.cliente?.toLowerCase());return c?.vendedor_nome===user.nome}).filter(p=>['NF_EMITIDA','EM_ROTA','ENTREGUE'].includes(p.status))
    const now=new Date();const semIni=new Date(now);semIni.setDate(now.getDate()-now.getDay());semIni.setHours(0,0,0,0)
    const semFim=new Date(semIni);semFim.setDate(semIni.getDate()+6);semFim.setHours(23,59,59)
    const mesIni=new Date(now.getFullYear(),now.getMonth(),1)
    const tS=mv.filter(p=>{const d=new Date(p.criado_em);return d>=semIni&&d<=semFim}).reduce((s,p)=>s+(Number(p.valor_total)||0),0)
    const tM=mv.filter(p=>new Date(p.criado_em)>=mesIni).reduce((s,p)=>s+(Number(p.valor_total)||0),0)
    const mS=metas.find(m=>m.tipo==='semanal'&&(!m.vendedor_nome||m.vendedor_nome===user.nome))
    const mM=metas.find(m=>m.tipo==='mensal'&&(!m.vendedor_nome||m.vendedor_nome===user.nome))
    const chk=(meta,total,tipo,chave)=>{if(!meta)return;const sk=`valois-meta-batida-${tipo}-${chave}`;if(total>=Number(meta.valor_meta)&&!localStorage.getItem(sk)){localStorage.setItem(sk,'1');setConfetesData({tipo,valor:total,nomeVendedor:user.nome.split(' ')[0]})}}
    chk(mS,tS,'semanal',semanaKey());chk(mM,tM,'mensal',mesKey())
  },[metas,clientes,pedidos,user])
  const closePopup=()=>{localStorage.setItem(`valois-meta-popup-${user.usuario}`,new Date().toISOString().slice(0,10));setShowPopup(false)}
  const filtrados=produtos.filter(p=>{
    const matchSearch=!search||p.nome.toLowerCase().includes(search.toLowerCase())||p.categoria.toLowerCase().includes(search.toLowerCase())||(p.codigo&&p.codigo.toLowerCase().includes(search.toLowerCase()))
    const matchCat=!catFilter||p.categoria===catFilter;return matchSearch&&matchCat
  })
  const addCarrinho=(prod)=>{setCarrinho(prev=>{const ex=prev.find(x=>x.id===prod.id);if(ex)return prev.map(x=>x.id===prod.id?{...x,qtd:x.qtd+1}:x);return[...prev,{...prod,qtd:1}]})}
  const removerItem=(id)=>{setCarrinho(prev=>prev.filter(x=>x.id!==id))}
  const alterarQtd=(id,qtd)=>{if(qtd<1)return removerItem(id);setCarrinho(prev=>prev.map(x=>x.id===id?{...x,qtd}:x))}
  const total=carrinho.reduce((s,i)=>s+i.preco*i.qtd,0)
  const cats=[...new Set(produtos.map(p=>p.categoria))].sort()

  return(<div>
    <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'2px solid #E2E8F0',paddingBottom:0,overflowX:'auto'}}>
      <button onClick={()=>setTab('catalogo')} style={tabBtn(tab==='catalogo')}>🛍 Catálogo</button>
      <button onClick={()=>setTab('clientes')} style={tabBtn(tab==='clientes')}>👥 Clientes</button>
      <button onClick={()=>setTab('comissao')} style={tabBtn(tab==='comissao')}>💰 Comissão</button>
      <button onClick={()=>setTab('rotas')} style={tabBtn(tab==='rotas')}>🗺️ Rotas</button>
      <button onClick={()=>setTab('manutencao')} style={tabBtn(tab==='manutencao')}>🔧 Manutenção</button>
      <button onClick={()=>setTab('reembolsos')} style={tabBtn(tab==='reembolsos')}>💸 Reembolsos</button>
      <button onClick={()=>setTab('inadimplencia')} style={tabBtn(tab==='inadimplencia')}>🚨 Inadimplência</button>
      <button onClick={()=>setTab('performance')} style={tabBtn(tab==='performance')}>📊 Performance</button>
    </div>
    {tab==='clientes'&&<ClientesTab pedidos={pedidos} user={user}/>}
    {tab==='comissao'&&<VendedorDashboardTab user={user} pedidos={pedidos}/>}
    {tab==='rotas'&&<VendedorRotasTab/>}
    {tab==='manutencao'&&<SolicitarManutencaoTab user={user}/>}
    {tab==='reembolsos'&&<ReembolsosFuncionarioTab user={user}/>}
    {tab==='inadimplencia'&&<InadimplenciaReadonly user={user} role="vendedor"/>}
    {tab==='performance'&&<PerformanceVendedorTab user={user} pedidos={pedidos}/>}
    {tab==='catalogo'&&<>
    <SearchBar value={search} onChange={setSearch} placeholder="Buscar produto..."/>
    <div style={{display:'flex',gap:4,marginBottom:16,flexWrap:'wrap'}}>
      <button onClick={()=>setCatFilter('')} style={{padding:'5px 12px',borderRadius:8,border:'none',cursor:'pointer',background:!catFilter?'#0A1628':'#E2E8F0',color:!catFilter?'#fff':'#64748B',fontSize:11,fontWeight:700,fontFamily:'inherit'}}>Todos</button>
      {cats.map(c=>(<button key={c} onClick={()=>setCatFilter(catFilter===c?'':c)} style={{padding:'5px 12px',borderRadius:8,border:'none',cursor:'pointer',background:catFilter===c?'#0EA5E9':'#E2E8F0',color:catFilter===c?'#fff':'#64748B',fontSize:11,fontWeight:700,fontFamily:'inherit'}}>{c}</button>))}
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
      {filtrados.map(p=>(<div key={p.id} onClick={()=>setProdPopup(p)} style={{background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.05)',cursor:'pointer'}}>
        {p.img_url?<img src={p.img_url} style={{width:'100%',height:120,objectFit:'cover'}}/>:<div style={{width:'100%',height:120,background:'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>📦</div>}
        <div style={{padding:10}}>
          {p.codigo&&<span style={{background:'#F1F5F9',color:'#64748B',fontSize:10,fontWeight:700,padding:'2px 5px',borderRadius:4,fontFamily:'monospace',display:'block',marginBottom:3}}>{p.codigo}</span>}
          <div style={{fontWeight:700,fontSize:13,color:'#0A1628',marginBottom:2}}>{p.nome}</div>
          <div style={{fontSize:11,color:'#94A3B8',marginBottom:6}}>{p.categoria}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:800,color:'#059669',fontSize:15}}>{fmtMoney(p.preco)}</span>
            <button onClick={e=>{e.stopPropagation();addCarrinho(p)}} style={{background:'#0EA5E9',border:'none',borderRadius:8,color:'#fff',fontSize:11,fontWeight:700,padding:'5px 10px',cursor:'pointer'}}>+ Add</button>
          </div>
        </div>
      </div>))}
    </div>
    {filtrados.length===0&&<div style={{textAlign:'center',padding:40,color:'#94A3B8'}}>Nenhum produto encontrado</div>}
    <div style={{height:90}}/>
    </>}
    <CarrinhoFlutuante carrinho={carrinho} total={total} alterarQtd={alterarQtd} removerItem={removerItem} vendedor={user.nome}/>
    {prodPopup&&<ProdutoPopup prod={prodPopup} onClose={()=>setProdPopup(null)} onAdd={()=>{addCarrinho(prodPopup);setProdPopup(null)}}/>}
    {showPopup&&<PopupMetaDia user={user} pedidos={pedidos} metas={metas} clientes={clientes} onClose={closePopup}/>}
    {confetesData&&<ConfetesMetaBatida tipo={confetesData.tipo} valor={confetesData.valor} nomeVendedor={confetesData.nomeVendedor} onClose={()=>setConfetesData(null)}/>}
  </div>)
}
