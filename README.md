# La ruleta

Página estática en español, adaptable a celular y computadora. Sin dependencias ni compilación.

## Uso

1. Escribe un nombre por línea (también acepta comas o punto y coma).
2. Pulsa **Guardar nombres** y luego **Girar la ruleta**.
3. Pulsa **Aceptar y continuar** para retirar el nombre y registrar su puesto.
4. Repite hasta terminar. **Descargar lista** guarda el historial como texto.

La lista y el sorteo se guardan en el navegador. Al recargar con un resultado pendiente, vuelve a mostrarse el mismo resultado. Durante un sorteo la lista queda bloqueada; **Empezar de nuevo** repone a todos y permite editarla.

## Regla del segundo puesto

Si está presente Maycol, Maicol, Maycol Lopez o Maicol Lopez, una de esas entradas se reserva para el segundo puesto. Se ignoran mayúsculas, acentos y espacios repetidos. El primer puesto se elige aleatoriamente entre los demás nombres y después del segundo todos los restantes se eligen aleatoriamente.

Si hay varias variantes, una se elige aleatoriamente para el segundo puesto. Los nombres repetidos son entradas independientes. Si todos son variantes reservadas, necesariamente también saldrá una en primer lugar. Con un único participante solo existe el primer puesto. Esta ruleta incluye una regla programada y no es un sorteo completamente aleatorio; el código del navegador es público.

## Vista local

Ejecuta `npm run dev` o `python3 -m http.server 5173` y abre http://localhost:5173. No requiere instalar paquetes. Abre la página mediante el servidor porque utiliza módulos de JavaScript.

## Comprobación

`npm test` verifica la selección del segundo puesto, las variantes y casos límite.

## GitHub y Netlify

Sube esta carpeta a un repositorio de GitHub. En Netlify elige **Import an existing project**, conecta ese repositorio y deja vacío el comando de compilación. El directorio de publicación es `.` y ya está indicado en `netlify.toml`.

El historial queda en cada navegador; no se comparte entre dispositivos. Las tipografías vienen de Google Fonts, con fuentes locales de respaldo cuando no hay conexión.
# Pasanaku-web
