import { supabase } from './supabase.js'

export const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
export const fmtMoney = (v) => 'R$ ' + Number(v||0).toFixed(2).replace('.',',')

export const getRef = (p) => {
  if (p.numero_ref) return p.numero_ref
  const d = new Date(p.criado_em)
  return String(d.getDate()).padStart(2,'0') + String(d.getMonth()+1).padStart(2,'0') + '-' + p.id.slice(0,4).toUpperCase()
}

export const CIDADES = ['Araruama','Saquarema','Cabo Frio','São Pedro','Búzios','Macaé','Rio das Ostras','Nova Friburgo','Campos']
export const ROTA_ORDEM = {'Saquarema':0,'Araruama':1,'São Pedro':2,'Cabo Frio':3,'Búzios':4,'Rio das Ostras':5,'Macaé':6,'Campos':7,'Nova Friburgo':8}
export const CATEGORIAS_PRODUTO = ['Descartáveis','Químicos','Higiene Pessoal','Limpeza Geral','Equipamentos','Papel','Outros']
export const FABRICANTES = ['Sevengel','Tork','Ipel','Maranso','Renko','Stork','Riosampa','Nobre','Frilca']

export function groupByDate(pedidos) {
  const now=new Date(); const today=new Date(now.getFullYear(),now.getMonth(),now.getDate())
  const yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1)
  const weekStart=new Date(today);weekStart.setDate(weekStart.getDate()-today.getDay())
  const lastWeekStart=new Date(weekStart);lastWeekStart.setDate(lastWeekStart.getDate()-7)
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1)
  const groups=[];const b={'Hoje':[],'Ontem':[],'Esta Semana':[],'Semana Passada':[],'Este Mês':[],'Anteriores':[]}
  pedidos.forEach(p=>{const d=new Date(p.criado_em);if(d>=today)b['Hoje'].push(p);else if(d>=yesterday)b['Ontem'].push(p);else if(d>=weekStart)b['Esta Semana'].push(p);else if(d>=lastWeekStart)b['Semana Passada'].push(p);else if(d>=monthStart)b['Este Mês'].push(p);else b['Anteriores'].push(p)})
  Object.entries(b).forEach(([l,items])=>{if(items.length>0)groups.push({label:l,items})});return groups
}

export function groupByCidade(pedidos) {
  const groups={};pedidos.forEach(p=>{const c=p.cidade||'Sem cidade';if(!groups[c])groups[c]=[];groups[c].push(p)})
  return Object.entries(groups).sort((a,b)=>(ROTA_ORDEM[a[0]]??99)-(ROTA_ORDEM[b[0]]??99)).map(([cidade,items])=>({cidade,items}))
}

export function filterPedidos(pedidos, search) {
  if(!search)return pedidos;const s=search.toLowerCase()
  return pedidos.filter(p=>getRef(p).toLowerCase().includes(s)||p.numero_ref?.toLowerCase().includes(s)||p.cliente?.toLowerCase().includes(s)||p.motorista?.toLowerCase().includes(s)||p.criado_por?.toLowerCase().includes(s)||p.conferido_por?.toLowerCase().includes(s)||p.entregue_por?.toLowerCase().includes(s)||p.status?.toLowerCase().includes(s)||p.cidade?.toLowerCase().includes(s))
}

export const STATUS_MAP={PENDENTE:{label:'Pendente',color:'#F59E0B',bg:'#FEF3C7'},CONFERIDO:{label:'Conferido',color:'#10B981',bg:'#D1FAE5'},INCOMPLETO:{label:'Incompleto',color:'#EF4444',bg:'#FEE2E2'},NF_EMITIDA:{label:'NF Emitida',color:'#3B82F6',bg:'#DBEAFE'},EM_ROTA:{label:'Em Rota',color:'#8B5CF6',bg:'#EDE9FE'},ENTREGUE:{label:'Entregue',color:'#059669',bg:'#A7F3D0'}}

export const SETOR_MAP={admin:{label:'Admin',icon:'👑',color:'#F59E0B'},comercial:{label:'Comercial',icon:'📋',color:'#3B82F6'},galpao:{label:'Galpão',icon:'📦',color:'#10B981'},motorista:{label:'Motorista',icon:'🚛',color:'#8B5CF6'},vendedor:{label:'Vendedor',icon:'💰',color:'#EC4899'}}

