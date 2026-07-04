// ── Nigerian banks list ──
const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "EcoBank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank (FCMB)" },
  { code: "058", name: "Guaranty Trust Bank (GTBank)" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "526", name: "Kuda Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "999992", name: "Opay" },
  { code: "999991", name: "PalmPay" },
  { code: "305", name: "Paycom (Opay)" },
];

// ── State ──
let _formData = {};

// ── Open / close ──
function openAddBorrowerModal() {
  _formData = {};
  renderStep1();
  document.getElementById("borrower-modal").classList.add("open");
}

function closeModal() {
  document.getElementById("borrower-modal").classList.remove("open");
}

// Close on overlay click
document.getElementById("borrower-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("borrower-modal")) closeModal();
});

// ── Step 1: Form ──
function renderStep1() {
  const bankOptions = NIGERIAN_BANKS.map(
    (b) => `<option value="${b.code}" data-name="${b.name}">${b.name}</option>`,
  ).join("");

  document.getElementById("modal-title").textContent = "New Borrower";
  document.getElementById("modal-sub").textContent =
    "Fill in borrower and loan details";
  document.getElementById("modal-steps-wrap").innerHTML =
    `<div class="step-dot active"></div><div class="step-dot"></div>`;

  document.getElementById("modal-body").innerHTML = `
    <div class="form-grid">
      <div class="form-group span-2">
        <label class="form-label">Full Name</label>
        <input class="form-input" id="f-name" placeholder="e.g. Chidinma Okafor" value="${_formData.name || ""}" />
      </div>
      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input class="form-input" id="f-phone" placeholder="+2348012345678" value="${_formData.phone || ""}" />
      </div>
      <div class="form-group">
        <label class="form-label">Loan Amount (₦)</label>
        <input class="form-input mono" id="f-principal" type="number" placeholder="60000" value="${_formData.principalAmount || ""}" />
      </div>
      <div class="form-group">
        <label class="form-label">Monthly Repayment (₦)</label>
        <input class="form-input mono" id="f-installment" type="number" placeholder="10000" value="${_formData.installmentAmount || ""}" />
      </div>
      <div class="form-group">
        <label class="form-label">Number of Months</label>
        <input class="form-input mono" id="f-months" type="number" placeholder="6" min="1" max="60" value="${_formData.numInstallments || ""}" />
      </div>
      <div class="form-group span-2">
        <label class="form-label">First Repayment Date</label>
        <input class="form-input" id="f-start" type="date" value="${_formData.startDate || ""}" />
        <span class="form-hint">First installment due on this date</span>
      </div>
      <div class="form-group span-2" style="border-top:1px solid var(--border);padding-top:14px;margin-top:2px">
        <label class="form-label">Disbursement Bank</label>
        <select class="form-select" id="f-bank">
          <option value="">Select bank...</option>
          ${bankOptions}
        </select>
      </div>
      <div class="form-group span-2">
        <label class="form-label">Account Number</label>
        <input class="form-input mono" id="f-account" placeholder="0123456789" maxlength="10" value="${_formData.recipientAccountNumber || ""}" />
        <span class="form-hint">Loan proceeds will be sent here</span>
      </div>
    </div>`;

  document.getElementById("modal-footer").innerHTML = `
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn-primary" onclick="goToReview()">Review Loan →</button>`;

  // Restore bank selection
  if (_formData.recipientBankCode) {
    document.getElementById("f-bank").value = _formData.recipientBankCode;
  }
}

// ── Validate + go to step 2 ──
function goToReview() {
  const name = document.getElementById("f-name").value.trim();
  const phone = document.getElementById("f-phone").value.trim();
  const principal = Number(document.getElementById("f-principal").value);
  const installment = Number(document.getElementById("f-installment").value);
  const months = Number(document.getElementById("f-months").value);
  const startDate = document.getElementById("f-start").value;
  const bankEl = document.getElementById("f-bank");
  const bankCode = bankEl.value;
  const bankName = bankEl.options[bankEl.selectedIndex]?.dataset.name || "";
  const account = document.getElementById("f-account").value.trim();

  if (
    !name ||
    !phone ||
    !principal ||
    !installment ||
    !months ||
    !startDate ||
    !bankCode ||
    !account
  ) {
    toast("Please fill in all fields", "error");
    return;
  }
  if (account.length !== 10) {
    toast("Account number must be 10 digits", "error");
    return;
  }

  _formData = {
    name,
    phone,
    principalAmount: principal,
    installmentAmount: installment,
    numInstallments: months,
    startDate,
    recipientBankCode: bankCode,
    recipientBankName: bankName,
    recipientAccountNumber: account,
  };

  renderStep2();
}

