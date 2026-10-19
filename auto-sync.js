// Serializes saves and reconciles the device's acknowledged version before writing.
// A conflict is never resolved by overwriting another device automatically.
export const sameData = (a, b) => canonical(a) === canonical(b);
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function createAutoSync({initial, store, cloud, validate, onData=()=>{}, onState=()=>{}, canReplace=()=>true, online=()=>true, delay=600, retryDelay=5000}) {
  let doc = structuredClone(initial);
  let status = {kind:'local', message:'Guardado en este dispositivo. Inicia sesión para guardar en la nube.'};
  let running = null, timer = null, epoch = 0, stopped = false, failures = 0;
  const snapshot = () => structuredClone(doc);
  function emit(kind, message) { status={kind,message};onState({...status,dirty:doc.dirty}); }
  function write(next, replace=false) {
    store(structuredClone(next)); // Storage failure must not acknowledge or discard anything.
    doc=structuredClone(next);
    if(replace) onData(structuredClone(doc.data));
  }
  function schedule(ms=delay) {
    clearTimeout(timer);
    if(stopped) return;
    timer=setTimeout(()=>{timer=null;void reconcile();},ms);
  }
  function commit(data) {
    validate(data);
    write({...doc,data:structuredClone(data),dirty:true});
    emit(cloud.scope()?'pending':'local',cloud.scope()?'Cambios guardados en este dispositivo. Enviando a Supabase…':'Guardado en este dispositivo. Inicia sesión para guardar en la nube.');
    if(cloud.scope()) schedule();
  }
  async function perform() {
    const scope=cloud.scope(), generation=epoch;
    if(!scope) {emit('local','Guardado en este dispositivo. Inicia sesión para guardar en la nube.');return;}
    if(doc.owner && doc.owner!==scope) {emit('conflict','Esta copia pertenece a otra cuenta. Descarga un respaldo y carga la copia de la cuenta actual.');return;}
    if(!online()) {emit('offline','Sin conexión. Los cambios están en este dispositivo y se enviarán al volver a conectarte.');return;}
    emit('checking','Comprobando tu copia en Supabase…');
    try {
      const remote=await cloud.read();
      if(generation!==epoch || scope!==cloud.scope() || stopped) return;
      if(remote.data!==null) validate(remote.data);
      const equivalent=remote.data!==null && sameData(remote.data,doc.data);
      if(equivalent) {
        write({...doc,owner:scope,version:remote.version,dirty:false});
      } else if(doc.owner===scope && doc.version===remote.version) {
        // Acknowledged baseline matches. Only our local changes may be sent.
      } else if(!doc.dirty || (!doc.owner && !doc.data.groups.length)) {
        if(remote.data!==null) {
          if(!canReplace()) {emit('waiting','Hay datos nuevos en la nube. Se cargarán al cerrar el formulario actual.');return;}
          write({data:remote.data,owner:scope,version:remote.version,dirty:false},true);
        } else if(!doc.owner && !doc.data.groups.length) {
          write({...doc,owner:scope,version:0,dirty:false});
        } else {
          emit('conflict','La copia en la nube cambió. Descarga tu respaldo y revisa los datos antes de continuar.');return;
        }
      } else if(!doc.owner && (remote.data===null || !remote.data.groups.length)) {
        // First connection of an unowned, local-only workspace to an empty account.
        write({...doc,owner:scope,version:remote.version});
      } else {
        emit('conflict','Otro dispositivo guardó cambios. Tus cambios locales están protegidos: revisa las copias antes de continuar.');return;
      }
      while(doc.dirty) {
        const sending=snapshot();
        emit('saving','Guardando automáticamente en Supabase…');
        const version=await cloud.write(sending.data,sending.version);
        if(generation!==epoch || scope!==cloud.scope() || stopped) return;
        // Edits made during the request stay pending and are saved in the next iteration.
        write({...doc,owner:scope,version,dirty:!sameData(doc.data,sending.data)});
      }
      failures=0;emit('saved','Todos los cambios están guardados en Supabase.');
    } catch(error) {
      if(generation!==epoch || scope!==cloud.scope() || stopped) return;
      if(error.code==='conflict' || error.message.startsWith('Otro dispositivo')) {
        emit('conflict','Otro dispositivo guardó cambios. Tus cambios locales están protegidos: revisa las copias antes de continuar.');
      } else if(error.code==='auth' || !cloud.scope()) {
        emit('auth','Inicia sesión de nuevo. Los cambios siguen guardados en este dispositivo.');
      } else {
        emit('error','No se pudo guardar en la nube. Tus datos siguen aquí. ' + error.message);
        if(error instanceof TypeError || error.code==='network' || error.name==='TimeoutError' || error.status>=500) schedule(Math.min(60000,retryDelay * 2 ** Math.min(failures++,4)));
      }
    }
  }
  function reconcile() {
    clearTimeout(timer);timer=null;
    if(stopped) return Promise.resolve();
    if(running) return running;
    running=perform().finally(()=>{running=null;});
    return running;
  }
  async function previewRemote() {
    if(running) await running;
    const scope=cloud.scope(), remote=await cloud.read();
    if(scope!==cloud.scope()) throw Error('La sesión cambió. Vuelve a consultar tu copia.');
    if(remote.data!==null) validate(remote.data);
    return {...remote,owner:scope};
  }
  function useRemote(remote) {
    if(running) throw Error('Espera a que termine el guardado actual.');
    if(!remote.owner || remote.owner!==cloud.scope()) throw Error('La sesión cambió. Vuelve a consultar tu copia.');
    if(remote.data===null) throw Error('La cuenta todavía no tiene una copia para cargar.');
    validate(remote.data);epoch++;clearTimeout(timer);timer=null;
    write({data:remote.data,owner:remote.owner,version:remote.version,dirty:false},true);
    emit('saved','Copia de Supabase cargada. Todos los cambios están guardados.');
  }
  function connectionChanged() {
    epoch++;clearTimeout(timer);timer=null;
    emit(cloud.scope()?'checking':'local',cloud.scope()?'Comprobando tu copia en Supabase…':'Guardado en este dispositivo. Inicia sesión para guardar en la nube.');
    if(running) running.finally(()=>schedule(0));else schedule(0);
  }
  return {commit,reconcile,previewRemote,useRemote,connectionChanged,snapshot,status:()=>({...status,dirty:doc.dirty}),dispose:()=>{stopped=true;epoch++;clearTimeout(timer);}};
}
