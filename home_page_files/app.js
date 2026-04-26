const STORAGE_KEY = "readme-team-wrapper:code";
const STATUS_COOLDOWN_STORAGE_KEY = "readme-team-wrapper:status-cooldowns";

const redeemForm = document.querySelector("#redeem-form");
const emailForm = document.querySelector("#email-form");
const statusForm = document.querySelector("#status-form");

const redeemCodeInput = document.querySelector("#redeem-code");
const redeemEmailInput = document.querySelector("#redeem-email");
const redeemEmailConfirmedInput = document.querySelector("#redeem-email-confirmed");
const redeemEmailConfirmText = document.querySelector("#redeem-email-confirm-text");
const statusCodeInput = document.querySelector("#status-code");

const redeemMessage = document.querySelector("#redeem-message");
const statusMessage = document.querySelector("#status-message");
const redeemResult = document.querySelector("#redeem-result");
const statusResult = document.querySelector("#status-result");
const statusRaw = document.querySelector("#status-raw");
const statusOutput = document.querySelector("#status-output");

const checkButton = document.querySelector("#check-button");
const bindButton = document.querySelector("#bind-button");
const statusButton = document.querySelector("#status-button");

const useCurrentCodeButton = document.querySelector("#use-current-code");
const copyCurrentCodeButton = document.querySelector("#copy-current-code");
const copyWechatButtons = document.querySelectorAll("[data-copy-wechat]");

const SUPPORT_WECHAT = "Y2608302473";
const statusQueryCooldownByCode = new Map();

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getSavedCode() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

function saveCode(code) {
  const value = normalizeCode(code);
  if (value) {
    localStorage.setItem(STORAGE_KEY, value);
  }
  return value;
}

function saveStatusCooldowns() {
  const payload = Object.fromEntries(statusQueryCooldownByCode.entries());
  localStorage.setItem(STATUS_COOLDOWN_STORAGE_KEY, JSON.stringify(payload));
}

function loadStatusCooldowns() {
  try {
    const raw = localStorage.getItem(STATUS_COOLDOWN_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    Object.entries(parsed).forEach(([code, readyAt]) => {
      const normalizedCode = normalizeCode(code);
      const value = Math.max(Number(readyAt) || 0, 0);
      if (normalizedCode && value > Date.now()) {
        statusQueryCooldownByCode.set(normalizedCode, value);
      }
    });
  } catch {
    localStorage.removeItem(STATUS_COOLDOWN_STORAGE_KEY);
  }
}

function setMessage(element, type, text) {
  element.hidden = false;
  element.className = `message ${type}`;
  element.textContent = text;
}

function clearMessage(element) {
  element.hidden = true;
  element.className = "message";
  element.textContent = "";
}

function setResultCard(element, tone, html) {
  element.hidden = false;
  element.className = `result-card ${tone}`;
  element.innerHTML = html;
}

function clearResultCard(element) {
  element.hidden = true;
  element.className = "result-card";
  element.innerHTML = "";
}

function setLoading(button, loading, text) {
  button.dataset.loading = loading ? "true" : "false";
  button.disabled = loading;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    return;
  }
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.msg || "请求失败");
    error.code = data.code || "";
    error.retryAfterMs = Number(data.retryAfterMs) || 0;
    error.readyAt = Number(data.readyAt) || 0;
    throw error;
  }
  return data;
}

function setStatusQueryCooldown(code, readyAt) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) {
    return;
  }

  const value = Math.max(Number(readyAt) || 0, 0);
  if (!value) {
    statusQueryCooldownByCode.delete(normalizedCode);
    saveStatusCooldowns();
    return;
  }

  statusQueryCooldownByCode.set(normalizedCode, value);
  saveStatusCooldowns();
}

