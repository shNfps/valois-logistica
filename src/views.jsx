import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'
import { fmt, fmtMoney, getRef, groupByDate, groupByCidade, filterPedidos, CIDADES, CATEGORIAS_PRODUTO, SETOR_MAP, STATUS_MAP, inputStyle, btnPrimary, btnSmall, card, fetchUsuarios, fetchProdutos, addHistorico, uploadPdf, uploadImage, createPedido, updatePedido, deletePedido, deleteUsuario, createProduto, updateProduto, deleteProduto } from './db.js'
import { Badge, PdfViewer, SearchBar, DateGroup, CidadeGroup, HistoricoView, PedidoDetail, SignaturePad } from './components.jsx'

// ─── ADMIN VIEW ───
export function AdminView({ pedidos, refresh, user }) {
  const [usuarios,setUsuarios]=useState([]);const [produtos,setProdutos]=useState([]);const [tab,setTab]=useState('dashboard')
  const [nome,setNome]=useState('');const [usuarioNovo,setUsuarioNovo]=useState('');const [senhaNova,setSenhaNova]=useState('')
  const [setoresNovo,setSetoresNovo]=useState(['comercial']);const [saving,setSaving]=useState(false)
  const [search,setSearch]=useState('');const [editando,setEditando]=useState(null);const [editSenha,setEditSenha]=useState('')
  // Produto state
  const [pNome,setPNome]=useState('');const [pPreco,setPPreco]=useState('');const [pCat,setPCat]=useState('Descartáveis');const [pImg,setPImg]=useState(null);const [pUploading,setPUploading]=useState(false)
  const loadUsuarios=useCallback(async()=>{setUsuarios(await fetchUsuarios())},[])
  const loadProdutos=useCallback(async()=>{setProdutos(await fetchProdutos())},[])
  useEffect(()=>{loadUsuarios();loadProdutos()},[loadUsuarios,loadProdutos])
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
    if(!pNome.trim()||!pPreco){alert('Preencha nome e preço');return};setPUploading(true)
    let img_url=null;if(pImg){img_url=await uploadImage(pImg)}
    await createProduto({nome:pNome.trim(),preco:parseFloat(pPreco),categoria:pCat,img_url})
    setPNome('');setPPreco('');setPImg(null);await loadProdutos();setPUploading(false)
  }
  const handleDeleteProd=async(id,n)=>{if(!confirm(`Deletar ${n}?`))return;await deleteProduto(id);await loadProdutos()}
  const pedidosFiltrados=filterPedidos(pedidos,search);const pedidosAgrupados=groupByDate(pedidosFiltrados)
  const counts={};Object.keys(STATUS_MAP).forEach(s=>{counts[s]=pedidos.filter(p=>p.status===s).length})
  const imgRef=useRef(null)

  return(<div>
    <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
      {[{key:'dashboard',label:'Dashboard',icon:'📊'},{key:'usuarios',label:'Funcionários',icon:'👥'},{key:'produtos',label:'Produtos',icon:'🏷️'},{key:'pedidos',label:'Pedidos',icon:'📋'}].map(t=>(<button key={t.key} onClick={()=>setTab(t.key)} style={{padding:'8px 14px',borderRadius:8,border:'none',cursor:'pointer',background:tab===t.key?'#0A1628':'#E2E8F0',color:tab===t.key?'#fff':'#64748B',fontSize:12,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>{t.icon} {t.label}</button>))}
    </div>

    {tab==='dashboard'&&(<div>
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Pipeline</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20}}>
        {Object.entries(STATUS_MAP).map(([key,s])=>(<div key={key} style={{background:'#fff',borderRadius:12,padding:14,textAlign:'center',borderLeft:`4px solid ${s.color}`,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
          <div style={{fontSize:24,fontWeight:800,color:s.color}}>{counts[key]}</div>
          <div style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase'}}>{s.label}</div>
        </div>))}
      </div>
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Atividade Recente</h3>
      {pedidos.slice(0,15).map(p=>(<div key={p.id} style={{...card,padding:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{background:'#F1F5F9',color:'#64748B',fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,fontFamily:'monospace'}}>{getRef(p)}</span>
            <span style={{fontWeight:700,color:'#0A1628',fontSize:13}}>{p.cliente}</span>
            {p.cidade&&<span style={{fontSize:10,color:'#94A3B8'}}>📍{p.cidade}</span>}
          </div><Badge status={p.status}/>
        </div>
        <div style={{fontSize:11,color:'#94A3B8'}}>{[p.criado_por&&`📋${p.criado_por}`,p.conferido_por&&`📦${p.conferido_por}`,p.entregue_por&&`🚛${p.entregue_por}`].filter(Boolean).join(' → ')} · {fmt(p.atualizado_em||p.criado_em)}</div>
        <PedidoDetail pedido={p}/>
        <div style={{marginTop:6}}><button onClick={()=>handleDeletePedido(p.id,p.cliente)} style={{...btnSmall,fontSize:10,padding:'3px 8px',color:'#EF4444'}}>🗑 Deletar</button></div>
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
        <input value={pNome} onChange={e=>setPNome(e.target.value)} placeholder="Nome do produto" style={{...inputStyle,marginBottom:10}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <input value={pPreco} onChange={e=>setPPreco(e.target.value.replace(/[^0-9.]/g,''))} placeholder="Preço (ex: 12.50)" inputMode="decimal" style={inputStyle}/>
          <select value={pCat} onChange={e=>setPCat(e.target.value)} style={{...inputStyle,cursor:'pointer'}}>{CATEGORIAS_PRODUTO.map(c=><option key={c} value={c}>{c}</option>)}</select>
        </div>
        <input type="file" accept="image/*" ref={imgRef} onChange={e=>setPImg(e.target.files[0])} style={{display:'none'}}/>
        <button onClick={()=>imgRef.current.click()} style={{...btnSmall,marginBottom:14,width:'100%',justifyContent:'center'}}>{pImg?`📷 ${pImg.name}`:'📷 Adicionar foto (opcional)'}</button>
        <button onClick={criarProduto} disabled={pUploading} style={{...btnPrimary,width:'100%',opacity:pUploading?0.6:1}}>{pUploading?'Salvando...':'+ Adicionar Produto'}</button>
      </div>
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',margin:'0 0 14px',textTransform:'uppercase',letterSpacing:1.5}}>Produtos ({produtos.length})</h3>
      {CATEGORIAS_PRODUTO.map(cat=>{const prods=produtos.filter(p=>p.categoria===cat);if(prods.length===0)return null;return(<div key={cat}>
        <div style={{fontSize:12,fontWeight:700,color:'#64748B',padding:'8px 0',borderBottom:'1px solid #E2E8F0',marginBottom:8}}>{cat} ({prods.length})</div>
        {prods.map(p=>(<div key={p.id} style={{...card,display:'flex',gap:12,alignItems:'center'}}>
          {p.img_url?<img src={p.img_url} style={{width:48,height:48,borderRadius:8,objectFit:'cover'}}/>:<div style={{width:48,height:48,borderRadius:8,background:'#F1F5F9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📦</div>}
          <div style={{flex:1}}><div style={{fontWeight:700,color:'#0A1628',fontSize:14}}>{p.nome}</div><div style={{fontSize:12,color:'#64748B'}}>{p.categoria}</div></div>
          <div style={{fontWeight:800,color:'#059669',fontSize:15}}>{fmtMoney(p.preco)}</div>
          <button onClick={()=>handleDeleteProd(p.id,p.nome)} style={{...btnSmall,fontSize:10,padding:'3px 8px',color:'#EF4444'}}>✗</button>
        </div>))}
      </div>)})}
    </div>)}

    {tab==='pedidos'&&(<div>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar nº, cliente, cidade, funcionário..."/>
      {pedidosAgrupados.map(g=>(<DateGroup key={g.label} label={g.label} count={g.items.length} defaultOpen={g.label==='Hoje'||g.label==='Ontem'}>
        {g.items.map(p=>(<div key={p.id} style={card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{background:'#F1F5F9',color:'#64748B',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,fontFamily:'monospace'}}>{getRef(p)}</span>
              <span style={{fontWeight:700,color:'#0A1628',fontSize:15}}>{p.cliente}</span>
              {p.cidade&&<span style={{fontSize:11,color:'#94A3B8'}}>📍{p.cidade}</span>}
            </div><Badge status={p.status}/>
          </div>
          <div style={{fontSize:11,color:'#64748B',display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
            {p.criado_por&&<span>📋 <b>{p.criado_por}</b></span>}{p.conferido_por&&<span>📦 <b>{p.conferido_por}</b></span>}{p.entregue_por&&<span>🚛 <b>{p.entregue_por}</b></span>}
          </div>
          {p.obs&&<div style={{background:'#FEF3C7',padding:'6px 10px',borderRadius:8,fontSize:12,color:'#92400E',marginTop:6}}>Obs: {p.obs}</div>}
          <PedidoDetail pedido={p}/><HistoricoView pedidoId={p.id}/>
          <div style={{marginTop:8,borderTop:'1px solid #F1F5F9',paddingTop:8}}>
            <button onClick={()=>handleDeletePedido(p.id,p.cliente)} style={{...btnSmall,fontSize:11,padding:'4px 10px',color:'#EF4444'}}>🗑 Deletar pedido</button>
          </div>
        </div>))}
      </DateGroup>))}
    </div>)}
  </div>)
}
