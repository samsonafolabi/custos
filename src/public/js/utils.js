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
