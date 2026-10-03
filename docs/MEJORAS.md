# Mejoras

Propuestas tras la auditoría de octubre de 2026. **Todas hechas** (octubre de 2026):

1. **Liquidez macro en el Score de Oportunidad.** El bloque Liquidez suma la
   variación de la liquidez neta de la Fed (unas ocho semanas) y la M2
   interanual a las stablecoins.
2. **Alertas en el móvil (Web Push).** Cambio de fase, Altseason que cruza de
   tramo y Fear & Greed extremo. Ajustes → Alertas. Necesita Redis (Upstash).
3. **Caché compartida en Upstash Redis.** Se activa sola con
   `UPSTASH_REDIS_REST_URL`/`TOKEN` o `KV_REST_API_URL`/`TOKEN`.
4. **Límite de peticiones** por IP y ruta, 300 por minuto.
5. **Histórico diario del Score y de la fase**, en la pestaña Oportunidad.
   Necesita Redis.
6. **Altseason en vivo:** amplitud, ETH/BTC y score rehechos con el precio al
   contado cada 5 s.
7. **Limpieza:** fuera `history.cycles`.
