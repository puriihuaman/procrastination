export function showDialog({ title, content, confirmLabel = "Guardar", cancelLabel = "Cancelar", onSubmit }) {
  const host = document.createElement("div");
  host.className = "fixed inset-0 z-20 grid place-items-center bg-[rgb(36_30_55_/_32%)] p-5";
  host.innerHTML = `<section class="w-full max-w-[470px] rounded-[10px] border border-[var(--line)] bg-[var(--card)] p-[25px] shadow-[0_20px_60px_rgb(46_36_78_/_18%)]" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">
    <div class="mb-5 flex items-center justify-between gap-3"><h2 id="dialog-title" class="m-0 text-[21px] font-semibold">${title}</h2><button type="button" class="border-0 bg-transparent text-[25px] leading-none text-[var(--muted)]" data-dialog-cancel aria-label="Cerrar">×</button></div>
    <form class="grid gap-[15px] [&_label]:grid [&_label]:gap-2 [&_label]:text-xs [&_label]:font-semibold [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[var(--line)] [&_input]:bg-[var(--card)] [&_input]:p-[11px] [&_input]:text-[13px] [&_input]:text-[var(--ink)] [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[var(--line)] [&_select]:bg-[var(--card)] [&_select]:p-[11px] [&_select]:text-[13px] [&_select]:text-[var(--ink)] [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-[var(--line)] [&_textarea]:bg-[var(--card)] [&_textarea]:p-[11px] [&_textarea]:text-[13px] [&_textarea]:text-[var(--ink)]">${content}<div class="mt-1 flex justify-end gap-2.5"><button type="button" class="outline-btn" data-dialog-cancel>${cancelLabel}</button><button type="submit" class="primary-btn">${confirmLabel}</button></div></form>
  </section>`;
  document.body.append(host);
  const closeOnEscape = (event) => { if (event.key === "Escape") close(); };
  const close = () => {
    document.removeEventListener("keydown", closeOnEscape);
    host.remove();
  };
  document.addEventListener("keydown", closeOnEscape);
  host.querySelectorAll("[data-dialog-cancel]").forEach((button) => button.addEventListener("click", close));
  host.addEventListener("click", (event) => { if (event.target === host) close(); });
  host.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit(new FormData(event.currentTarget), close);
  });
  host.querySelector("input, select, textarea")?.focus();
}

export function showConfirm({ title, message, confirmLabel = "Confirmar", onConfirm }) {
  showDialog({
    title,
    content: `<p class="dialog-message">${message}</p>`,
    confirmLabel,
    onSubmit: (_, close) => { close(); onConfirm(); },
  });
}