function getStatusQueryCooldownRemainingMs(code) {
  const normalizedCode = normalizeCode(code);
  const readyAt = statusQueryCooldownByCode.get(normalizedCode) || 0;
  if (!readyAt) {
    return 0;
  }

  const remainingMs = Math.max(readyAt - Date.now(), 0);
  if (!remainingMs) {
    statusQueryCooldownByCode.delete(normalizedCode);
    saveStatusCooldowns();
  }

  return remainingMs;
}

function formatCooldownSeconds(ms) {
  return Math.max(1, Math.ceil(ms / 1000));
}

function getCooldownMessage(ms) {
  return `刚提交兑换，请先等 ${formatCooldownSeconds(ms)} 秒左右再查状态，别马上连续请求服务器。`;
}

function updateStatusButtonCooldownState() {
  if (statusButton.dataset.loading === "true") {
    return;
  }

  const code = normalizeCode(statusCodeInput.value || getSavedCode());
  const cooldownRemainingMs = getStatusQueryCooldownRemainingMs(code);

  if (cooldownRemainingMs > 0) {
    statusButton.disabled = true;
    statusButton.textContent = `${formatCooldownSeconds(cooldownRemainingMs)} 秒后可查询`;
    statusButton.dataset.cooldownActive = "true";
    return;
  }

  if (statusButton.dataset.cooldownActive === "true") {
    statusButton.disabled = false;
    statusButton.textContent = "查询状态";
    delete statusButton.dataset.cooldownActive;
  }
}

function resetEmailInputs() {
  redeemEmailInput.value = "";
  redeemEmailConfirmedInput.checked = false;
  redeemEmailConfirmText.textContent = "我已确认上面的邮箱填写正确";
}

function updateEmailConfirmText() {
  const email = normalizeEmail(redeemEmailInput.value);
  redeemEmailConfirmText.textContent = email
    ? `我已确认邮箱 ${email} 填写正确`
    : "我已确认上面的邮箱填写正确";
}

