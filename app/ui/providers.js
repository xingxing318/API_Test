export function renderProviderOptions(selectEl, providers) {
  selectEl.innerHTML = "";
  for (const p of providers) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    selectEl.appendChild(opt);
  }
}

export function getSelectedProviderId(selectEl) {
  return selectEl.value;
}

