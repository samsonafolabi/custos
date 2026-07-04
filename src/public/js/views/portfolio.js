async function loadBorrowers() {
  try {
    const res = await fetch("/api/portfolio");
    const borrowers = await res.json();

    let totalCollected = 0,
      totalDue = 0,
      activeLoans = 0;

    const rows = borrowers
      .map((b) => {
        const loan = b.loans?.[0];
        if (!loan) return "";
        const inst = loan.installments || [];
        const paid = inst.filter((i) => i.status === "paid").length;
        const total = inst.length;
        const collected = paid * loan.installment_amount;
        const due = total * loan.installment_amount;
        const pct = total ? Math.round((paid / total) * 100) : 0;
        totalCollected += collected;
        totalDue += due;
        if (loan.status === "active") activeLoans++;
        const next = inst
          .filter((i) => i.status === "pending" || i.status === "partial")
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
        const nextDue = next ? fmtDate(next.due_date) : "Complete";
        const overdue = next && new Date(next.due_date) < new Date();
        return `<tr>
        <td>
          <div style="font-weight:500">${b.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${b.phone || "—"}</div>
        </td>
        <td class="mono">${naira(loan.principal_amount)}</td>
        <td>
          <div class="progress-wrap">
            <div class="progress-label">${paid}/${total} installments</div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        </td>
        <td class="mono">${naira(collected)}</td>
        <td class="mono" style="color:var(--muted)">${naira(due - collected)}</td>
        <td style="color:${overdue ? "var(--danger)" : "var(--muted)"};font-size:13px">${nextDue}</td>
        <td>${makeBadge(loan.status)}</td>
      </tr>`;
      })
      .join("");

    document.getElementById("stat-total-borrowers").textContent =
      borrowers.length;
    document.getElementById("stat-active-loans").textContent = activeLoans;
    document.getElementById("stat-collected").textContent =
      naira(totalCollected);
    document.getElementById("stat-outstanding").textContent = naira(
      totalDue - totalCollected,
    );
    document.getElementById("borrower-count").textContent =
      `${borrowers.length} borrowers`;

    document.getElementById("borrowers-table-wrap").innerHTML =
      borrowers.length === 0
        ? `<div class="empty-state">
           <div class="empty-icon">◈</div>
           <div class="empty-title">No borrowers yet</div>
           <div class="empty-sub">Click "Add Borrower" to disburse your first loan</div>
         </div>`
        : `<table>
           <thead><tr>
             <th>Borrower</th><th>Principal</th><th>Progress</th>
             <th>Collected</th><th>Outstanding</th><th>Next Due</th><th>Status</th>
           </tr></thead>
           <tbody>${rows}</tbody>
         </table>`;
  } catch (e) {
    document.getElementById("borrowers-table-wrap").innerHTML =
      `<div class="empty-state"><div class="empty-title">Failed to load</div><div class="empty-sub">${e.message}</div></div>`;
  }
}
