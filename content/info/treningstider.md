---
title: "Treningstider"
icon: "fa-clock"
icon_color: "#1565c0"
icon_bg: "#e3f2fd"
weight: 3
---

<div class="treningstider-page">

<div class="tt-hero">
  <div class="tt-hero-icon"><i class="far fa-clock"></i></div>
  <h1>Treningstider</h1>
  <p>Bærland barneskole – gymsalen</p>
</div>

<div class="tt-intro">
  <p>Treningene er tilpasset forskjellige grader slik at alle får en god treningsøkt.
     Du må være <strong>9 år</strong> for å begynne. Vi tar inn nye medlemmer i starten
     av et halvår. Alder er heller ingen hindring – det er aldri for sent å begynne
     med karate, men minimum alder er 9 år.</p>

  <p>Vi bruker <strong>SPOND</strong> til alle treninger og arrangementer.
     <a href="/info/pamelding/">Påmelding i SPOND gjør du her</a>.</p>
</div>

<div class="tt-obs">
  <div class="tt-obs-icon"><i class="far fa-clock"></i></div>
  <h2>OBS! Se Spond for detaljer</h2>
  <p>Kontroller <a href="/info/">Nyheter</a>,
     <a href="/treninger/">Terminliste</a>,
     <a href="/info/facebook/">Facebook</a>
     eller SPOND-appen for eventuelle endringer.</p>
</div>

<div class="tt-schedule">

  <div class="tt-day">
    <div class="tt-day-header tt-day-blue">
      <span>Mandag</span>
    </div>
    <div class="tt-slot">
      <div class="tt-slot-icon"><i class="far fa-clock"></i></div>
      <div class="tt-slot-time">18:00 – 19:00</div>
      <div class="tt-slot-group">Nybegynnere (9 år og oppover)<br>+ oransje belte</div>
    </div>
    <div class="tt-slot">
      <div class="tt-slot-icon"><i class="far fa-clock"></i></div>
      <div class="tt-slot-time">19:00 – 20:30</div>
      <div class="tt-slot-group">Alle graderte</div>
    </div>
  </div>

  <div class="tt-day">
    <div class="tt-day-header tt-day-blue">
      <span>Onsdag</span>
    </div>
    <div class="tt-slot">
      <div class="tt-slot-icon"><i class="far fa-clock"></i></div>
      <div class="tt-slot-time">18:00 – 19:00</div>
      <div class="tt-slot-group">Nybegynnere (9 år og oppover)<br>+ oransje belte</div>
    </div>
    <div class="tt-slot">
      <div class="tt-slot-icon"><i class="far fa-clock"></i></div>
      <div class="tt-slot-time">19:00 – 20:00</div>
      <div class="tt-slot-group">Alle graderte</div>
    </div>
  </div>

  <div class="tt-day">
    <div class="tt-day-header tt-day-red">
      <span>Torsdag</span>
    </div>
    <div class="tt-slot tt-slot-red">
      <div class="tt-slot-icon tt-slot-icon-red"><i class="far fa-clock"></i></div>
      <div class="tt-slot-time">19:00 – 20:00</div>
      <div class="tt-slot-group">Kamptrening</div>
    </div>
  </div>

</div>

</div>

<style>
  .treningstider-page { padding:0 16px 40px; color:#222; }

  /* Hero */
  .tt-hero {
    text-align:center;
    background:linear-gradient(135deg,#0d47a1 0%,#1565c0 100%);
    color:#fff;
    padding:28px 20px 24px;
    border-radius:14px;
    margin:16px 0 22px;
    box-shadow:0 4px 14px rgba(13,71,161,0.25);
  }
  .tt-hero-icon {
    width:64px; height:64px; margin:0 auto 12px;
    background:rgba(255,255,255,0.18);
    border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:30px;
  }
  .tt-hero h1 { font-size:26px; font-weight:800; margin:0 0 4px; letter-spacing:0.5px; }
  .tt-hero p { margin:0; font-size:15px; opacity:0.92; }

  /* Intro */
  .tt-intro p { font-size:15.5px; line-height:1.65; color:#333; margin:0 0 14px; }
  .tt-intro a { color:#1565c0; text-decoration:none; font-weight:600; }
  .tt-intro a:hover { text-decoration:underline; }

  /* OBS callout */
  .tt-obs {
    background:#fff8e1;
    border-left:5px solid #f57f17;
    border-radius:10px;
    padding:20px 18px;
    margin:22px 0;
    text-align:center;
  }
  .tt-obs-icon {
    width:52px; height:52px; margin:0 auto 10px;
    background:#f57f17; color:#fff;
    border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:24px;
    box-shadow:0 3px 8px rgba(245,127,23,0.35);
  }
  .tt-obs h2 { font-size:18px; font-weight:800; color:#e65100; margin:0 0 8px; }
  .tt-obs p { font-size:14.5px; line-height:1.6; color:#4e342e; margin:0; }
  .tt-obs a { color:#1565c0; text-decoration:none; font-weight:600; }
  .tt-obs a:hover { text-decoration:underline; }

  /* Schedule cards */
  .tt-schedule { display:grid; grid-template-columns:1fr; gap:18px; margin-top:8px; }
  .tt-day {
    background:#fff;
    border-radius:14px;
    overflow:hidden;
    box-shadow:0 2px 10px rgba(0,0,0,0.08);
    border:1px solid #eceff1;
  }
  .tt-day-header {
    color:#fff;
    padding:14px 18px;
    font-weight:800;
    font-size:18px;
    text-transform:uppercase;
    letter-spacing:1px;
    text-align:center;
  }
  .tt-day-blue { background:linear-gradient(135deg,#0d47a1,#1565c0); }
  .tt-day-red  { background:linear-gradient(135deg,#b71c1c,#c62828); }

  .tt-slot {
    text-align:center;
    padding:20px 18px;
    border-top:1px solid #eceff1;
  }
  .tt-slot:first-of-type { border-top:none; }
  .tt-slot-icon {
    width:52px; height:52px; margin:0 auto 10px;
    background:#e3f2fd; color:#1565c0;
    border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:22px;
  }
  .tt-slot-icon-red { background:#ffebee; color:#c62828; }
  .tt-slot-red .tt-slot-time { color:#b71c1c; }
  .tt-slot-time {
    font-size:20px;
    font-weight:800;
    color:#0d47a1;
    margin-bottom:6px;
    letter-spacing:0.3px;
  }
  .tt-slot-group {
    font-size:15px;
    line-height:1.5;
    color:#37474f;
    font-weight:500;
  }

  @media (min-width:720px) {
    .tt-schedule { grid-template-columns:repeat(2,1fr); }
    .tt-day:last-child { grid-column:1 / -1; max-width:420px; margin:0 auto; width:100%; }
  }
</style>
