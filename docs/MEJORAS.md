# Posibles mejoras pendientes

Propuestas tras la auditoría de octubre de 2026, ordenadas por lo que aportan.
Ninguna está empezada.

1. **Liquidez macro en el Score de Oportunidad.** El score no usa ningún dato
   macro. La liquidez neta de la Fed y el M2 son lo que más se ha movido con
   Bitcoin.
2. **Alertas.** Avisos en el móvil cuando cambie la fase del ciclo, cuando el
   Altseason Score cruce un tramo o cuando el Fear & Greed llegue a extremos.
   La app ya es instalable, así que es viable.
3. **Caché compartida en el servidor (por ejemplo, Upstash).** Ahora cada copia
   del servidor tiene la suya: tras un rato sin uso, el primero que entra
   espera a todas las fuentes y se gastan más llamadas a FRED y CoinGecko de
   las necesarias.
4. **Límite de peticiones más tolerante.** Es de 60 por minuto por IP. Varias
   personas en la misma red móvil o wifi comparten IP y podrían llegar al
   límite con Análisis abierto.
5. **Histórico del Score de Oportunidad y de la fase.** Un gráfico de cómo han
   evolucionado, para ver tendencia y no solo el valor de hoy.
6. **Altseason más reactivo.** El marcador se recalcula cada 30 min. Con los
   precios en vivo se podría actualizar la parte del score que depende del
   precio.
7. **Limpiar código sobrante.** El servidor sigue calculando una lista de
   ciclos (`history.cycles`) que la app ya no usa desde que se quitaron las
   comparaciones duplicadas.
