import {defaultCloudConfig} from './config.js';
// Only a public publishable/anon key belongs in this client. Never use service_role.
let config = {...defaultCloudConfig};
try { const saved = JSON.parse(localStorage.getItem('pasanaku-cloud-config') || 'null');if(saved?.url && saved?.key) config = saved; } catch {}
let session = null;
let version = null;
try { session = JSON.parse(sessionStorage.getItem('pasanaku-session') || 'null'); } catch {}
export const cloudInfo = () => ({...config, email:session?.user?.email || '', connected:Boolean(session), scope:session?.user?.id ? config.url+'|'+session.user.id : null, version});
export function configure(url, key) {
  url = url.trim().replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw Error('Usa la URL HTTPS de tu proyecto Supabase (https://…supabase.co).');
  key = key.trim();
  if (!key || key.startsWith('sb_secret_')) throw Error('Usa únicamente la clave publicable o anon, nunca una clave secreta.');
  if (key.includes('.')) {
    try { const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if (payload.role !== 'anon') throw Error(); }
    catch { throw Error('La clave JWT debe tener rol anon.'); }
  } else if (!key.startsWith('sb_publishable_')) throw Error('La clave publicable no es válida.');
  config = {url,key};localStorage.setItem('pasanaku-cloud-config',JSON.stringify(config));logout();
}
export function logout() { session=null;version=null;sessionStorage.removeItem('pasanaku-session'); }
function acceptSession(data) {
  session={...data,expires_at:data.expires_at || Math.floor(Date.now()/1000)+data.expires_in};
  sessionStorage.setItem('pasanaku-session',JSON.stringify(session));
}
let refreshing = null;
async function ensureSession() {
  if (!session) throw Object.assign(Error('Inicia sesión para conectarte. Tus cambios locales están guardados.'),{code:'auth'});
  if (session.expires_at * 1000 > Date.now() + 30000) return;
  if (!refreshing) refreshing=(async()=>{
    const identity=session?.user?.id,project=config.url;
    try {
      const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token},auth:false});
      if(identity!==session?.user?.id || project!==config.url) throw Object.assign(Error('La sesión cambió.'),{code:'auth'});
      acceptSession(data);
    } catch(error) {
      // Retain the session on transient network errors so an offline moment does not discard a valid refresh token.
      if (!(error instanceof TypeError)) logout();
      throw Object.assign(Error('No se pudo renovar la sesión. Revisa tu conexión o inicia sesión de nuevo. Tus cambios locales están guardados.'),{code:error instanceof TypeError?'network':'auth'});
    } finally { refreshing=null; }
  })();
  await refreshing;
}
async function request(path, {method='GET',body,auth=true}={}) {
  if (!config.url || !config.key) throw Error('Configura primero tu proyecto Supabase.');
  const project=config.url,publicKey=config.key,identity=session?.user?.id;
  if (auth) {await ensureSession();if(identity!==session?.user?.id || project!==config.url)throw Object.assign(Error('La sesión cambió. Reintenta desde la cuenta actual.'),{code:'auth'});}
  const response = await fetch(project + path, {method,signal:AbortSignal.timeout(20000),headers:{apikey:publicKey,'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${session.access_token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data = await response.json().catch(()=>null);
  if (!response.ok) {const message=data?.message || data?.error_description || data?.msg || 'No se pudo conectar. Revisa tu conexión y la configuración.';throw Object.assign(Error(message),{status:response.status,code:message.startsWith('Otro dispositivo')?'conflict':response.status===401?'auth':data?.code});}
  return data;
}
export async function login(email,password) {
  const data = await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false});
  acceptSession(data);version=null;
}
export async function loadCloud() {
  const rows = await request('/rest/v1/pasanaku_workspaces?select=payload,version');
  version = rows[0]?.version || 0;
  return rows[0]?.payload || null;
}
export async function pushCloud(payload) {
  if (version === null) throw Error('Primero consulta el respaldo en línea para evitar sobrescribir cambios de otro dispositivo.');
  const result = await request('/rest/v1/rpc/save_pasanaku',{method:'POST',body:{p_payload:payload,p_expected:version}});
  version=result;return version;
}

export async function probeConnection() {
  await request('/auth/v1/health',{auth:false});
  return true;
}

// Stateless versioned operations for automatic synchronization.
export async function readRemote() {
  const rows=await request('/rest/v1/pasanaku_workspaces?select=payload,version');
  if(!Array.isArray(rows)||rows.length>1) throw Error('Supabase devolvió una copia inesperada.');
  const row=rows[0];
  if(row && (!Number.isSafeInteger(row.version)||row.version<1)) throw Error('Versión de respaldo inválida.');
  return row?{data:row.payload,version:row.version}:{data:null,version:0};
}
export async function writeRemote(payload, expected) {
  if(!Number.isSafeInteger(expected)||expected<0) throw Error('Falta comprobar la versión del respaldo.');
  const result=await request('/rest/v1/rpc/save_pasanaku',{method:'POST',body:{p_payload:payload,p_expected:expected}});
  if(result!==expected+1) throw Error('Supabase devolvió una versión inesperada. Vuelve a comprobar tu copia.');
  return result;
}
