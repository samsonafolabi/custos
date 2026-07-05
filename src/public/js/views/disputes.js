async function loadDisputes() {
  try {
    const res = await fetch("/api/disputes");
    const disputes = await res.json();

    if (!Array.isArray(disputes)) {
      document.getElementById("disputes-table-wrap").innerHTML =
        `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">API Error</div><div class="empty-sub">${disputes.error || "Unexpected response"}</div></div>`;
      return;
    }

    const partial = disputes.filter((d) => d.type === "partial").length;
    const overpaid = disputes.filter((d) => d.type === "overpaid").length;
    const unmatched = disputes.filter((d) => d.type === "unmatched").length;

    document.getElementById("stat-open-disputes").textContent = disputes.length;
    document.getElementById("stat-partial").textContent = partial;
    document.getElementById("stat-overpaid").textContent = overpaid;
    document.getElementById("stat-unmatched").textContent = unmatched;
    document.getElementById("disputes-count").textContent =
      `${disputes.length} open`;

    const badgeEl = document.getElementById("disputes-badge");
    if (disputes.length > 0) {
      badgeEl.textContent = disputes.length;
      badgeEl.style.display = "inline";
    } else {
      badgeEl.style.display = "none";
    }

    if (disputes.length === 0) {
      document.getElementById("disputes-table-wrap").innerHTML =
        `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">No open disputes</div><div class="empty-sub">All payments matched cleanly</div></div>`;
      return;
    }

    const rows = disputes
      .map((d) => {
        const name = d.borrowers?.name || "Unknown";
        const amt = d.payments?.amount_received ?? 0;
        const sender = d.payments?.sender_name_raw || "—";
        const received = fmtDate(d.payments?.received_at);
        const conf = d.confidence_score ?? "—";
        const color =
          conf >= 80
            ? "var(--purple)"
            : conf >= 50
              ? "var(--yellow)"
              : "var(--danger)";
        return `<tr>
        <td>
          <div style="font-weight:500">${name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${d.borrowers?.phone || "—"}</div>
        </td>
        <td class="mono">${naira(amt)}</td>
        <td style="color:var(--muted);font-size:12px">${sender}</td>
        <td>${makeBadge(d.type)}</td>
        <td>
          <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:${color}">${conf}%</div>
          ${d.reasoning ? `<div class="reasoning-box"><div class="reasoning-label">AI Reasoning</div>${d.reasoning}</div>` : ""}
        </td>
        <td style="color:var(--muted);font-size:12px">${received}</td>
        <td>
          <button class="action-btn btn-reassign" onclick="resolveDispute('${d.id}','claimed','Claimed as partial payment')">Claim</button>
          <button class="action-btn btn-refund"   onclick="resolveDispute('${d.id}','refunded','Refund via Nomba')">Refund</button>
          <button class="action-btn btn-writeoff" onclick="resolveDispute('${d.id}','written_off','Written off')">Write Off</button>
        </td>
      </tr>`;
      })
      .join("");

    document.getElementById("disputes-table-wrap").innerHTML = `<table>
         <thead><tr>
           <th>Borrower</th><th>Amount</th><th>Sender</th>
           <th>Type</th><th>Confidence & Reasoning</th><th>Received</th><th>Actions</th>
         </tr></thead>
         <tbody>${rows}</tbody>
       </table>`;
  } catch (e) {
    document.getElementById("disputes-table-wrap").innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">Failed to load</div><div class="empty-sub">${e.message}</div></div>`;
  }
}

async function resolveDispute(id, action, notes) {
  try {
    const res = await fetch(`/api/disputes/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });
    const data = await res.json();
    if (data.success) {
      toast(`Dispute ${action} successfully`, "success");
      loadDisputes();
    } else {
      toast("Failed to resolve dispute", "error");
    }
  } catch (e) {
    toast("Network error — try again", "error");
  }
}
