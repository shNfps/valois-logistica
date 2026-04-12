import { useState, useEffect, useRef } from 'react'
import { fmt, fmtMoney, getRef, fetchHistorico, STATUS_MAP, inputStyle, btnPrimary, btnSmall } from './db.js'
import { supabase } from './supabase.js'

export function Badge({status}){const s=STATUS_MAP[status]||STATUS_MAP.PENDENTE;return <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border||s.bg}`,fontWeight:600,fontSize:12,padding:'3px 10px',borderRadius:8,textTransform:'uppercase',letterSpacing:0.5,whiteSpace:'nowrap'}}>{s.label}</span>}
export function Loader(){return <div style={{display:'flex',justifyContent:'center',padding:40}}><div style={{width:32,height:32,border:'3px solid #E2E8F0',borderTopColor:'#3B82F6',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/></div>}

export function PdfViewer({url,title}){
  if(!url)return null
  return(<div style={{borderRadius:12,overflow:'hidden',border:'1px solid #E2E8F0',marginTop:8}}>
    <div style={{background:'#F1F5F9',padding:'8px 14px',fontSize:12,fontWeight:600,color:'#64748B',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span>{title}</span><a href={url} target="_blank" rel="noopener noreferrer" style={{color:'#3B82F6',textDecoration:'none',fontSize:11}}>Abrir ↗</a></div>
    <iframe src={url} style={{width:'100%',height:400,border:'none'}} title={title}/>
  </div>)
}

export function SearchBar({value,onChange,placeholder}){
  return(<div style={{position:'relative',marginBottom:16}}>
    <svg style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',width:16,height:16,color:'#94A3B8',pointerEvents:'none'}} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Buscar...'} style={{...inputStyle,paddingLeft:40}}/>
    {value&&<button onClick={()=>onChange('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',fontSize:15,color:'#94A3B8',cursor:'pointer',lineHeight:1}}>✕</button>}
  </div>)
}

export function DateGroup({label,count,valor,defaultOpen,children}){
  const[open,setOpen]=useState(defaultOpen!==false)
  return(<div style={{marginBottom:8}}>
    <button onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'6px 12px',background:'#E2E8F0',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,color:'#475569',marginBottom:open?4:0}}>
      <span style={{fontSize:10,transition:'transform 0.2s',transform:open?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
      <span style={{flex:1,textAlign:'left'}}>{label}</span>
      {valor>0&&<span style={{fontSize:11,fontWeight:600,color:'#059669'}}>{fmtMoney(valor)}</span>}
      <span style={{background:'#CBD5E1',color:'#475569',fontSize:11,fontWeight:700,padding:'1px 8px',borderRadius:10}}>{count}</span>
    </button>
    {open&&<div style={{maxHeight:400,overflowY:'auto',scrollbarWidth:'thin',scrollbarColor:'#CBD5E1 transparent'}}>{children}</div>}
  </div>)
}

export function CidadeGroup({cidade,count,children}){
  const[open,setOpen]=useState(true)
  return(<div style={{marginBottom:12}}>
    <button onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 14px',background:'linear-gradient(135deg,#1E293B,#334155)',border:'none',borderRadius:12,cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700,color:'#fff',marginBottom:open?10:0}}>
      <span style={{fontSize:12}}>📍</span>{cidade}
      <span style={{background:'rgba(255,255,255,0.2)',fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:10,marginLeft:'auto'}}>{count}</span>
      <span style={{fontSize:10,transform:open?'rotate(90deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▶</span>
    </button>{open&&<div>{children}</div>}
  </div>)
}

// Expandable pedido detail showing PDFs and signature
export function PedidoDetail({pedido}){
  const[open,setOpen]=useState(false)
  const p=pedido
  if(!p.orcamento_url&&!p.nf_url&&!p.entrega_assinatura)return null
  return(<div style={{marginTop:8}}>
    <button onClick={()=>setOpen(!open)} style={{...btnSmall,fontSize:11,padding:'5px 10px',color:'#3B82F6'}}>
      {open?'▾ Ocultar arquivos':'▸ Ver arquivos e assinatura'}
    </button>
    {open&&(<div style={{marginTop:8,background:'#F8FAFC',borderRadius:10,padding:12}}>
      {p.orcamento_url&&<div style={{marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:600,color:'#334155',marginBottom:4}}>📄 Orçamento</div>
        <div style={{display:'flex',gap:8}}>
          <a href={p.orcamento_url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:'#3B82F6'}}>Abrir ↗</a>
          <a href={p.orcamento_url} download style={{fontSize:12,color:'#10B981'}}>⬇ Baixar</a>
        </div>
      </div>}
      {p.nf_url&&<div style={{marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:600,color:'#334155',marginBottom:4}}>📋 Nota Fiscal</div>
        <div style={{display:'flex',gap:8}}>
          <a href={p.nf_url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:'#3B82F6'}}>Abrir ↗</a>
          <a href={p.nf_url} download style={{fontSize:12,color:'#10B981'}}>⬇ Baixar</a>
        </div>
      </div>}
      {p.entrega_assinatura&&<div>
        <div style={{fontSize:12,fontWeight:600,color:'#334155',marginBottom:4}}>✍ Assinatura do Recebedor</div>
        <img src={p.entrega_assinatura} alt="Assinatura" style={{width:200,height:90,objectFit:'contain',border:'1px solid #E2E8F0',borderRadius:8,background:'#fff'}}/>
        {p.entrega_cpf&&<div style={{fontSize:11,color:'#64748B',marginTop:4}}>CPF: {p.entrega_cpf} · {fmt(p.entrega_data)}</div>}
        <a href={p.entrega_assinatura} download={'assinatura_'+p.cliente?.replace(/\s/g,'_')+'.png'} style={{display:'inline-flex',alignItems:'center',gap:4,marginTop:6,fontSize:12,color:'#10B981',fontWeight:600,textDecoration:'none',background:'#D1FAE5',padding:'4px 10px',borderRadius:6}}>⬇ Baixar assinatura</a>
      </div>}
    </div>)}
  </div>)
}

export function HistoricoView({pedidoId}){
  const[historico,setHistorico]=useState([]);const[open,setOpen]=useState(false)
  useEffect(()=>{if(open&&pedidoId)fetchHistorico(pedidoId).then(setHistorico)},[open,pedidoId])
  return(<div style={{marginTop:4}}>
    <button onClick={()=>setOpen(!open)} style={{...btnSmall,fontSize:11,padding:'5px 10px',color:'#64748B'}}>{open?'▾ Ocultar histórico':'▸ Ver histórico'}</button>
    {open&&(<div style={{marginTop:8,background:'#F8FAFC',borderRadius:8,padding:10}}>
      {historico.length===0&&<div style={{fontSize:12,color:'#94A3B8'}}>Nenhum registro</div>}
      {historico.map((h,i)=>(<div key={i} style={{fontSize:12,color:'#334155',padding:'4px 0',borderBottom:i<historico.length-1?'1px solid #E2E8F0':'none'}}>
        <span style={{fontWeight:600}}>{h.usuario_nome}</span><span style={{color:'#64748B'}}> — {h.acao}</span>
        <span style={{color:'#94A3B8',marginLeft:8,fontSize:10}}>{fmt(h.criado_em)}</span>
      </div>))}
    </div>)}
  </div>)
}

const NF_STATUSES=['NF_EMITIDA','EM_ROTA','ENTREGUE']
export function RefBadge({pedido}){
  if(NF_STATUSES.includes(pedido.status)&&pedido.numero_nf){
    return <span style={{background:'#DBEAFE',color:'#1D4ED8',border:'1px solid #BFDBFE',fontWeight:600,fontSize:11,padding:'2px 8px',borderRadius:6,fontFamily:'monospace',whiteSpace:'nowrap'}}>NF {pedido.numero_nf}</span>
  }
  return <span style={{background:'#F1F5F9',color:'#64748B',border:'1px solid #E2E8F0',fontWeight:600,fontSize:11,padding:'2px 8px',borderRadius:6,fontFamily:'monospace'}}>{getRef(pedido)}</span>
}

export function SignaturePad({onSave,onCancel}){
  const canvasRef=useRef(null);const drawing=useRef(false);const[cpf,setCpf]=useState('')
  useEffect(()=>{const c=canvasRef.current;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#0A1628';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round'},[])
  const getPos=(e)=>{const rect=canvasRef.current.getBoundingClientRect();const touch=e.touches?e.touches[0]:e;return{x:(touch.clientX-rect.left)*(canvasRef.current.width/rect.width),y:(touch.clientY-rect.top)*(canvasRef.current.height/rect.height)}}
  const start=(e)=>{e.preventDefault();drawing.current=true;const p=getPos(e);canvasRef.current.getContext('2d').beginPath();canvasRef.current.getContext('2d').moveTo(p.x,p.y)}
  const move=(e)=>{if(!drawing.current)return;e.preventDefault();const p=getPos(e);const ctx=canvasRef.current.getContext('2d');ctx.lineTo(p.x,p.y);ctx.stroke()}
  const end=()=>{drawing.current=false}
  const clear=()=>{const c=canvasRef.current;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height)}
  const fmtCpf=(v)=>{const n=v.replace(/\D/g,'').slice(0,11);if(n.length<=3)return n;if(n.length<=6)return n.slice(0,3)+'.'+n.slice(3);if(n.length<=9)return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6);return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6,9)+'-'+n.slice(9)}
  const save=()=>{if(cpf.replace(/\D/g,'').length!==11){alert('CPF inválido');return};onSave({assinatura:canvasRef.current.toDataURL('image/png'),cpf})}
  return(<div style={{background:'#fff',borderRadius:16,padding:24,maxWidth:500,margin:'0 auto'}}>
    <h3 style={{margin:'0 0 16px',color:'#0A1628',fontSize:18,fontWeight:700}}>Assinatura do Recebedor</h3>
    <div style={{border:'2px solid #CBD5E1',borderRadius:12,overflow:'hidden',marginBottom:16,touchAction:'none'}}>
      <canvas ref={canvasRef} width={460} height={200} onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{width:'100%',height:'auto',display:'block',cursor:'crosshair'}}/>
    </div>
    <button onClick={clear} style={{...btnSmall,marginBottom:16,fontSize:12}}>Limpar</button>
    <div style={{marginBottom:16}}><label style={{display:'block',fontSize:13,fontWeight:600,color:'#334155',marginBottom:6}}>CPF do Recebedor</label>
      <input value={cpf} onChange={e=>setCpf(fmtCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" style={inputStyle}/></div>
    <div style={{display:'flex',gap:10}}>
      <button onClick={onCancel} style={{...btnSmall,flex:1,justifyContent:'center',padding:'12px'}}>Cancelar</button>
      <button onClick={save} style={{...btnPrimary,flex:1}}>Confirmar Entrega</button>
    </div>
  </div>)
}

export function LoginScreen({onLogin}){
  const[usuario,setUsuario]=useState('');const[senha,setSenha]=useState('');const[erro,setErro]=useState('');const[loading,setLoading]=useState(false)
  const handleLogin=async()=>{
    if(!usuario.trim()||!senha.trim()){setErro('Preencha usuário e senha');return}
    setLoading(true);setErro('')
    const{data,error}=await supabase.from('usuarios').select('*').eq('usuario',usuario.trim().toLowerCase()).eq('senha',senha).single()
    setLoading(false);if(error||!data){setErro('Usuário ou senha incorretos');return};onLogin(data)
  }
  return(
    <div style={{fontFamily:"'Inter',sans-serif",minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:0,backgroundImage:'url(/login-bg.jpg)',backgroundSize:'cover',backgroundPosition:'center',filter:'brightness(0.3) saturate(0.7)'}}/>
      <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:1,background:'linear-gradient(135deg,rgba(10,22,40,0.85) 0%,rgba(30,58,95,0.75) 50%,rgba(10,22,40,0.9) 100%)'}}/>
      <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center'}}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{marginBottom:14,filter:'drop-shadow(0 4px 16px rgba(37,99,235,0.4))'}}>
          <rect width="64" height="64" rx="16" fill="#0F172A"/>
          <text x="8" y="38" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="18" fill="#2563EB">VA</text>
          <text x="33" y="38" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="18" fill="#10B981">LOIS</text>
          <rect x="8" y="44" width="48" height="3" rx="1.5" fill="#10B981" opacity="0.8"/>
        </svg>
        <div style={{color:'#fff',fontWeight:700,fontSize:22,letterSpacing:3,marginBottom:4}}><span style={{color:'#2563EB'}}>VA</span><span style={{color:'#10B981'}}>LOIS</span></div>
        <div style={{color:'#94A3B8',fontSize:11,fontWeight:500,letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>Descartáveis e Limpeza</div>
        <div style={{color:'#64748B',fontSize:10,fontWeight:500,letterSpacing:3,textTransform:'uppercase',marginBottom:36}}>Sistema de Logística</div>
        <div style={{width:'100%',maxWidth:340,background:'rgba(15,23,42,0.72)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderRadius:20,padding:28,border:'1px solid rgba(255,255,255,0.1)'}}>
          <div style={{marginBottom:16}}><label style={{display:'block',fontSize:12,fontWeight:500,color:'#94A3B8',marginBottom:8,letterSpacing:0.3}}>Usuário</label>
            <input value={usuario} onChange={e=>setUsuario(e.target.value)} placeholder="seu.usuario" onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{...inputStyle,background:'rgba(30,41,59,0.8)',border:'1px solid rgba(51,65,85,0.7)',color:'#fff',borderRadius:10}}/></div>
          <div style={{marginBottom:20}}><label style={{display:'block',fontSize:12,fontWeight:500,color:'#94A3B8',marginBottom:8,letterSpacing:0.3}}>Senha</label>
            <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="••••••" onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{...inputStyle,background:'rgba(30,41,59,0.8)',border:'1px solid rgba(51,65,85,0.7)',color:'#fff',borderRadius:10}}/></div>
          {erro&&<div style={{background:'rgba(239,68,68,0.15)',color:'#FCA5A5',border:'1px solid rgba(239,68,68,0.3)',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:16,textAlign:'center'}}>{erro}</div>}
          <button onClick={handleLogin} disabled={loading} style={{...btnPrimary,width:'100%',background:'linear-gradient(135deg,#2563EB,#3B82F6)',borderRadius:10,opacity:loading?0.6:1}}>{loading?'Entrando...':'Entrar'}</button>
        </div>
      </div>
    </div>
  )
}
