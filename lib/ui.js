"use strict";

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function promptModal({
  title,
  placeholder = "",
  isPassword = false,
  okLabel = "OK",
  cancelLabel = "Cancel"
}) {
  return new Promise((resolve) => {
    const element = document.createElement("div");
    element.className = "chatgpt-autocomment-modal";
    element.style.padding = "12px";

    element.innerHTML = `
      <div class="block" style="margin-bottom: 8px;">
        <div style="font-weight: 600; margin-bottom: 6px;">${escapeHtml(title)}</div>
      </div>
      <div class="block" style="margin-bottom: 10px;">
        <input class="input-text native-key-bindings" style="width: 100%;"
               type="${isPassword ? "password" : "text"}"
               placeholder="${escapeHtml(placeholder)}" />
      </div>
      <div class="block" style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn">${escapeHtml(cancelLabel)}</button>
        <button class="btn btn-primary">${escapeHtml(okLabel)}</button>
      </div>
    `;

    const input = element.querySelector("input");
    const buttons = element.querySelectorAll("button");
    const cancelBtn = buttons[0];
    const okBtn = buttons[1];

    const panel = atom.workspace.addModalPanel({ item: element });

    const cleanup = (value) => {
      try { panel.destroy(); } catch (_) {}
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => cleanup(null));
    okBtn.addEventListener("click", () => cleanup(input.value || null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") cleanup(input.value || null);
      if (e.key === "Escape") cleanup(null);
    });

    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

module.exports = { promptModal };
