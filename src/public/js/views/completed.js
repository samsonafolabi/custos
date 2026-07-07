async function loadCompleted() {
  try {
    const res = await fetch("/api/installments/completed");
    const data = await res.json();
    const installments = data.installments || [];
    const loans = data.loans || [];

    const totalCleared = installments.reduce(
      (s, i) => s + Number(i.amount_due),
      0,
    );
    const totalLoansCleared = loans.reduce(
      (s, l) => s + Number(l.principal_amount),
      0,
    );

    document.getElementById("stat-cleared-count").textContent =
      installments.length;
    document.getElementById("stat-cleared-value").textContent =
      naira(totalCleared);
    document.getElementById("stat-loans-cleared").textContent = loans.length;
    document.getElementById("completed-count").textContent =
      `${installments.length} cleared`;

    // Installments table
    if (installments.length === 0) {
      document.getElementById("completed-installments-wrap").innerHTML =
        `<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title">No cleared installments</div><div class="empty-sub">Paid installments will appear here</div></div>`;
    } else {
      const rows = installments
        .map((i) => {
          const b = i.loans?.borrowers;
          return `<tr>
          <td>
            <div style="font-weight:500">${b?.name || "—"}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${b?.phone || "—"}</div>
          </td>
          <td style="color:var(--muted);font-size:13px">Installment #${i.installment_number}</td>
          <td class="mono">${naira(i.amount_due)}</td>
          <td style="color:var(--muted);font-size:13px">${fmtDate(i.due_date)}</td>
        </tr>`;
        })
        .join("");

      document.getElementById("completed-installments-wrap").innerHTML =
        `<table>
           <thead><tr>
             <th>Borrower</th><th>Installment</th><th>Amount</th><th>Due Date</th>
           </tr></thead>
           <tbody>${rows}</tbody>
         </table>`;
    }

    // Cleared loans table
    if (loans.length === 0) {
      document.getElementById("completed-loans-wrap").innerHTML =
        `<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title">No fully cleared loans</div><div class="empty-sub">Loans with all installments paid will appear here</div></div>`;
    } else {
      const rows = loans
        .map((l) => {
          const b = l.borrowers;
          const totalRepay = l.installment_amount * l.num_installments;
          return `<tr>
          <td>
            <div style="font-weight:500">${b?.name || "Unknown"}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${b?.phone || "—"}</div>
          </td>
          <td class="mono">${naira(l.principal_amount)}</td>
          <td class="mono">${naira(totalRepay)}</td>
          <td style="color:var(--muted);font-size:13px">${l.num_installments}mo</td>
          <td class="mono">${fmtDate(l.start_date)}</td>
        </tr>`;
        })
        .join("");

      document.getElementById("completed-loans-wrap").innerHTML = `<table>
           <thead><tr>
             <th>Borrower</th><th>Principal</th><th>Total Repay</th><th>Term</th><th>Started</th>
           </tr></thead>
           <tbody>${rows}</tbody>
         </table>`;
    }
  } catch (e) {
    document.getElementById("completed-installments-wrap").innerHTML =
      `<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title">Failed to load</div><div class="empty-sub">${e.message}</div></div>`;
    document.getElementById("completed-loans-wrap").innerHTML = "";
  }
}
