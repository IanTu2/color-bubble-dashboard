(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isEnglish = () => document.documentElement.lang?.startsWith("en");
  const text = (zh, en) => isEnglish() ? en : zh;

  let rangeDays = 1;
  let observerBusy = false;

  function syncPlanValue(form) {
    const date = $("[data-plan-date]", form)?.value || "";
    const time = $("[data-plan-time]", form)?.value || "23:59";
    const source = $("#todoReminder", form);
    if (source) source.value = date ? `${date}T${time}` : "";
  }

  function syncDeadlineValue(form) {
    const source = $("#todoDue", form);
    const date = $("[data-deadline-date]", form)?.value || "";
    if (source) source.value = date;
  }

  function validateSchedule(form) {
    const error = $("[data-todo-form-error]", form);
    const plannedDate = $("[data-plan-date]", form)?.value || "";
    const plannedTime = $("[data-plan-time]", form)?.value || "23:59";
    const deadlineDate = $("[data-deadline-date]", form)?.value || "";
    const deadlineTime = $("[data-deadline-time]", form)?.value || "23:59";
    if (plannedDate && deadlineDate && `${deadlineDate}T${deadlineTime}` < `${plannedDate}T${plannedTime}`) {
      if (error) error.textContent = text("截止日期時間不能早於計畫日期時間。", "The deadline cannot be earlier than the planned date and time.");
      return false;
    }
    if (error) error.textContent = "";
    return true;
  }

  function enhanceForm(form, selectedDate = "") {
    if (!form || form.dataset.todoRedesigned === "true") return;
    form.dataset.todoRedesigned = "true";
    form.classList.add("todo-redesign-form");

    const titleInput = $("#todoTitle", form);
    const dueInput = $("#todoDue", form);
    const reminderInput = $("#todoReminder", form);
    const submit = $('button[type="submit"]', form);
    const cancel = $("[data-cancel-edit]", form);
    if (!titleInput || !dueInput || !reminderInput || !submit) return;

    const originalDue = dueInput.value || selectedDate || "";
    const originalReminder = reminderInput.value || "";
    const plannedDate = originalReminder ? originalReminder.slice(0, 10) : "";
    const plannedTime = originalReminder ? originalReminder.slice(11, 16) : "23:59";

    titleInput.placeholder = text("請輸入待辦事項", "Enter a to-do item");
    titleInput.setAttribute("aria-label", text("待辦名稱", "To-do item"));
    titleInput.classList.add("todo-name-input");

    dueInput.classList.add("todo-hidden-source");
    reminderInput.classList.add("todo-hidden-source");

    const heading = document.createElement("div");
    heading.className = "todo-form-heading";
    heading.innerHTML = `<h3>${text("待辦事項", "To-do Items")}</h3><p>${text("填入待辦事項", "Enter a to-do item")}</p>`;

    const nameField = document.createElement("label");
    nameField.className = "todo-field todo-name-field";
    nameField.innerHTML = `<span>${text("待辦名稱", "To-do item")}</span>`;
    nameField.appendChild(titleInput);

    const planColumn = document.createElement("div");
    planColumn.className = "todo-schedule-column";
    planColumn.innerHTML = `
      <label class="todo-field"><span>${text("計畫日期", "Planned date")}</span><input type="date" data-plan-date value="${plannedDate}"></label>
      <label class="todo-field"><span>${text("計畫時間", "Planned time")}</span><input type="time" data-plan-time value="${plannedTime || "23:59"}"></label>`;

    const deadlineColumn = document.createElement("div");
    deadlineColumn.className = "todo-schedule-column";
    deadlineColumn.innerHTML = `
      <label class="todo-field"><span>${text("截止日期", "Deadline date")}</span><input type="date" data-deadline-date value="${originalDue}"></label>
      <label class="todo-field"><span>${text("截止時間", "Deadline time")}</span><input type="time" data-deadline-time value="23:59"></label>`;

    const error = document.createElement("div");
    error.className = "todo-form-error";
    error.dataset.todoFormError = "";
    error.setAttribute("role", "alert");

    form.replaceChildren(heading, nameField, planColumn, deadlineColumn, dueInput, reminderInput, submit, ...(cancel ? [cancel] : []), error);

    $$('[data-plan-date],[data-plan-time]', form).forEach((input) => input.addEventListener("input", () => syncPlanValue(form)));
    $("[data-deadline-date]", form)?.addEventListener("input", () => syncDeadlineValue(form));
    $$('[data-plan-date],[data-plan-time],[data-deadline-date],[data-deadline-time]', form).forEach((input) => input.addEventListener("change", () => validateSchedule(form)));
    form.addEventListener("submit", (event) => {
      syncPlanValue(form);
      syncDeadlineValue(form);
      if (!validateSchedule(form)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function filterTodoRows(root) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() + Math.max(0, rangeDays - 1));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    $$(".full-todo", root).forEach((row) => {
      const value = $(".todo-meta time", row)?.textContent?.trim();
      const due = value ? new Date(`${value}T00:00:00`) : null;
      row.classList.toggle("todo-filtered-out", !due || due < start || due > end);
    });
    const summary = $("[data-range-summary]", root);
    if (summary) summary.textContent = text(`顯示未來 ${rangeDays} 天的待辦事項`, `Showing to-dos for the next ${rangeDays} day${rangeDays > 1 ? "s" : ""}`);
  }

  function enhanceOverview(root) {
    if (!root || root.dataset.todoOverviewRedesigned === "true") return;
    const form = $("#todoForm", root);
    const search = $(".todo-search", root);
    const list = $(".full-todo-list", root) || $(".empty-state", root);
    if (!form || !search || !list || $(".detail-back", root)) return;
    root.dataset.todoOverviewRedesigned = "true";

    enhanceForm(form, "");
    form.classList.add("todo-panel");
    form.hidden = true;
    search.classList.add("todo-search-panel");
    search.hidden = true;

    const eyebrow = $(".eyebrow", root);
    if (eyebrow) eyebrow.remove();
    const firstTitle = $(".detail-title", root);
    const firstSubtitle = $(".detail-subtitle", root);
    firstTitle?.remove();
    firstSubtitle?.remove();

    const head = document.createElement("div");
    head.className = "todo-overview-head";
    head.innerHTML = `<div><h2 class="detail-title">${text("待辦事項", "To-do Items")}</h2><p class="detail-subtitle">${text("選擇查看範圍", "Choose a viewing range")}</p></div><div class="todo-overview-actions"><button class="primary-button" type="button" data-overview-add>＋ ${text("新增", "Add")}</button><button class="secondary-button" type="button" data-overview-search>⌕ ${text("查詢", "Search")}</button></div>`;

    const range = document.createElement("div");
    range.className = "todo-range-grid";
    range.innerHTML = [1, 2, 7, 30].map((days) => `<button type="button" class="todo-range-card ${days === rangeDays ? "active" : ""}" data-range-days="${days}"><strong>${text(days === 1 ? "一天" : days === 2 ? "兩天" : days === 7 ? "七天" : "三十天", `${days} Day${days > 1 ? "s" : ""}`)}</strong><span>${text("從今天開始", "From today")}</span></button>`).join("");
    const summary = document.createElement("p");
    summary.className = "todo-range-summary";
    summary.dataset.rangeSummary = "";

    root.prepend(head, range, summary);

    $("[data-overview-add]", root).addEventListener("click", () => {
      form.hidden = !form.hidden;
      search.hidden = true;
      if (!form.hidden) $("#todoTitle", form)?.focus();
    });
    $("[data-overview-search]", root).addEventListener("click", () => {
      search.hidden = !search.hidden;
      form.hidden = true;
      if (!search.hidden) $("input", search)?.focus();
    });
    $$('[data-range-days]', root).forEach((button) => button.addEventListener("click", () => {
      rangeDays = Number(button.dataset.rangeDays) || 1;
      $$('[data-range-days]', root).forEach((item) => item.classList.toggle("active", item === button));
      filterTodoRows(root);
    }));
    filterTodoRows(root);
  }

  function enhanceDay(root) {
    const form = $("#todoForm", root);
    const back = $(".detail-back", root);
    if (!form || !back) return;
    const heading = $(".detail-title", root);
    const selectedDate = $("#todoDue", form)?.value || "";
    if (heading) heading.textContent = text("待辦事項", "To-do Items");
    const subtitle = $(".detail-subtitle", root);
    if (subtitle) subtitle.textContent = text("填入待辦事項", "Enter a to-do item");
    enhanceForm(form, selectedDate);
  }

  function enhance() {
    if (observerBusy) return;
    observerBusy = true;
    requestAnimationFrame(() => {
      const root = $("#detailContent");
      if (root) {
        enhanceDay(root);
        enhanceOverview(root);
      }
      observerBusy = false;
    });
  }

  function initialize() {
    const root = $("#detailContent");
    if (!root || root.dataset.todoRedesignObserver === "true") return;
    root.dataset.todoRedesignObserver = "true";
    const observer = new MutationObserver(enhance);
    observer.observe(root, { childList: true, subtree: true });
    enhance();
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();