function formatStatus(result) {
  return JSON.stringify(result, null, 2);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function describeRedeemStatus(status) {
  const map = {
    unused: "未使用",
    bound: "已绑定邮箱",
    consumed: "已兑换",
    disabled: "已失效",
  };
  return map[status] || status || "-";
}

function describeBizState(status) {
  const map = {
    new: "等待发送",
    processing: "邀请已发送",
    failed: "发送失败",
    pending: "邀请已发送",
    in_space: "已加入 Team",
    expired: "已过期",
  };
  return map[status] || status || "-";
}

function getResultTone(result) {
  if (!result?.valid || result?.redeemStatus === "disabled" || result?.bizState === "failed" || result?.bizState === "expired") {
    return "error";
  }
  if (result?.nextStep === "view_invite_status" || result?.redeemStatus === "bound" || result?.redeemStatus === "consumed") {
    return "warn";
  }
  return "success";
}

function getResultTitle(result) {
  if (!result?.valid) {
    return "兑换码无效";
  }
  if (result?.nextStep === "collect_email") {
    return "兑换码可继续兑换";
  }
  if (result?.redeemStatus === "consumed" && result?.bizState === "in_space") {
    return "该兑换码已完成兑换";
  }
  if (result?.nextStep === "view_invite_status") {
    return "邀请已发送，请留意查收";
  }
  return "兑换码状态已获取";
}

function getResultBadgeLabel(result) {
  if (!result?.valid) {
    return "无效";
  }
  if (result?.redeemStatus === "consumed") {
    return "已兑换";
  }
  if (result?.redeemStatus === "bound") {
    return "已绑定";
  }
  if (result?.redeemStatus === "disabled") {
    return "失效";
  }
  return "可兑换";
}

function getResultNote(result) {
  if (!result?.valid) {
    return `请核对兑换码是否输入正确。如你确认来源无误仍无法使用，请联系微信 ${SUPPORT_WECHAT}。`;
  }

  if (result?.nextStep === "collect_email") {
    return "这个兑换码当前可用，继续填写邮箱即可完成兑换。邮箱一旦绑定通常不能修改，请确认后再提交。";
  }

  if (result?.redeemStatus === "consumed" && result?.bizState === "in_space") {
    return `这个兑换码已经被使用，且关联账号已经加入 Team。若不是你本人操作，或需要售后核实，请联系微信 ${SUPPORT_WECHAT}。`;
  }

  if (result?.bizState === "pending" || result?.bizState === "processing") {
    return "邀请邮件通常已经发出，请留意收件箱和垃圾箱；如果暂时没看到，稍后再来查一次状态。";
  }

  if (result?.bizState === "failed" || result?.bizState === "expired") {
    return `当前记录异常，建议联系微信 ${SUPPORT_WECHAT} 处理。`;
  }

  return `如对当前状态有疑问，可联系微信 ${SUPPORT_WECHAT}。`;
}

function renderResultCard(result) {
  const tone = getResultTone(result);
  const title = getResultTitle(result);
  const badge = getResultBadgeLabel(result);
  const code = result?.code || getSavedCode() || "-";
  const rows = [
    ["兑换码", code],
    ["兑换状态", describeRedeemStatus(result?.redeemStatus)],
    ["处理状态", describeBizState(result?.bizState)],
    ["绑定账号", result?.usedBy || "-"],
    ["下一步", result?.nextStep || "-"],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <div class="detail-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `
    )
    .join("");

  return {
    tone,
    html: `
      <div class="result-head">
        <div>
          <strong class="result-title">${escapeHtml(title)}</strong>
        </div>
        <span class="badge ${tone}">${escapeHtml(badge)}</span>
      </div>
      <dl class="detail-grid">${rowsHtml}</dl>
      <div class="result-note">${escapeHtml(getResultNote(result))}</div>
    `,
  };
}

function syncInputsWithCurrentCode() {
  const currentCode = getSavedCode();
  if (currentCode) {
    redeemCodeInput.value = currentCode;
    statusCodeInput.value = currentCode;
  }
  updateStatusButtonCooldownState();
}

redeemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(redeemMessage);
  clearResultCard(redeemResult);
  emailForm.hidden = true;
  resetEmailInputs();

  const code = saveCode(redeemCodeInput.value);
  redeemCodeInput.value = code;
  statusCodeInput.value = code;

  if (!code) {
    setMessage(redeemMessage, "error", "请先输入兑换码。");
    return;
  }

  setLoading(checkButton, true, "检查中...");
  try {
    const data = await postJson("/api/check", { code });
    const result = data.result || {};
    const card = renderResultCard(result);
    setResultCard(redeemResult, card.tone, card.html);

    if (!result.valid) {
      const text =
        result.nextStep === "reenter_code"
          ? "兑换码无效，请重新输入。"
          : "该兑换码当前不可用，请联系客服。";
      setMessage(redeemMessage, "error", text);
      return;
    }

    if (result.nextStep === "collect_email") {
      setMessage(redeemMessage, "success", "兑换码有效，请填写邮箱，并勾选确认邮箱无误后再提交。");
      emailForm.hidden = false;
      redeemEmailInput.focus();
      return;
    }

    if (result.nextStep === "view_invite_status") {
      const message =
        result.redeemStatus === "consumed"
          ? "该兑换码已经使用过了，可以直接查看当前状态。"
          : "该兑换码已进入处理阶段，可以直接查状态。";
      setMessage(redeemMessage, "success", message);
      return;
    }

    setMessage(
      redeemMessage,
      "success",
      `兑换码检查通过。nextStep: ${result.nextStep || "unknown"}`
    );
  } catch (error) {
    setMessage(redeemMessage, "error", error.message);
  } finally {
    setLoading(checkButton, false);
  }
});

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(redeemMessage);

  const code = saveCode(redeemCodeInput.value);
  const email = normalizeEmail(redeemEmailInput.value);
  const emailConfirmed = redeemEmailConfirmedInput.checked;

  if (!code) {
    setMessage(redeemMessage, "error", "请先输入兑换码。");
    return;
  }

  if (!email) {
    setMessage(redeemMessage, "error", "请先输入邮箱。");
    return;
  }

  if (!emailConfirmed) {
    setMessage(redeemMessage, "error", "请先勾选确认邮箱填写正确，再提交兑换。");
    redeemEmailConfirmedInput.focus();
    return;
  }

  setLoading(bindButton, true, "提交中...");
  try {
    const data = await postJson("/api/bind-email", { code, email, emailConfirmed });
    const cooldownMs = Number(data.statusQueryCooldownMs) || 0;
    setStatusQueryCooldown(code, data.statusQueryReadyAt || Date.now() + cooldownMs);
    statusCodeInput.value = code;
    updateStatusButtonCooldownState();
    setMessage(
      redeemMessage,
      "success",
      `兑换请求已提交成功。为了避免把服务器压垮，请等待 ${formatCooldownSeconds(cooldownMs || 8000)} 秒左右再去下面查询状态。`
    );
    if (data.result) {
      const card = renderResultCard(data.result);
      setResultCard(redeemResult, card.tone, card.html);
    }
  } catch (error) {
    setMessage(redeemMessage, "error", error.message);
  } finally {
    setLoading(bindButton, false);
  }
});

