async function loadAging() {
  try {
    const res = await fetch("/api/aging");
    const items = await res.json();

    const total = items.reduce((s, i) => s + Number(i.amount_due), 0);
    const oldest = items.length ? daysOverdue(items[0].due_date) : 0;
    const atRisk = items.filter((i) => daysOverdue(i.due_date) > 30).length;

    document.getElementById("stat-total-overdue").textContent = items.length;
    document.getElementById("stat-amount-overdue").textContent = naira(total);
    document.getElementById("stat-oldest").textContent =
      oldest > 0 ? oldest : "0";
    document.getElementById("stat-at-risk").textContent = atRisk;
    document.getElementById("aging-count").textContent =
      `${items.length} overdue`;

    if (items.length === 0) {
      document.getElementById("aging-table-wrap").innerHTML =
        `<div class="empty-state"><div class="empty-icon">⏱</div><div class="empty-title">No overdue installments</div><div class="empty-sub">All installments are current</div></div>`;
      return;
    }

    const rows = items
      .map((i) => {
        const b = i.loans?.borrowers;
        const days = daysOverdue(i.due_date);
        const col =
          days > 60
            ? "var(--danger)"
            : days > 30
              ? "var(--warning)"
              : "var(--muted)";
        return `<tr>
        <td>
          <div style="font-weight:500">${b?.name || "—"}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${b?.phone || "—"}</div>
        </td>
        <td style="color:var(--muted);font-size:13px">Installment #${i.installment_number}</td>
        <td class="mono">${naira(i.amount_due)}</td>
        <td style="color:var(--muted);font-size:13px">${fmtDate(i.due_date)}</td>
        <td><span class="days-overdue" style="color:${col}">${days}d overdue</span></td>
        <td>${makeBadge(i.status)}</td>
      </tr>`;
      })
      .join("");

    document.getElementById("aging-table-wrap").innerHTML = `<table>
         <thead><tr>
           <th>Borrower</th><th>Installment</th><th>Amount Due</th>
           <th>Due Date</th><th>Days Overdue</th><th>Status</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>`;
  } catch (e) {
    document.getElementById("aging-table-wrap").innerHTML =
      `<div class="empty-state"><div class="empty-title">Failed to load</div><div class="empty-sub">${e.message}</div></div>`;
  }
}
