export function initTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".panel[data-panel]"));

  function setActive(id) {
    for (const t of tabs) {
      const active = t.dataset.tab === id;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    }
    for (const p of panels) {
      p.classList.toggle("is-active", p.dataset.panel === id);
    }
  }

  for (const t of tabs) {
    t.addEventListener("click", () => setActive(t.dataset.tab));
  }
}

