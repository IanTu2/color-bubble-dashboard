(() => {
  "use strict";

  const CONFIGURED = Boolean(window.APP_CONFIG?.SUPABASE_URL && window.APP_CONFIG?.SUPABASE_PUBLISHABLE_KEY && window.supabase);
  const client = CONFIGURED
    ? window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_PUBLISHABLE_KEY)
    : null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const dateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const addDays = (base, amount) => {
    const copy = new Date(base);
    copy.setDate(copy.getDate() + amount);
    return copy;
  };
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  const translations = {
    zh: {
      learning: "學習", english: "英文", vocabulary: "單字", game: "遊戲", games: "遊戲", math: "數學",
      comingSoon: "即將推出", loginToUnlock: "登入後即可使用學習選單、月曆與待辦事項。", language: "語言",
      guestMode: "訪客模式", memberMode: "個人空間", logout: "登出", welcome: "歡迎來到你的個人空間",
      makeTodayCount: "讓今天成為有進展的一天", calendar: "月曆", toDo: "待辦事項", upcoming: "即將到來",
      accountTitle: "開始你的專屬空間", accountSubtitle: "登入後，行程、待辦與學習進度都會留在這裡。",
      login: "登入", register: "註冊", email: "Email", password: "密碼", displayName: "顯示名稱",
      sendCode: "寄送驗證碼", verificationCode: "Email 驗證碼", verifyAndCreate: "驗證並建立帳號", back: "返回修改資料",
      previewMode: "尚未設定雲端服務，可先預覽登入後畫面", previewLogin: "體驗登入", today: "今日", twoDays: "兩天內",
      sevenDays: "七天內", thirtyDays: "30 天內", noTasks: "目前沒有待辦事項", addTask: "新增待辦", taskName: "待辦名稱",
      dueDate: "截止日期", add: "新增", aiSoon: "AI 助理已就位，對話功能會在下一階段開放。", previewUser: "預覽使用者",
      previewNotice: "目前是預覽模式，資料只會保存在這台裝置。", loginSuccess: "登入成功。", logoutSuccess: "已安全登出。",
      configNeeded: "帳號服務尚未設定。請先完成 README 的 Supabase 設定，或使用體驗登入。",
      codeSent: "驗證碼已寄到 {email}，請查看收件匣與垃圾郵件。", accountCreated: "帳號建立完成，歡迎加入！",
      invalidOtp: "請輸入 Email 中的數字驗證碼。",
      calendarDetail: "完整月曆", calendarHint: "有色標記代表當天有待辦事項。", todoDetail: "所有待辦事項",
      todoHint: "新增、完成或刪除項目；雲端啟用後會自動同步。", sectionSoon: "這個學習區已預留完成，內容將在下一次更新加入。",
      delete: "刪除", taskAdded: "待辦事項已新增。", taskDeleted: "待辦事項已刪除。", saveFailed: "儲存失敗，請稍後再試。",
      weekdays: ["日", "一", "二", "三", "四", "五", "六"]
    },
    en: {
      learning: "Learning", english: "English", vocabulary: "Vocabulary", game: "Game", games: "Games", math: "Math",
      comingSoon: "Coming soon", loginToUnlock: "Sign in to unlock learning, calendar, and to-dos.", language: "Language",
      guestMode: "Guest mode", memberMode: "Personal space", logout: "Log out", welcome: "Welcome to your personal space",
      makeTodayCount: "Make today a day of progress", calendar: "Calendar", toDo: "To-do", upcoming: "Coming up",
      accountTitle: "Enter your personal space", accountSubtitle: "Your schedule, to-dos, and learning progress live here.",
      login: "Log in", register: "Register", email: "Email", password: "Password", displayName: "Display name",
      sendCode: "Send verification code", verificationCode: "Email verification code", verifyAndCreate: "Verify & create account", back: "Edit details",
      previewMode: "Cloud service is not configured; preview the member view", previewLogin: "Preview login", today: "Today", twoDays: "Within 2 days",
      sevenDays: "Within 7 days", thirtyDays: "Within 30 days", noTasks: "No to-dos yet", addTask: "Add to-do", taskName: "Task name",
      dueDate: "Due date", add: "Add", aiSoon: "Your AI assistant is ready. Chat will arrive in the next update.", previewUser: "Preview user",
      previewNotice: "Preview mode: data is saved only on this device.", loginSuccess: "You're signed in.", logoutSuccess: "You're safely logged out.",
      configNeeded: "Account service is not configured. Follow the Supabase setup in README, or use preview login.",
      codeSent: "We sent a code to {email}. Check your inbox and spam folder.", accountCreated: "Your account is ready. Welcome!",
      invalidOtp: "Enter the numeric code from the email.",
      calendarDetail: "Full calendar", calendarHint: "Colored labels indicate due tasks.", todoDetail: "All to-dos",
      todoHint: "Add, complete, or delete items. Cloud sync starts when configured.", sectionSoon: "This learning area is reserved and ready for content in a future update.",
      delete: "Delete", taskAdded: "To-do added.", taskDeleted: "To-do deleted.", saveFailed: "Could not save. Please try again.",
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    }
  };

  let lang = localStorage.getItem("bubble-language") || "zh";
  let currentUser = null;
  let previewSession = localStorage.getItem("bubble-preview-session") === "true";
  let calendarCursor = new Date();
  let registerDraft = null;
  let todos = [];
  let toastTimer;

  const t = (key) => translations[lang][key] ?? key;

  function setLanguage(next) {
    lang = next;
    localStorage.setItem("bubble-language", lang);
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    $$('[data-i18n]').forEach((node) => {
      const value = translations[lang][node.dataset.i18n];
      if (typeof value === "string") node.textContent = value;
    });
    $$(".language-option").forEach((button) => button.classList.toggle("active", button.dataset.lang === lang));
    updateClock();
    renderCalendarCard();
    renderTodoCard();
    if ($("#detailDialog").open) $("#detailDialog").close();
  }

  function updateClock() {
    const now = new Date();
    const locale = lang === "zh" ? "zh-TW" : "en-US";
    $("#clock").textContent = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    $("#clock").dateTime = now.toISOString();
    $("#date").textContent = new Intl.DateTimeFormat(locale, {
      year: "numeric", month: "long", day: "numeric", weekday: "long"
    }).format(now);
  }

  function createBubbles() {
    const layer = $("#bubbleLayer");
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 24; index += 1) {
      const bubble = document.createElement("span");
      bubble.className = "bubble";
      bubble.style.setProperty("--size", `${18 + Math.random() * 78}px`);
      bubble.style.setProperty("--left", `${Math.random() * 98}%`);
      bubble.style.setProperty("--duration", `${13 + Math.random() * 16}s`);
      bubble.style.setProperty("--delay", `${Math.random() * -26}s`);
      bubble.style.setProperty("--sway", `${-60 + Math.random() * 120}px`);
      bubble.style.setProperty("--sway-end", `${-60 + Math.random() * 120}px`);
      bubble.style.setProperty("--opacity", `${0.18 + Math.random() * 0.42}`);
      fragment.appendChild(bubble);
    }
    layer.appendChild(fragment);
  }

  function openDrawer() {
    $("#sideDrawer").classList.add("open");
    $("#sideDrawer").setAttribute("aria-hidden", "false");
    $("#drawerTrigger").setAttribute("aria-expanded", "true");
    $("#drawerBackdrop").hidden = false;
  }

  function closeDrawer() {
    $("#sideDrawer").classList.remove("open");
    $("#sideDrawer").setAttribute("aria-hidden", "true");
    $("#drawerTrigger").setAttribute("aria-expanded", "false");
    $("#drawerBackdrop").hidden = true;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    const toast = $("#toast");
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function showAuthMessage(message, success = false) {
    const box = $("#authMessage");
    box.textContent = message;
    box.classList.toggle("success", success);
    box.hidden = !message;
  }

  function switchAuthTab(tab) {
    $$("[data-auth-tab]").forEach((button) => {
      const active = button.dataset.authTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    $("#loginForm").hidden = tab !== "login";
    $("#registerForm").hidden = tab !== "register";
    showAuthMessage("");
  }

  function openAuth() {
    if (currentUser || previewSession) {
      const menu = $("#profileMenu");
      menu.hidden = !menu.hidden;
      $("#profileButton").setAttribute("aria-expanded", String(!menu.hidden));
      return;
    }
    $("#authDialog").showModal();
  }

  function getUserName() {
    if (previewSession) return t("previewUser");
    return currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "Member";
  }

  function renderAuthState() {
    const loggedIn = Boolean(currentUser || previewSession);
    $("#memberDashboard").hidden = !loggedIn;
    $("#memberNav").hidden = !loggedIn;
    $("#guestDrawerNote").hidden = loggedIn;
    $("#robotButton").hidden = !loggedIn;
    $("#profileBadge").hidden = !loggedIn;
    $("#statusPill").classList.toggle("member", loggedIn);
    $("#statusPill").lastElementChild.textContent = loggedIn ? t("memberMode") : t("guestMode");
    if (loggedIn) {
      const email = previewSession ? t("previewNotice") : currentUser.email;
      $("#profileBadge").textContent = getUserName().slice(0, 1).toUpperCase();
      $("#profileSummary").innerHTML = `<strong>${escapeHtml(getUserName())}</strong><span>${escapeHtml(email)}</span>`;
      ensureTodos();
    } else {
      $("#profileMenu").hidden = true;
      todos = [];
    }
    renderCalendarCard();
    renderTodoCard();
  }

  function defaultTodos() {
    const now = new Date();
    return [
      { id: `demo-${Date.now()}-1`, title: lang === "zh" ? "整理今日學習筆記" : "Review today's notes", due_date: dateKey(now), completed: false },
      { id: `demo-${Date.now()}-2`, title: lang === "zh" ? "複習英文單字" : "Review vocabulary", due_date: dateKey(addDays(now, 2)), completed: false },
      { id: `demo-${Date.now()}-3`, title: lang === "zh" ? "完成數學練習" : "Finish math practice", due_date: dateKey(addDays(now, 6)), completed: false },
      { id: `demo-${Date.now()}-4`, title: lang === "zh" ? "規劃本月學習目標" : "Plan monthly learning goals", due_date: dateKey(addDays(now, 18)), completed: false }
    ];
  }

  async function ensureTodos() {
    if (previewSession) {
      const stored = JSON.parse(localStorage.getItem("bubble-preview-todos") || "null");
      todos = Array.isArray(stored) ? stored : defaultTodos();
      persistPreviewTodos();
      renderCalendarCard();
      renderTodoCard();
      return;
    }
    if (!client || !currentUser) return;
    const { data, error } = await client.from("todos").select("id,title,due_date,completed,created_at").order("due_date", { ascending: true });
    if (error) {
      showToast(t("saveFailed"));
      return;
    }
    todos = data || [];
    renderCalendarCard();
    renderTodoCard();
  }

  function persistPreviewTodos() {
    if (previewSession) localStorage.setItem("bubble-preview-todos", JSON.stringify(todos));
  }

  function taskCounts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = todos.filter((todo) => !todo.completed);
    const within = (days, start = 0) => active.filter((todo) => {
      const due = new Date(`${todo.due_date}T00:00:00`);
      const difference = Math.round((due - today) / 86400000);
      return difference >= start && difference <= days;
    }).length;
    return [within(0), within(2, 0), within(7, 0), within(30, 0)];
  }

  function renderTodoCard() {
    if (!$("#todoBuckets")) return;
    const counts = taskCounts();
    const labels = [t("today"), t("twoDays"), t("sevenDays"), t("thirtyDays")];
    $("#todoBuckets").innerHTML = counts.map((count, index) => `<div class="todo-bucket"><strong>${count}</strong><span>${escapeHtml(labels[index])}</span></div>`).join("");
    const pending = todos.filter((todo) => !todo.completed).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 3);
    $("#todoPreview").innerHTML = pending.length
      ? pending.map((todo) => `<div class="todo-row"><span class="todo-check"></span><span>${escapeHtml(todo.title)}</span><time>${escapeHtml(todo.due_date.slice(5).replace("-", "/"))}</time></div>`).join("")
      : `<div class="empty-state">${escapeHtml(t("noTasks"))}</div>`;
  }

  function monthLabel(date) {
    return new Intl.DateTimeFormat(lang === "zh" ? "zh-TW" : "en-US", { year: "numeric", month: "long" }).format(date);
  }

  function calendarCells(date, detailed = false) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const today = dateKey(new Date());
    const weekdayCells = translations[lang].weekdays.map((day) => `<span class="${detailed ? "day " : ""}weekday">${day}</span>`);
    const cells = Array.from({ length: first }, () => `<span class="${detailed ? "day " : ""}empty"></span>`);
    for (let number = 1; number <= total; number += 1) {
      const current = dateKey(new Date(year, month, number));
      const dailyTasks = todos.filter((todo) => todo.due_date === current && !todo.completed);
      const classes = [current === today ? "today" : "", dailyTasks.length ? "has-task" : ""].filter(Boolean).join(" ");
      const taskTags = detailed ? dailyTasks.slice(0, 2).map((todo) => `<small class="calendar-task-dot">${escapeHtml(todo.title)}</small>`).join("") : "";
      cells.push(`<span class="${detailed ? "day " : ""}${classes}">${number}${taskTags}</span>`);
    }
    return [...weekdayCells, ...cells].join("");
  }

  function renderCalendarCard() {
    if (!$("#calendarMonth")) return;
    $("#calendarMonth").textContent = monthLabel(new Date());
    $("#miniCalendar").innerHTML = calendarCells(new Date());
  }

  function openCalendarDetail() {
    calendarCursor = new Date();
    renderCalendarDetail();
    $("#detailDialog").showModal();
  }

  function renderCalendarDetail() {
    $("#detailContent").innerHTML = `
      <div class="detail-toolbar">
        <div><p class="eyebrow">${escapeHtml(t("calendar"))}</p><h2 class="detail-title">${escapeHtml(monthLabel(calendarCursor))}</h2></div>
        <div class="month-controls"><button type="button" data-month-step="-1" aria-label="Previous month">←</button><button type="button" data-month-step="1" aria-label="Next month">→</button></div>
      </div>
      <p class="detail-subtitle">${escapeHtml(t("calendarHint"))}</p>
      <div class="large-calendar">${calendarCells(calendarCursor, true)}</div>`;
    $$('[data-month-step]', $("#detailContent")).forEach((button) => button.addEventListener("click", () => {
      calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + Number(button.dataset.monthStep), 1);
      renderCalendarDetail();
    }));
  }

  function openTodoDetail() {
    renderTodoDetail();
    $("#detailDialog").showModal();
  }

  function renderTodoDetail() {
    const ordered = [...todos].sort((a, b) => Number(a.completed) - Number(b.completed) || a.due_date.localeCompare(b.due_date));
    $("#detailContent").innerHTML = `
      <p class="eyebrow">${escapeHtml(t("toDo"))}</p>
      <h2 class="detail-title">${escapeHtml(t("todoDetail"))}</h2>
      <p class="detail-subtitle">${escapeHtml(t("todoHint"))}</p>
      <form id="todoForm" class="todo-form">
        <input id="todoTitle" aria-label="${escapeHtml(t("taskName"))}" maxlength="100" required placeholder="${escapeHtml(t("taskName"))}" />
        <input id="todoDue" aria-label="${escapeHtml(t("dueDate"))}" type="date" required min="${dateKey(new Date())}" value="${dateKey(new Date())}" />
        <button class="primary-button" type="submit">${escapeHtml(t("add"))}</button>
      </form>
      <div class="full-todo-list">
        ${ordered.length ? ordered.map((todo) => `
          <div class="full-todo ${todo.completed ? "done" : ""}">
            <button class="todo-toggle" type="button" data-toggle-todo="${escapeHtml(todo.id)}" aria-label="Complete">${todo.completed ? "✓" : ""}</button>
            <span class="todo-title">${escapeHtml(todo.title)}</span>
            <time class="todo-meta">${escapeHtml(todo.due_date)}</time>
            <button class="delete-todo" type="button" data-delete-todo="${escapeHtml(todo.id)}" aria-label="${escapeHtml(t("delete"))}">×</button>
          </div>`).join("") : `<div class="empty-state">${escapeHtml(t("noTasks"))}</div>`}
      </div>`;
    $("#todoForm").addEventListener("submit", addTodo);
    $$('[data-toggle-todo]', $("#detailContent")).forEach((button) => button.addEventListener("click", () => toggleTodo(button.dataset.toggleTodo)));
    $$('[data-delete-todo]', $("#detailContent")).forEach((button) => button.addEventListener("click", () => deleteTodo(button.dataset.deleteTodo)));
  }

  async function addTodo(event) {
    event.preventDefault();
    const title = $("#todoTitle").value.trim();
    const dueDate = $("#todoDue").value;
    if (!title || !dueDate) return;
    if (previewSession) {
      todos.push({ id: `local-${Date.now()}`, title, due_date: dueDate, completed: false });
      persistPreviewTodos();
    } else {
      const { data, error } = await client.from("todos").insert({ user_id: currentUser.id, title, due_date: dueDate }).select("id,title,due_date,completed,created_at").single();
      if (error) { showToast(t("saveFailed")); return; }
      todos.push(data);
    }
    renderTodoDetail(); renderTodoCard(); renderCalendarCard(); showToast(t("taskAdded"));
  }

  async function toggleTodo(id) {
    const todo = todos.find((item) => String(item.id) === String(id));
    if (!todo) return;
    const next = !todo.completed;
    if (!previewSession) {
      const { error } = await client.from("todos").update({ completed: next }).eq("id", id);
      if (error) { showToast(t("saveFailed")); return; }
    }
    todo.completed = next;
    persistPreviewTodos(); renderTodoDetail(); renderTodoCard(); renderCalendarCard();
  }

  async function deleteTodo(id) {
    if (!previewSession) {
      const { error } = await client.from("todos").delete().eq("id", id);
      if (error) { showToast(t("saveFailed")); return; }
    }
    todos = todos.filter((item) => String(item.id) !== String(id));
    persistPreviewTodos(); renderTodoDetail(); renderTodoCard(); renderCalendarCard(); showToast(t("taskDeleted"));
  }

  function openSection(name) {
    const labels = { vocabulary: t("vocabulary"), englishGame: `${t("english")} · ${t("game")}`, math: t("math"), gamesSoon: t("games") };
    $("#detailContent").innerHTML = `<p class="eyebrow">${escapeHtml(t("learning"))}</p><h2 class="detail-title">${escapeHtml(labels[name] || name)}</h2><div class="coming-soon-panel">${escapeHtml(t("sectionSoon"))}</div>`;
    $("#detailDialog").showModal();
    closeDrawer();
  }

  async function login(event) {
    event.preventDefault();
    showAuthMessage("");
    if (!client) { showAuthMessage(t("configNeeded")); return; }
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) { showAuthMessage(error.message); return; }
    currentUser = data.user;
    previewSession = false;
    $("#authDialog").close();
    renderAuthState();
    showToast(t("loginSuccess"));
  }

  async function startRegistration(event) {
    event.preventDefault();
    showAuthMessage("");
    if (!client) { showAuthMessage(t("configNeeded")); return; }
    const email = $("#registerEmail").value.trim().toLowerCase();
    const displayName = $("#registerName").value.trim();
    const password = $("#registerPassword").value;
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: { display_name: displayName } }
    });
    if (error) { showAuthMessage(error.message); return; }
    registerDraft = { email, displayName, password };
    $("#registerFields").hidden = true;
    $("#otpFields").hidden = false;
    $("#otpHint").textContent = t("codeSent").replace("{email}", email);
    $("#otpCode").focus();
  }

  async function verifyRegistration() {
    const token = $("#otpCode").value.replace(/\D/g, "");
    if (!registerDraft || !/^\d{6,10}$/.test(token)) { showAuthMessage(t("invalidOtp")); return; }
    const { data, error } = await client.auth.verifyOtp({ email: registerDraft.email, token, type: "email" });
    if (error) { showAuthMessage(error.message); return; }
    const update = await client.auth.updateUser({ password: registerDraft.password, data: { display_name: registerDraft.displayName } });
    if (update.error) { showAuthMessage(update.error.message); return; }
    currentUser = update.data.user || data.user;
    registerDraft = null;
    $("#authDialog").close();
    renderAuthState();
    showToast(t("accountCreated"));
  }

  async function logout() {
    if (client && currentUser) await client.auth.signOut();
    currentUser = null;
    previewSession = false;
    localStorage.removeItem("bubble-preview-session");
    $("#profileMenu").hidden = true;
    renderAuthState();
    showToast(t("logoutSuccess"));
  }

  function previewLogin() {
    previewSession = true;
    localStorage.setItem("bubble-preview-session", "true");
    $("#authDialog").close();
    renderAuthState();
    showToast(t("previewNotice"));
  }

  function bindEvents() {
    $("#drawerTrigger").addEventListener("click", openDrawer);
    $("#drawerClose").addEventListener("click", closeDrawer);
    $("#drawerBackdrop").addEventListener("click", closeDrawer);
    $("#profileButton").addEventListener("click", openAuth);
    $("#logoutButton").addEventListener("click", logout);
    $("#loginForm").addEventListener("submit", login);
    $("#registerForm").addEventListener("submit", startRegistration);
    $("#verifyOtpButton").addEventListener("click", verifyRegistration);
    $("#backToRegister").addEventListener("click", () => {
      $("#registerFields").hidden = false; $("#otpFields").hidden = true; showAuthMessage("");
    });
    $("#previewLogin").addEventListener("click", previewLogin);
    $$("[data-auth-tab]").forEach((button) => button.addEventListener("click", () => switchAuthTab(button.dataset.authTab)));
    $$(".language-option").forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
    $$("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
    $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
    [$("#calendarCard"), $("#openCalendar")].forEach((node) => node.addEventListener("click", (event) => { event.stopPropagation(); openCalendarDetail(); }));
    [$("#todoCard"), $("#openTodos")].forEach((node) => node.addEventListener("click", (event) => { event.stopPropagation(); openTodoDetail(); }));
    [$("#calendarCard"), $("#todoCard")].forEach((node) => node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        node === $("#calendarCard") ? openCalendarDetail() : openTodoDetail();
      }
    }));
    $$("[data-section]").forEach((button) => button.addEventListener("click", () => openSection(button.dataset.section)));
    $("#robotButton").addEventListener("click", () => showToast(t("aiSoon")));
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".profile-area")) { $("#profileMenu").hidden = true; $("#profileButton").setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  }

  async function initializeAuth() {
    if (!client) { renderAuthState(); return; }
    const { data } = await client.auth.getUser();
    currentUser = data.user || null;
    if (currentUser) previewSession = false;
    client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      if (nextUser?.id !== currentUser?.id) {
        currentUser = nextUser;
        if (nextUser) previewSession = false;
        renderAuthState();
      }
    });
    renderAuthState();
  }

  createBubbles();
  bindEvents();
  setLanguage(lang);
  updateClock();
  setInterval(updateClock, 1000);
  initializeAuth();
})();
