async function loadDisbursements() {
  try {
    const res = await fetch("/api/disbursements");
    const loans = await res.json();

    if (!Array.isArray(loans)) {
      document.getElementById("disbursements-table-wrap").innerHTML =
        `<div class="empty-state"><div class="empty-icon">↗</div><div class="empty-title">API Error</div><div class="empty-sub">${loans.error || "Unexpected response"}</div></div>`;
      return;
    }

    const totalDisbursed = loans.reduce(
      (s, l) => s + Number(l.principal_amount),
      0,
    );
    const active = loans.filter((l) => l.status === "active").length;

    document.getElementById("stat-total-disbursed").textContent =
      naira(totalDisbursed);
    document.getElementById("stat-active-loans-count").textContent = active;
    document.getElementById("disbursements-count").textContent =
      `${loans.length} sent`;

    if (loans.length === 0) {
      document.getElementById("disbursements-table-wrap").innerHTML =
        `<div class="empty-state"><div class="empty-icon">↗</div><div class="empty-title">No disbursements yet</div><div class="empty-sub">Loans sent to borrowers will appear here</div></div>`;
      return;
    }

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
        <td>${makeBadge(l.status)}</td>
      </tr>`;
      })
      .join("");

    document.getElementById("disbursements-table-wrap").innerHTML = `<table>
         <thead><tr>
           <th>Borrower</th><th>Principal</th><th>Total Repay</th>
           <th>Term</th><th>Date</th><th>Status</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>`;
  } catch (e) {
    document.getElementById("disbursements-table-wrap").innerHTML =
      `<div class="empty-state"><div class="empty-icon">↗</div><div class="empty-title">Failed to load</div><div class="empty-sub">${e.message}</div></div>`;
  }
}
