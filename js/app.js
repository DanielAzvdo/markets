const REFRESH_MS = {
  brazilStats: 5 * 60 * 1000,  // BCB series update at most daily; 5 min is plenty
  news: 3 * 60 * 1000          // headlines, refresh every 3 min
};

function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString("pt-BR", { hour12: false }) + " (hora local)";
}

function setStatus(ok) {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  dot.classList.remove("ok", "err");
  dot.classList.add(ok ? "ok" : "err");
  text.textContent = ok ? "dados atualizados" : "falha parcial ao atualizar";
}

async function refreshAll() {
  const ok = await refreshBrazilStats();
  await refreshNews();
  setStatus(ok);
}

document.addEventListener("DOMContentLoaded", () => {
  mountAllWidgets();

  updateClock();
  setInterval(updateClock, 1000);

  refreshAll();
  setInterval(refreshBrazilStats, REFRESH_MS.brazilStats);
  setInterval(refreshNews, REFRESH_MS.news);
});