// ── Step 2: Review ──
function renderStep2() {
  const d = _formData;
  const endDate = new Date(d.startDate);
  endDate.setMonth(endDate.getMonth() + d.numInstallments);

  document.getElementById("modal-title").textContent = "Review & Confirm";
  document.getElementById("modal-sub").textContent =
    "Confirm before disbursing funds";
  document.getElementById("modal-steps-wrap").innerHTML =
    `<div class="step-dot done"></div><div class="step-dot active"></div>`;

  document.getElementById("modal-body").innerHTML = `
    <div class="disbursement-banner">
      <strong>₦${Number(d.principalAmount).toLocaleString()}</strong> will be sent immediately to
      <strong>${d.name}</strong>'s ${d.recipientBankName} account
      <strong class="mono">${d.recipientAccountNumber}</strong> upon confirmation.
      This action cannot be undone.
    </div>

    <div class="review-card">
      <div class="review-section">
        <div class="review-section-label">Borrower</div>
        <div class="review-row">
          <span class="review-key">Name</span>
          <span class="review-val">${d.name}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Phone</span>
          <span class="review-val mono">${d.phone}</span>
        </div>
      </div>
      <div class="review-section">
        <div class="review-section-label">Disbursement</div>
        <div class="review-row">
          <span class="review-key">Amount</span>
          <span class="review-val gold mono">₦${Number(d.principalAmount).toLocaleString()}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Destination</span>
          <span class="review-val mono">${d.recipientAccountNumber}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Bank</span>
          <span class="review-val">${d.recipientBankName}</span>
        </div>
      </div>
      <div class="review-section">
        <div class="review-section-label">Repayment Schedule</div>
        <div class="review-row">
          <span class="review-key">Monthly Payment</span>
          <span class="review-val accent mono">₦${Number(d.installmentAmount).toLocaleString()}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Term</span>
          <span class="review-val">${d.numInstallments} months</span>
        </div>
        <div class="review-row">
          <span class="review-key">First Due</span>
          <span class="review-val">${fmtDate(d.startDate)}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Final Due</span>
          <span class="review-val">${fmtDate(endDate.toISOString().split("T")[0])}</span>
        </div>
      </div>
    </div>`;

  document.getElementById("modal-footer").innerHTML = `
    <button class="btn-secondary" onclick="renderStep1()">← Back</button>
    <button class="btn-primary" id="confirm-btn" onclick="confirmDisburse()">Confirm & Disburse</button>`;
}

// ── Step 3: Disburse ──
async function confirmDisburse() {
  const btn = document.getElementById("confirm-btn");
  btn.disabled = true;
  btn.textContent = "Disbursing...";

  try {
    const res = await fetch("/api/borrowers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(_formData),
    });
    const data = await res.json();

    if (!data.success) {
      toast(data.error || "Disbursement failed", "error");
      btn.disabled = false;
      btn.textContent = "Confirm & Disburse";
      return;
    }

    renderSuccess(data);
  } catch (e) {
    toast("Network error — try again", "error");
    btn.disabled = false;
    btn.textContent = "Confirm & Disburse";
  }
}

// ── Success state ──
function renderSuccess(data) {
  document.getElementById("modal-title").textContent = "Loan Disbursed";
  document.getElementById("modal-sub").textContent =
    "Borrower onboarded successfully";
  document.getElementById("modal-steps-wrap").innerHTML = "";

  const firstDue = fmtDate(data.loan.startDate); // or calculate from installments if needed

  document.getElementById("modal-body").innerHTML = `
    <div class="success-state">
      <div class="success-icon">✓</div>
      <div class="success-title">${data.borrower.name}</div>
      <div class="success-sub">
        ₦${Number(data.loan.principalAmount).toLocaleString()} disbursed
      </div>
      
      <!-- Repayment schedule summary -->
      <div style="display: flex; gap: 12px; margin: 16px 0; justify-content: center;">
        <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 16px; text-align: center;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Monthly</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 600; color: var(--purple);">₦${Number(data.loan.installmentAmount).toLocaleString()}</div>
        </div>
        <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 16px; text-align: center;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">First Due</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 600; color: var(--yellow);">${firstDue}</div>
        </div>
        <div style="background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 16px; text-align: center;">
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Term</div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 600; color: var(--text);">${data.loan.numInstallments}mo</div>
        </div>
      </div>

      <!-- Repayment VA -->
      <div class="nuban-display" style="border-color: var(--purple); background: rgba(164,143,255,0.06);">
        <div>
          <div class="nuban-label">Repayment Account (share with borrower)</div>
          <div class="nuban-value">${data.borrower.bankAccountNumber}</div>
          <div class="nuban-bank">Nombank MFB · ${data.borrower.accountRef}</div>
        </div>
        <button onclick="navigator.clipboard.writeText('${data.borrower.bankAccountNumber}').then(()=>toast('Copied!','success'))"
          class="btn-secondary" style="padding:6px 12px;font-size:11px">Copy</button>
      </div>
      
      <div class="disbursement-banner" style="margin-top: 12px;">
        <strong>Next step:</strong> Share the repayment account above with ${data.borrower.name}. 
        All payments to this account will auto-reconcile against their loan.
      </div>
    </div>`;

  document.getElementById("modal-footer").innerHTML = `
    <button class="btn-primary" onclick="closeModal(); loadBorrowers();">View Portfolio</button>`;
}
