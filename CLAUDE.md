# Ciclos BTC Radar: normas del proyecto

Panel en español sobre el ciclo de Bitcoin (React + Vite + Tailwind; funciones de
Vercel en `api/`). Se publica en https://ciclos.cryptoatalaya.com.

## Interfaz

- **Fuera de Inicio, todo cuadro se pliega y se despliega.** En Ciclos (Ciclo BTC,
  Altseason, Comparativa), Temperatura, Análisis y Ajustes cada tarjeta es un
  `CollapsibleCard` (o `ChartCard`, que lo usa): nunca un `Card` suelto. Solo la
  pantalla de Inicio lleva tarjetas fijas. La prueba e2e «fuera de Inicio, todos
  los cuadros se pueden plegar» lo vigila.
- Cuadros abiertos de serie, salvo los de Ajustes que ya nacen cerrados.
- Todo se ve bien en claro y en oscuro (variables CSS de `html.dark`) y en el
  móvil (390 px) sin desbordar.
- **Escritorio (desde 1024 px): todo el ancho y bajar lo mínimo.** Las pestañas
  van en la barra superior (fija al bajar) y cada pestaña reparte sus tarjetas
  con `layout/Columnas` (2 columnas desde 1024 px, 3 desde 1536 px), cada una con
  su altura aproximada. En el móvil, una columna, igual que siempre: los cambios
  de escritorio van con `lg:` o por `Columnas`, nunca tocan el móvil. La prueba
  `e2e/escritorio.spec.ts` lo vigila.
- Las barras y termómetros líquidos comparten estilos `termo-*` de `index.css`;
  las animaciones se apagan con «reducir movimiento».

## Trabajo

- Ramas de trabajo `claude/*`; se publica llevando el commit a `main` (avance
  rápido) solo con la CI en verde, y se comprueba el despliegue de Vercel.
- **Publicar siempre al terminar cada cambio**, sin esperar a que lo pidan.
- Nada de maquetas temporales en los commits.
- Sin identificadores de modelo en commits ni en el código.
