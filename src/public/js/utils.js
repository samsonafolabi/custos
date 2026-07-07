function naira(amount) {
  if (amount == null) return "—";
  return (
    "₦" +
    Number(amount).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysOverdue(dueDate) {
  return Math.floor((Date.now() - new Date(dueDate)) / 86400000);
}

function makeBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "show " + type;
  setTimeout(() => {
    el.className = "";
  }, 3500);
}

function showView(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document
    .querySelectorAll("nav a")
    .forEach((a) => a.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.getElementById("nav-" + name).classList.add("active");
}

async function loadBalance() {
  try {
    const res = await fetch("/api/balance");
    const data = await res.json();

    const parentBal =
      data.parent?.availableBalance ?? data.parent?.ledgerBalance ?? 0;
    const subBal = data.sub?.availableBalance ?? data.sub?.ledgerBalance ?? 0;

    const parentEl = document.getElementById("balance-parent");
    const subEl = document.getElementById("balance-sub");

    if (parentEl) parentEl.textContent = naira(parentBal);
    if (subEl) subEl.textContent = naira(subBal);
  } catch (e) {
    console.error("Balance load failed:", e);
  }
}
