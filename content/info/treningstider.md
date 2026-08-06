---
title: "Treningstider"
icon: "fa-clock"
icon_color: "#1565c0"
icon_bg: "#e3f2fd"
weight: 3
---

<div class="treningstider-page">

<div class="info-banner">
  <i class="fas fa-map-marker-alt"></i>
  <div>
    <strong>Bærland skole – gymsalen</strong>
    <p>Ålgård, Sandnes</p>
  </div>
</div>

<p style="font-size:14px;line-height:1.6;color:#444;margin-bottom:18px;">
Faste treningstider gjennom sesongen. Enkelttreninger kan bli flyttet eller avlyst –
sjekk alltid <a href="/treninger/" style="color:#1565c0;text-decoration:none;">kalenderen</a>
for oppdatert oversikt.
</p>

<div class="schedule-grid">

  <div class="schedule-day">
    <div class="schedule-day-header" style="background:#1565c0;">
      <i class="fas fa-calendar-day"></i>
      <span>Mandag</span>
    </div>
    <div class="schedule-slot">
      <div class="schedule-time">18:00 – 19:00</div>
      <div class="schedule-group">Nybegynnere, 10. kyu og 9. kyu</div>
    </div>
    <div class="schedule-slot">
      <div class="schedule-time">19:00 – 20:30</div>
      <div class="schedule-group">8. kyu og oppover</div>
    </div>
  </div>

  <div class="schedule-day">
    <div class="schedule-day-header" style="background:#1565c0;">
      <i class="fas fa-calendar-day"></i>
      <span>Onsdag</span>
    </div>
    <div class="schedule-slot">
      <div class="schedule-time">18:00 – 19:00</div>
      <div class="schedule-group">Nybegynnere, 10. kyu og 9. kyu</div>
    </div>
    <div class="schedule-slot">
      <div class="schedule-time">19:00 – 20:00</div>
      <div class="schedule-group">8. kyu og oppover</div>
    </div>
  </div>

  <div class="schedule-day">
    <div class="schedule-day-header" style="background:#c62828;">
      <i class="fas fa-fist-raised"></i>
      <span>Torsdag</span>
    </div>
    <div class="schedule-slot">
      <div class="schedule-time">19:00 – 20:00</div>
      <div class="schedule-group">Kamptrening – kun for inviterte</div>
    </div>
  </div>

</div>

</div>

<style>
  .treningstider-page { padding: 0 16px 40px; }
  .info-banner { display:flex; gap:12px; align-items:flex-start; background:#e3f2fd; border-left:4px solid #1565c0; padding:12px 14px; border-radius:6px; margin:16px 0; }
  .info-banner i { color:#1565c0; font-size:1.2rem; margin-top:2px; }
  .info-banner strong { display:block; font-size:14px; color:#0d47a1; }
  .info-banner p { margin:2px 0 0; font-size:13px; color:#333; }

  .schedule-grid { display:grid; grid-template-columns:1fr; gap:14px; }
  .schedule-day { background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  .schedule-day-header { display:flex; align-items:center; gap:10px; color:#fff; padding:10px 14px; font-weight:700; font-size:15px; }
  .schedule-day-header i { font-size:0.95rem; }
  .schedule-slot { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border-top:1px solid #f0f0f0; }
  .schedule-slot:first-of-type { border-top:none; }
  .schedule-time { font-weight:700; color:#1565c0; font-size:14px; white-space:nowrap; }
  .schedule-group { font-size:13.5px; color:#333; text-align:right; }

  @media (min-width: 640px) {
    .schedule-grid { grid-template-columns:repeat(2, 1fr); }
    .schedule-day:last-child { grid-column:1 / -1; }
  }
</style>
