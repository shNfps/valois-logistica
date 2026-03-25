import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'
import { fmt, fmtMoney, groupByDate, groupByCidade, filterPedidos, CIDADES, CATEGORIAS_PRODUTO, FABRICANTES, VEICULOS, SETOR_MAP, STATUS_MAP, inputStyle, btnPrimary, btnSmall, card, fetchUsuarios, fetchProdutos, addHistorico, uploadPdf, uploadImage, createPedido, updatePedido, deletePedido, deleteUsuario, createProduto, upsertProduto, updateProduto, deleteProduto, fetchRotasAtivas } from './db.js'
import { Badge, RefBadge, PdfViewer, SearchBar, DateGroup, CidadeGroup, HistoricoView, PedidoDetail, SignaturePad } from './components.jsx'
import { ExtractorPanel, AdminClientesTab, AdminVendasSection, EditProdutoModal } from './views3.jsx'
import { ReprocessarCodigosModal } from './reprocessar-codigos.jsx'
import { FotosProdutosModal } from './fotos-produtos.jsx'
import { AdminEditRotaScreen } from './views7.jsx'

// ─── ADMIN VIEW ───
export function AdminView({ pedidos, refresh, user }) {
  const [usuarios,setUsuarios]=useState([]);const [produtos,setProdutos]=useState([]);const [tab,setTab]=useState('dashboard')
  const [nome,setNome]=useState('');const [usuarioNovo,setUsuarioNovo]=useState('');const [senhaNova,setSenhaNova]=useState('')
  const [setoresNovo,setSetoresNovo]=useState(['comercial']);const [saving,setSaving]=useState(false)
  const [search,setSearch]=useState('');const [editando,setEditando]=useState(null);const [editSenha,setEditSenha]=useState('');const [extractingPedido,setExtractingPedido]=useState(null)
  // Produto state
  const [pNome,setPNome]=useState('');const [pPreco,setPPreco]=useState('');const [pCat,setPCat]=useState('Descartáveis');const [pFab,setPFab]=useState('');const [pImg,setPImg]=useState(null);const [pUploading,setPUploading]=useState(false);const [editProd,setEditProd]=useState(null);const [pCodigo,setPCodigo]=useState('');const [pDiluicao,setPDiluicao]=useState('');const [showSemCodigo,setShowSemCodigo]=useState(false);const [showReprocessar,setShowReprocessar]=useState(false);const [showFotos,setShowFotos]=useState(false)
  const [rotasAtivas,setRotasAtivas]=useState([]);const [editRota,setEditRota]=useState(null);const [pipelineFilter,setPipelineFilter]=useState(null)
  const loadUsuarios=useCallback(async()=>{setUsuarios(await fetchUsuarios())},[])
  const loadProdutos=useCallback(async()=>{setProdutos(await fetchProdutos())},[])
  const loadRotas=useCallback(async()=>{setRotasAtivas(await fetchRotasAtivas())},[])
  useEffect(()=>{loadUsuarios();loadProdutos()},[loadUsuarios,loadProdutos])
  useEffect(()=>{if(tab==='dashboard')loadRotas()},[tab,loadRotas])
  const toggleSetor=(s)=>{setSetoresNovo(prev=>prev.includes(s)?prev.filter(x=>x!==s):[...prev,s])}
  const criarUsuario=async()=>{
    if(!nome.trim()||!usuarioNovo.trim()||!senhaNova.trim()||setoresNovo.length===0){alert('Preencha tudo e selecione ao menos 1 setor');return}
    setSaving(true);const{error}=await supabase.from('usuarios').insert({nome:nome.trim(),usuario:usuarioNovo.trim().toLowerCase(),senha:senhaNova,setor:setoresNovo[0],setores:setoresNovo,ativo:true})
    if(error){alert('Erro: '+(error.message.includes('unique')?'Usuário já existe':error.message));setSaving(false);return}
    setNome('');setUsuarioNovo('');setSenhaNova('');setSetoresNovo(['comercial']);await loadUsuarios();setSaving(false)
  }
  const handleDelete=async(id,n)=>{if(!confirm(`Deletar ${n}?`))return;await deleteUsuario(id);await loadUsuarios()}
  const handleDeletePedido=async(id,cliente)=>{if(!confirm(`Deletar pedido de ${cliente}? Essa ação não pode ser desfeita.`))return;await deletePedido(id);refresh()}
  const alterarSenha=async(id)=>{if(!editSenha.trim())return;await supabase.from('usuarios').update({senha:editSenha}).eq('id',id);setEditando(null);setEditSenha('');alert('Senha alterada!')}
  const criarProduto=async()=>{
    if(!pNome.trim()||!pPreco){alert('Preencha nome e preço');return}
    if(!pImg){alert('A foto do produto é obrigatória');return}
    setPUploading(true)
    const img_url=await uploadImage(pImg)
    const r=await upsertProduto({nome:pNome.trim(),preco:parseFloat(pPreco),categoria:pCat,fabricante:pFab||null,img_url,codigo:pCodigo.trim().replace(/\./g,'')||null,diluicao:pCat==='Químicos'?pDiluicao.trim()||null:null})
    if(r?._action==='skipped')alert('Produto já existe com preço igual ou maior. Nenhuma alteração feita.')
    else if(r?._action==='updated')alert('Preço atualizado pois o novo valor é maior.')
    setPNome('');setPPreco('');setPCat('Descartáveis');setPFab('');setPImg(null);setPCodigo('');setPDiluicao('');await loadProdutos();setPUploading(false)
  }
  const handleDeleteProd=async(id,n)=>{if(!confirm(`Deletar ${n}?`))return;await deleteProduto(id);await loadProdutos()}
  const pedBase=pipelineFilter?pedidos.filter(p=>p.status===pipelineFilter):pedidos
  const pedidosFiltrados=filterPedidos(pedBase,search);const pedidosAgrupados=groupByDate(pedidosFiltrados)
  const counts={};Object.keys(STATUS_MAP).forEach(s=>{counts[s]=pedidos.filter(p=>p.status===s).length})
  const imgRef=useRef(null)

  return(<div>
    <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
      {[{key:'dashboard',label:'Dashboard',icon:'📊'},{key:'usuarios',label:'Funcionários',icon:'👥'},{key:'produtos',label:'Produtos',icon:'🏷️'},{key:'pedidos',label:'Pedidos',icon:'📋'},{key:'clientes',label:'Clientes',icon:'👤'}].map(t=>(<button key={t.key} onClick={()=>setTab(t.key)} style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',background:tab===t.key?'#0A1628':'#E2E8F0',color:tab===t.key?'#fff':'#64748B',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>{t.icon} {t.label}</button>))}
    </div>

    {tab==='dashboard'&&(<div>
      <AdminVendasSection pedidos={pedidos}/>
      {rotasAtivas.length>0&&(<div style={{marginBottom:20}}>
        <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 12px',textTransform:'uppercase',letterSpacing:1.5}}>Rotas Ao Vivo ({rotasAtivas.length})</h3>
        <style>{`@keyframes blink-red{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
        {rotasAtivas.map(r=>{const vi=VEICULOS.find(v=>v.key===r.veiculo)?.icon||'🚐';const emRota=pedidos.filter(p=>p.status==='EM_ROTA'&&p.entregue_por===r.motorista_nome).length;return(<div key={r.id} style={{...card,borderLeft:'3px solid #EF4444',padding:'12px 16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <span style={{fontWeight:700,color:'#0A1628',fontSize:14}}>{vi} {r.motorista_nome}</span>
              <span style={{fontSize:12,color:'#64748B',marginLeft:8}}>📍 {r.cidades?.length > 0 ? r.cidades.join(', ') : r.cidade} · {r.veiculo}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button onClick={e=>{e.stopPropagation();setEditRota(r)}} style={{...btnSmall,fontSize:11,padding:'3px 8px',color:'#3B82F6'}}>✏️ Editar</button>
              <span style={{width:7,height:7,borderRadius:'50%',background:'#EF4444',display:'inline-block',animation:'blink-red 1s infinite'}}/>
              <span style={{fontSize:11,fontWeight:700,color:'#EF4444',letterSpacing:1}}>AO VIVO</span>
            </div>
          </div>
          {emRota>0&&<div style={{fontSize:11,color:'#94A3B8',marginTop:4}}>{emRota} pedido{emRota!==1?'s':''} em trânsito</div>}
        </div>)})}
      </div>)}
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Pipeline</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        {Object.entries(STATUS_MAP).map(([key,s])=>{const active=pipelineFilter===key;return(<div key={key} onClick={()=>setPipelineFilter(f=>f===key?null:key)} style={{background:'#fff',borderRadius:12,padding:14,textAlign:'center',border:active?`2px solid ${s.color}`:`none`,borderLeft:active?`2px solid ${s.color}`:`4px solid ${s.color}`,boxShadow:active?`0 0 0 2px ${s.color}33`:'0 1px 3px rgba(0,0,0,0.05)',cursor:'pointer',transform:active?'scale(1.04)':'scale(1)',transition:'transform 0.15s'}}>
          <div style={{fontSize:24,fontWeight:800,color:s.color}}>{counts[key]}</div>
          <div style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase'}}>{s.label}</div>
        </div>)})}</div>
      {pipelineFilter&&<div style={{background:'#F1F5F9',borderRadius:8,padding:'8px 12px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12}}>
        <span style={{fontWeight:700,color:'#334155'}}>Filtrado por: {STATUS_MAP[pipelineFilter].label} ({pedidos.filter(p=>p.status===pipelineFilter).length} pedidos)</span>
        <button onClick={()=>setPipelineFilter(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B',fontSize:13,fontFamily:'inherit'}}>✕ Limpar</button>
      </div>}
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Atividade Recente</h3>
      {(pipelineFilter?pedidos.filter(p=>p.status===pipelineFilter):pedidos).slice(0,15).map(p=>(<div key={p.id} style={{...card,padding:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <RefBadge pedido={p}/>
            <span style={{fontWeight:700,color:'#0A1628',fontSize:13}}>{p.cliente}</span>
            {p.cidade&&<span style={{fontSize:10,color:'#94A3B8'}}>📍{p.cidade}</span>}
          </div><Badge status={p.status}/>
        </div>
        <div style={{fontSize:11,color:'#94A3B8'}}>{[p.criado_por&&`📋${p.criado_por}`,p.conferido_por&&`📦${p.conferido_por}`,p.entregue_por&&`🚛${p.entregue_por}`].filter(Boolean).join(' → ')} · {fmt(p.atualizado_em||p.criado_em)}</div>
        {p.valor_total>0&&<div style={{fontSize:11,fontWeight:700,color:'#059669',marginTop:2}}>💰 {fmtMoney(p.valor_total)}</div>}
        <PedidoDetail pedido={p}/>
        <div style={{marginTop:6,display:'flex',gap:6,flexWrap:'wrap'}}>
          {p.orcamento_url&&<button onClick={()=>setExtractingPedido(p)} style={{...btnSmall,fontSize:10,padding:'3px 8px',color:'#7C3AED'}}>🤖 Extrair itens</button>}
          <button onClick={()=>handleDeletePedido(p.id,p.cliente)} style={{...btnSmall,fontSize:10,padding:'3px 8px',color:'#EF4444'}}>🗑 Deletar</button>
        </div>
      </div>))}
    </div>)}

    {tab==='usuarios'&&(<div>
      <div style={{...card,padding:24,marginBottom:20}}>
        <h3 style={{margin:'0 0 16px',fontSize:16,fontWeight:700,color:'#0A1628'}}>Novo Funcionário</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome completo" style={inputStyle}/>
          <input value={usuarioNovo} onChange={e=>setUsuarioNovo(e.target.value)} placeholder="Usuário (login)" style={inputStyle}/>
        </div>
        <input type="password" value={senhaNova} onChange={e=>setSenhaNova(e.target.value)} placeholder="Senha" style={{...inputStyle,marginBottom:10}}/>
        <label style={{display:'block',fontSize:12,fontWeight:600,color:'#334155',marginBottom:8}}>Setores</label>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
          {['comercial','galpao','motorista','vendedor','admin'].map(s=>{const info=SETOR_MAP[s];const active=setoresNovo.includes(s);return(<button key={s} onClick={()=>toggleSetor(s)} style={{padding:'6px 12px',borderRadius:8,border:`2px solid ${active?info.color:'#E2E8F0'}`,background:active?info.color+'22':'#fff',color:active?info.color:'#94A3B8',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{info.icon} {info.label}</button>)})}
        </div>
        <button onClick={criarUsuario} disabled={saving} style={{...btnPrimary,width:'100%',opacity:saving?0.6:1}}>{saving?'Criando...':'+ Criar Funcionário'}</button>
      </div>
      {usuarios.map(u=>{const setores=u.setores||[u.setor];return(<div key={u.id} style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><span style={{fontWeight:700,color:'#0A1628',fontSize:15}}>{u.nome}</span><span style={{fontSize:12,color:'#94A3B8',marginLeft:8}}>@{u.usuario}</span></div>
          <div style={{display:'flex',gap:3}}>{setores.map(s=>{const info=SETOR_MAP[s]||SETOR_MAP.comercial;return<span key={s} style={{background:info.color+'22',color:info.color,fontWeight:700,fontSize:10,padding:'2px 6px',borderRadius:8}}>{info.icon}</span>})}</div>
        </div>
        <div style={{display:'flex',gap:6,marginTop:10}}>
          {editando===u.id?(<div style={{display:'flex',gap:4,alignItems:'center'}}>
            <input type="password" value={editSenha} onChange={e=>setEditSenha(e.target.value)} placeholder="Nova senha" style={{...inputStyle,width:140,padding:'4px 8px',fontSize:12}}/>
            <button onClick={()=>alterarSenha(u.id)} style={{...btnSmall,fontSize:11,padding:'4px 8px',background:'#10B981',color:'#fff',border:'none'}}>OK</button>
            <button onClick={()=>{setEditando(null);setEditSenha('')}} style={{...btnSmall,fontSize:11,padding:'4px 8px'}}>✗</button>
          </div>):(<>
            <button onClick={()=>setEditando(u.id)} style={{...btnSmall,fontSize:11,padding:'4px 10px'}}>Alterar senha</button>
            {!setores.includes('admin')&&<button onClick={()=>handleDelete(u.id,u.nome)} style={{...btnSmall,fontSize:11,padding:'4px 10px',color:'#EF4444'}}>Deletar</button>}
          </>)}
        </div>
      </div>)})}
    </div>)}

    {tab==='produtos'&&(<div>
      <div style={{...card,padding:24,marginBottom:20}}>
        <h3 style={{margin:'0 0 16px',fontSize:16,fontWeight:700,color:'#0A1628'}}>Novo Produto</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <input value={pCodigo} onChange={e=>setPCodigo(e.target.value)} placeholder="Código (ex: VAL001)" style={inputStyle}/>
          <input value={pNome} onChange={e=>setPNome(e.target.value)} placeholder="Nome do produto *" style={inputStyle}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <input value={pPreco} onChange={e=>setPPreco(e.target.value.replace(/[^0-9.]/g,''))} placeholder="Preço (ex: 12.50)" inputMode="decimal" style={inputStyle}/>
          <select value={pCat} onChange={e=>setPCat(e.target.value)} style={{...inputStyle,cursor:'pointer'}}>{CATEGORIAS_PRODUTO.map(c=><option key={c} value={c}>{c}</option>)}</select>
        </div>
        {pCat==='Químicos'&&<input value={pDiluicao} onChange={e=>setPDiluicao(e.target.value)} placeholder="Diluição (ex: 1:10, Puro)" style={{...inputStyle,marginBottom:10}}/>}
        <select value={pFab} onChange={e=>setPFab(e.target.value)} style={{...inputStyle,marginBottom:10,cursor:'pointer',color:pFab?'#0A1628':'#94A3B8'}}>
          <option value="">Fabricante...</option>{FABRICANTES.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        <input type="file" accept="image/*" ref={imgRef} onChange={e=>setPImg(e.target.files[0])} style={{display:'none'}}/>
        <button onClick={()=>imgRef.current.click()} style={{...btnSmall,marginBottom:14,width:'100%',justifyContent:'center',borderColor:pImg?'#10B981':'#CBD5E1',color:pImg?'#10B981':'#64748B'}}>{pImg?`✓ ${pImg.name}`:'📷 Foto do produto *'}</button>
        <button onClick={criarProduto} disabled={pUploading} style={{...btnPrimary,width:'100%',opacity:pUploading?0.6:1}}>{pUploading?'Salvando...':'+ Adicionar Produto'}</button>
      </div>
      {(()=>{const sem=produtos.filter(p=>!p.codigo);if(!sem.length)return null;return(
        <div style={{background:'#FEF3C7',border:'1px solid #F59E0B',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:13,fontWeight:600,color:'#92400E'}}>⚠️ {sem.length} produto(s) sem código</span>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setShowReprocessar(true)} style={{...btnSmall,fontSize:11,padding:'4px 10px',color:'#7C3AED',borderColor:'#DDD6FE'}}>🔄 Reprocessar</button>
              <button onClick={()=>setShowSemCodigo(v=>!v)} style={{...btnSmall,fontSize:11,padding:'4px 10px'}}>{showSemCodigo?'Ocultar':'Ver lista'}</button>
            </div>
          </div>
          {showSemCodigo&&<div style={{marginTop:10}}>
            {sem.map(p=>(<div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #FDE68A'}}>
              <span style={{flex:1,fontSize:13,color:'#78350F',fontWeight:600}}>{p.nome}</span>
              <span style={{fontSize:11,color:'#92400E'}}>{p.categoria}</span>
              <button onClick={()=>setEditProd(p)} style={{...btnSmall,fontSize:10,padding:'2px 8px',color:'#3B82F6'}}>✏️ Editar</button>
              <button onClick={()=>handleDeleteProd(p.id,p.nome)} style={{...btnSmall,fontSize:10,padding:'2px 8px',color:'#EF4444'}}>✗</button>
            </div>))}
          </div>}
        </div>
      )})()}
      {(()=>{const sf=produtos.filter(p=>!p.img_url);if(!sf.length)return null;return(
        <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:13,fontWeight:600,color:'#1E40AF'}}>📷 {sf.length} produto(s) sem foto</span>
          <button onClick={()=>setShowFotos(true)} style={{...btnSmall,fontSize:11,padding:'4px 10px',color:'#1D4ED8',borderColor:'#BFDBFE'}}>🔍 Adicionar fotos</button>
        </div>
      )})()}
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Produtos ({produtos.length})</h3>
      {CATEGORIAS_PRODUTO.map(cat=>{const prods=produtos.filter(p=>p.categoria===cat);if(prods.length===0)return null;return(<div key={cat}>
        <div style={{fontSize:12,fontWeight:700,color:'#64748B',padding:'8px 0',borderBottom:'1px solid #E2E8F0',marginBottom:8}}>{cat} ({prods.length})</div>
        {prods.map(p=>(<div key={p.id} style={{...card,display:'flex',gap:12,alignItems:'center'}}>
          {p.img_url?<img src={p.img_url} style={{width:48,height:48,borderRadius:8,objectFit:'cover'}}/>:<div style={{width:48,height:48,borderRadius:8,background:'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📦</div>}
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
              {p.codigo&&<span style={{background:'#F1F5F9',color:'#64748B',fontSize:10,fontWeight:700,padding:'2px 5px',borderRadius:4,fontFamily:'monospace'}}>{p.codigo}</span>}
              <span style={{fontWeight:700,color:'#0A1628',fontSize:14}}>{p.nome}</span>
            </div>
            <div style={{fontSize:11,color:'#64748B'}}>{p.categoria}{p.fabricante&&<span style={{marginLeft:6,color:'#94A3B8'}}>· {p.fabricante}</span>}{p.diluicao&&<span style={{marginLeft:6,color:'#0EA5E9'}}>💧 {p.diluicao}</span>}</div>
          </div>
          <div style={{fontWeight:800,color:'#059669',fontSize:15}}>{fmtMoney(p.preco)}</div>
          <button onClick={()=>setEditProd(p)} style={{...btnSmall,fontSize:10,padding:'3px 8px',color:'#3B82F6'}}>✏️</button>
          <button onClick={()=>handleDeleteProd(p.id,p.nome)} style={{...btnSmall,fontSize:10,padding:'3px 8px',color:'#EF4444'}}>✗</button>
        </div>))}
      </div>)})}
    </div>)}

    {tab==='clientes'&&<AdminClientesTab pedidos={pedidos}/>}
    {tab==='pedidos'&&(<div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar nº, cliente, cidade, funcionário..."/>
      {pipelineFilter&&<div style={{background:'#F1F5F9',borderRadius:8,padding:'8px 12px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12}}>
        <span style={{fontWeight:700,color:'#334155'}}>Filtrado por: {STATUS_MAP[pipelineFilter].label} ({pedidosFiltrados.length} pedidos)</span>
        <button onClick={()=>setPipelineFilter(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748B',fontSize:13,fontFamily:'inherit'}}>✕ Limpar</button>
      </div>}
      {pedidosAgrupados.map(g=>(<DateGroup key={g.label} label={g.label} count={g.items.length} defaultOpen={g.label==='Hoje'||g.label==='Ontem'}>
        {g.items.map(p=>(<div key={p.id} style={card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <RefBadge pedido={p}/>
              <span style={{fontWeight:700,color:'#0A1628',fontSize:15}}>{p.cliente}</span>
              {p.cidade&&<span style={{fontSize:11,color:'#94A3B8'}}>📍{p.cidade}</span>}
            </div><Badge status={p.status}/>
          </div>
          <div style={{fontSize:11,color:'#64748B',display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
            {p.criado_por&&<span>📋 <b>{p.criado_por}</b></span>}{p.conferido_por&&<span>📦 <b>{p.conferido_por}</b></span>}{p.entregue_por&&<span>🚛 <b>{p.entregue_por}</b></span>}
          </div>
          {p.obs&&<div style={{background:'#FEF3C7',padding:'6px 10px',borderRadius:8,fontSize:12,color:'#92400E',marginTop:6}}>Obs: {p.obs}</div>}
          {p.valor_total>0&&<div style={{fontSize:12,fontWeight:700,color:'#059669',marginTop:4}}>💰 {fmtMoney(p.valor_total)}</div>}
          <PedidoDetail pedido={p}/><HistoricoView pedidoId={p.id}/>
          <div style={{marginTop:8,borderTop:'1px solid #F1F5F9',paddingTop:8,display:'flex',gap:8,flexWrap:'wrap'}}>
            {p.orcamento_url&&<button onClick={()=>setExtractingPedido(p)} style={{...btnSmall,fontSize:11,padding:'4px 10px',color:'#7C3AED'}}>🤖 Extrair itens</button>}
            <button onClick={()=>handleDeletePedido(p.id,p.cliente)} style={{...btnSmall,fontSize:11,padding:'4px 10px',color:'#EF4444'}}>🗑 Deletar pedido</button>
          </div>
        </div>))}
      </DateGroup>))}
    </div>)}
    {extractingPedido&&<ExtractorPanel pedido={extractingPedido} onClose={()=>setExtractingPedido(null)} onSaved={refresh}/>}
    {editProd&&<EditProdutoModal prod={editProd} onClose={()=>setEditProd(null)} onSaved={()=>{loadProdutos();setEditProd(null)}}/>}
    {editRota&&<AdminEditRotaScreen rota={editRota} pedidos={pedidos} onClose={()=>setEditRota(null)} onSaved={()=>{loadRotas();refresh()}}/>}
    {showReprocessar&&<ReprocessarCodigosModal pedidos={pedidos} onClose={()=>setShowReprocessar(false)} onDone={loadProdutos}/>}
    {showFotos&&<FotosProdutosModal produtos={produtos} onClose={()=>setShowFotos(false)} onSaved={loadProdutos}/>}
  </div>)
}
