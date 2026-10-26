# Pasanaku digital

Aplicación estática de administración de pasanaku en Bolivia. Interfaz en español, montos en BOB, fechas en America/La_Paz. No requiere instalar dependencias.

## Uso diario

1. Crear un grupo: nombres, aporte, multa acordada, frecuencia y primera fecha. No se precargan participantes ni se pide una hora límite.
2. En **Turnos**, sortear con la ruleta o ingresar una lista ya acordada. Cada persona recibe una vez y todos siguen aportando hasta el final. Los turnos asignados no se reemplazan.
3. En **Pagos**, elegir el turno y pulsar **Registrar pago** junto al nombre. Registra el aporte completo pendiente sin formulario. Para abonos antiguos, completa únicamente su saldo. El registro no mueve dinero: pulsarlo solo cuando el administrador ya recibió el pago.
4. Si hubo retraso, pulsar **Aplicar multa**. Solo el administrador la marca; no se aplica automáticamente por fecha u hora. Pulsar **Cobrar multa** cuando se reciba su importe. Aportes y multas se contabilizan por separado.
5. **Deshacer pago / Deshacer cobro / Quitar multa** corrigen errores y conservan su historial. No se puede deshacer un aporte que ya respaldó una entrega ni una multa cuyo dinero ya se utilizó.
6. Al completar todos los aportes, **Marcar fondo entregado** pide una confirmación breve, sin formulario. La fecha y hora de registro se guardan automáticamente. No se permite registrar la entrega antes de la fecha del turno.

La navegación principal tiene cuatro apartados: Inicio, Pagos, Turnos y Grupo. Ajustes y respaldo reúne la conexión, los respaldos y los accesos secundarios al resumen/PDF y al fondo de multas. Los detalles de movimientos quedan plegados por defecto.

## Compatibilidad y cálculos

- El dinero se calcula en centavos enteros. Las multas no completan el fondo de aportes.
- Semanal = cada 7 días; mensual = mismo día del mes, ajustado al último día si no existe; personalizado = intervalo entero de días.
- Los nuevos grupos usan multas manuales (`fineMode: manual`, `fineAssessments`). Una multa fija por persona y turno. Multa cero desactiva el botón.
- Los grupos anteriores se actualizan una sola vez: se conservan pagos, abonos, entregas, condonaciones e historial. Las multas ya acumuladas se convierten en registros explícitos; los turnos futuros dejan de generar multas automáticas. Se registra el cambio en el historial.
- La actualización de formato ocurre después de reconciliar la versión remota. Un conflicto no se resuelve sobrescribiendo registros. Los respaldos antiguos de esquema 2 siguen siendo compatibles.
- Los registros rápidos dejan el medio como «Sin especificar»; no inventan referencias bancarias ni afirman haber comprobado un depósito automáticamente. La fecha interna es la del registro.
- Los reportes incluyen los saldos y distinguen un orden acordado de uno sorteado. Preparar PDF abre el informe para imprimir o guardar como PDF.

## Desarrollo

`npm run dev` sirve la aplicación en http://127.0.0.1:5173. `npm test` ejecuta las pruebas de reglas, migración y sincronización. `npm run build` prepara `dist`. No requiere instalar dependencias. No abrir index.html como archivo.

## Guardado y respaldo

Cada cambio se guarda primero en localStorage y, con una sesión iniciada, se envía automáticamente a Supabase. La barra superior muestra si está guardando, al día o pendiente. Sin sesión, los cambios quedan solo en ese dispositivo. La sesión anterior de la ruleta no se migra a un grupo financiero porque no contenía acuerdos ni fechas. Exportar JSON guarda todos los grupos. Restaurar valida estructura y saldos y pide confirmar reemplazo. JSON contiene datos privados del grupo; guardarlo en un lugar seguro.

Los cambios pendientes, la cuenta propietaria y la última versión reconocida se conservan al recargar. Al recuperar conexión se vuelve a comprobar la nube antes de enviar. Si otro dispositivo guardó cambios, se conserva la copia local y se pide revisar las copias; no se mezclan ni sobrescriben registros automáticamente. Cambios nuevos durante un envío se guardan en un envío posterior. Al cerrar con cambios pendientes se muestra el aviso del navegador.