redeemEmailInput.addEventListener("input", () => {
  redeemEmailConfirmedInput.checked = false;
  updateEmailConfirmText();
});

statusCodeInput.addEventListener("input", () => {
  updateStatusButtonCooldownState();
});

statusForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(statusMessage);
  clearResultCard(statusResult);
  statusRaw.hidden = true;
  statusRaw.open = false;
  statusOutput.textContent = "";

  const code = saveCode(statusCodeInput.value);
  statusCodeInput.value = code;
  redeemCodeInput.value = code;
  updateStatusButtonCooldownState();

  if (!code) {
    setMessage(statusMessage, "error", "请先输入兑换码。");
    return;
  }

  const cooldownRemainingMs = getStatusQueryCooldownRemainingMs(code);
  if (cooldownRemainingMs > 0) {
    setMessage(statusMessage, "error", getCooldownMessage(cooldownRemainingMs));
    return;
  }

  setLoading(statusButton, true, "查询中...");
  try {
    const data = await postJson("/api/status", { code });
    setMessage(statusMessage, "success", "状态查询成功。");
    if (data.result) {
      const card = renderResultCard(data.result);
      setResultCard(statusResult, card.tone, card.html);
    }
    statusRaw.hidden = false;
    statusOutput.textContent = formatStatus(data.result);
  } catch (error) {
    if (error.code === "STATUS_COOLDOWN" && error.readyAt) {
      setStatusQueryCooldown(code, error.readyAt);
      updateStatusButtonCooldownState();
      setMessage(statusMessage, "error", getCooldownMessage(error.retryAfterMs || getStatusQueryCooldownRemainingMs(code)));
      return;
    }
    setMessage(statusMessage, "error", error.message);
  } finally {
    setLoading(statusButton, false);
  }
});

useCurrentCodeButton.addEventListener("click", () => {
  redeemCodeInput.value = getSavedCode();
});

copyCurrentCodeButton.addEventListener("click", () => {
  statusCodeInput.value = getSavedCode();
  updateStatusButtonCooldownState();
});

copyWechatButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const originalText = button.textContent;
    try {
      await navigator.clipboard.writeText(SUPPORT_WECHAT);
      button.textContent = "已复制";
      setTimeout(() => {
        button.textContent = originalText;
      }, 1200);
    } catch {
      setMessage(statusMessage, "error", `复制失败，请手动添加微信 ${SUPPORT_WECHAT}`);
    }
  });
});

loadStatusCooldowns();
syncInputsWithCurrentCode();
setInterval(updateStatusButtonCooldownState, 500);