export const inputStyle={padding:'10px 14px',border:'2px solid #E2E8F0',borderRadius:10,fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit',background:'#F8FAFC',width:'100%'}
export const btnPrimary={display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'13px 20px',borderRadius:12,border:'none',background:'#0A1628',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}
export const btnSmall={display:'inline-flex',alignItems:'center',gap:4,padding:'8px 16px',borderRadius:8,border:'1px solid #CBD5E1',background:'#fff',color:'#334155',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}
export const card={background:'#fff',borderRadius:14,padding:18,marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

// DB ops
export async function fetchPedidos(){const{data,error}=await supabase.from('pedidos').select('*').order('criado_em',{ascending:false});if(error){console.error(error);return[]};return data||[]}
export async function fetchUsuarios(){const{data,error}=await supabase.from('usuarios').select('*').order('nome');if(error){console.error(error);return[]};return data||[]}
export async function fetchHistorico(pedidoId){const{data,error}=await supabase.from('historico').select('*').eq('pedido_id',pedidoId).order('criado_em',{ascending:true});if(error){console.error(error);return[]};return data||[]}
export async function addHistorico(pedidoId,usuarioNome,acao){await supabase.from('historico').insert({pedido_id:pedidoId,usuario_nome:usuarioNome,acao})}
export async function fetchProdutos(){const{data,error}=await supabase.from('produtos').select('*').order('categoria').order('nome');if(error){console.error(error);return[]};return data||[]}

export async function uploadPdf(file,folder){
  const filename=`${folder}/${Date.now()}_${file.name}`
  const{error}=await supabase.storage.from('documentos').upload(filename,file,{contentType:'application/pdf'})
  if(error){console.error('Upload error:',error);return null}
  const{data:urlData}=supabase.storage.from('documentos').getPublicUrl(filename);return urlData.publicUrl
}

export async function uploadImage(file){
  const filename=`produtos/${Date.now()}_${file.name}`
  const{error}=await supabase.storage.from('documentos').upload(filename,file,{contentType:file.type})
  if(error){console.error(error);return null}
  const{data:urlData}=supabase.storage.from('documentos').getPublicUrl(filename);return urlData.publicUrl
}

export async function createPedido(cliente,motorista,cidade,orcamentoUrl,criadoPor,numeroRefCustom,clienteId){
  const now=new Date();const prefix=String(now.getDate()).padStart(2,'0')+String(now.getMonth()+1).padStart(2,'0')
  const numero_ref=numeroRefCustom?.trim()||`${prefix}-${String(Math.floor(Math.random()*9000)+1000)}`
  const{data,error}=await supabase.from('pedidos').insert({cliente,motorista,cidade,orcamento_url:orcamentoUrl,status:'PENDENTE',criado_por:criadoPor,numero_ref,cliente_id:clienteId||null}).select().single()
  if(error){console.error(error);return null};return data
}

export async function updatePedido(id,updates){const{error}=await supabase.from('pedidos').update({...updates,atualizado_em:new Date().toISOString()}).eq('id',id);if(error)console.error(error)}
export async function deletePedido(id){const{error}=await supabase.from('pedidos').delete().eq('id',id);if(error)console.error(error)}
export async function deleteUsuario(id){const{error}=await supabase.from('usuarios').delete().eq('id',id);if(error)console.error(error)}
export async function createProduto(p){const{data,error}=await supabase.from('produtos').insert(p).select().single();if(error){console.error(error);return null};return data}
export async function updateProduto(id,updates){const{error}=await supabase.from('produtos').update(updates).eq('id',id);if(error)console.error(error)}
export async function deleteProduto(id){const{error}=await supabase.from('produtos').delete().eq('id',id);if(error)console.error(error)}
export function hasSetor(user,setor){if(!user.setores)return user.setor===setor;return user.setores.includes(setor)}

// Clientes
export async function fetchClientes(){const{data,error}=await supabase.from('clientes').select('*').order('nome');if(error){console.error(error);return[]};return data||[]}
export async function createCliente(c){const{data,error}=await supabase.from('clientes').insert(c).select().single();if(error)console.error(error);return{data:data||null,error:error||null}}
export async function deleteCliente(id){const{error}=await supabase.from('clientes').delete().eq('id',id);if(error)console.error(error)}

// Pedido Itens
export async function fetchPedidoItens(pedidoId){const{data,error}=await supabase.from('pedido_itens').select('*').eq('pedido_id',pedidoId).order('criado_em');if(error){console.error(error);return[]};return data||[]}
export async function savePedidoItens(pedidoId,itens){
  await supabase.from('pedido_itens').delete().eq('pedido_id',pedidoId)
  const rows=itens.map(i=>{const qtd=Number(i.quantidade)||0;const unit=Number(i.preco_unitario)||0;const total=Number(i.preco_total)||qtd*unit;return{pedido_id:pedidoId,nome_produto:i.nome_produto,quantidade:qtd,unidade:i.unidade||'un',preco_unitario:unit,preco_total:total}})
  if(rows.length>0){const{error}=await supabase.from('pedido_itens').insert(rows);if(error){console.error(error);return false}}
  const total=rows.reduce((s,r)=>s+r.preco_total,0)
  await supabase.from('pedidos').update({valor_total:total,atualizado_em:new Date().toISOString()}).eq('id',pedidoId)
  return true
}