No usar dos pestañas para registrar a la vez: si una cambia los datos, la otra pide recargar. El guardado local no constituye una auditoría inalterable y no sustituye una cuenta de administrador.

## Supabase: proyecto configurado

La aplicación incluye un cliente REST sin dependencias y SQL con aislamiento por cuenta y control de versiones. El proyecto Pasanaku Digital ya está preparado en São Paulo. `config.js` contiene únicamente la URL y la clave pública publicable; no contiene contraseñas ni claves privadas. El modo local sigue funcionando sin sesión.

Para esta instalación ya se creó el proyecto, se aplicó el esquema y se desactivó el registro público. El administrador se crea desde el panel de Supabase. Para instalar en otro proyecto:

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en su SQL Editor.
3. Crear el usuario administrador en Authentication > Users (correo y contraseña). La web no ofrece registro público.
4. En Respaldo y conexión ingresar la URL `https://PROYECTO.supabase.co` y la clave pública publishable o anon. **Nunca usar service_role ni sb_secret.** Una configuración personalizada se guarda en el navegador; los tokens de sesión se guardan en sessionStorage y se renuevan al usar la conexión.
5. Iniciar sesión. En un dispositivo nuevo se carga la copia de Supabase automáticamente. Si la cuenta está vacía, los grupos locales se envían automáticamente. Si hay cambios incompatibles en ambas copias, se detiene el envío y se muestra el conflicto.
6. Registrar normalmente grupos, turnos, aportes, multas y entregas. No hay que pulsar Guardar en la nube: la barra indicará cuando todo esté guardado. Sincronizar ahora sirve para reintentar; Revisar copia de la nube permite descargar un respaldo local antes de reemplazarlo.
7. En otro dispositivo abrir la web e iniciar sesión con la misma cuenta. La copia remota se carga sola. La aplicación consulta actualizaciones al volver a la pestaña y cada 30 segundos mientras está visible; no reemplaza un formulario abierto. Una copia pendiente de otra cuenta nunca se envía a la cuenta nueva automáticamente.

Las políticas RLS solo permiten leer los datos de la cuenta autenticada. Las escrituras pasan por una función que obtiene auth.uid(), impide sobrescrituras de versiones y conserva un snapshot de cada versión en `pasanaku_versions`. Clientes no pueden editar directamente las tablas. Esos snapshots pueden recuperarse desde el panel de Supabase por el propietario del proyecto. El JSON es una primera arquitectura de un administrador por espacio; no incluye roles de participantes, verificación independiente del sorteo ni validación financiera completa en el servidor. Se ejecutó `supabase/verify.sql` en el proyecto remoto y pasó: aislamiento entre dos identidades autenticadas, bloqueo de lectura/escritura anónima, bloqueo de escritura directa, rechazo de versiones antiguas y conservación de snapshots. Los usuarios y registros de prueba se crearon dentro de una transacción que terminó con ROLLBACK; no quedaron cuentas ni datos ficticios. El inicio de sesión con la cuenta administradora, el primer guardado y la recuperación después de recargar la página se comprobaron correctamente desde la interfaz. El respaldo inicial está vacío: no se precargaron participantes ni movimientos financieros.

## Verificación

`npm test` comprueba pagos rápidos, multas manuales, correcciones, migración de registros antiguos, integridad de saldos, turnos y sincronización, incluidos conflictos y respuestas perdidas. `npm run build` prepara la carpeta pública sin dependencias externas.

## Publicar

GitHub + Netlify: el repositorio es `maycollopezh/Pasanaku-web` y la rama publicada es `main`. `netlify.toml` fija `npm run build` y publica `dist`. El build copia solo los 8 archivos de la aplicación; no publica pruebas, SQL, respaldos ni capturas de trabajo. Un push a la rama de producción vinculada activa el despliegue automático de Netlify. HTTPS lo proporciona el hosting. No subir secretos ni respaldos de grupos. Las tipografías de Google Fonts tienen fuentes locales de respaldo.

La aplicación es una herramienta de registro: no custodia dinero, no verifica depósitos ni firma acuerdos. La integridad del registro local depende del dispositivo y de quien administra el grupo.

## Investigación de referencia

- BancoSol: https://www.bancosol.com.bo/soluciones-digitales/servicios-digitales/pasanaku-digital
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth/passwords
