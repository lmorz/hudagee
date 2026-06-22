import { ClipboardPaste, Plus, Search } from "lucide-solid";
import { createEffect, createMemo, createSignal, Match, onMount, Show, Switch } from "solid-js";
import { Toaster, toast } from "solid-sonner";
import { AccountFormPanel } from "./components/AccountFormPanel";
import { AccountList } from "./components/AccountList";
import { AuthView } from "./components/AuthView";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ImportModeDialog } from "./components/ImportModeDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { TopBar } from "./components/TopBar";
import type { AccountEntry, AccountForm, ServerGroup, VaultData } from "./types";
import { readBackupFile, saveBackupFile } from "./lib/backup";
import { buildShareText, copyText, parseShareText, readClipboardText } from "./lib/clipboard";
import { initLaunchAtStartup, readLaunchAtStartupPreference } from "./lib/autostart";
import { readLastSelectedServerId, resolveSelectedServerId, writeLastSelectedServerId } from "./lib/preferences";
import { revealMainWindow, isTauriRuntime, isAutostartSession } from "./lib/tauri";
import {
  createAccount,
  createEmptyVault,
  createServer,
  findDuplicateAccount,
  formatVaultMergeSummary,
  mergeVaultData,
  reorderServers,
  updateAccount,
} from "./lib/utils";
import { initWindowToggleShortcut } from "./lib/windowToggleShortcut";
import {
  BACKUP_INVALID_FORMAT_MESSAGE,
  BACKUP_WRONG_PASSWORD_MESSAGE,
  deleteVaultStorage,
  exportVaultBackup,
  hasVault,
  openVaultBackup,
  parseVaultBackup,
  restoreVaultFromBackup,
  saveVault,
  unlockVault,
} from "./lib/vault";

type AuthMode = "loading" | "setup" | "unlock" | "ready" | "corrupted";
type PendingDelete =
  | { type: "server"; server: ServerGroup }
  | { type: "account"; account: AccountEntry }
  | null;
type ImportDialogState =
  | {
      stage: "password";
      raw: string;
      backupPassword: string;
      error: string;
    }
  | {
      stage: "mode";
      data: VaultData;
    }
  | null;

const emptyForm: AccountForm = {
  serverId: "",
  characterName: "",
  username: "",
  password: "",
  profession: "",
  note: "",
};

function App() {
  const [authMode, setAuthMode] = createSignal<AuthMode>("loading");
  const [masterPassword, setMasterPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [vault, setVault] = createSignal<VaultData>(createEmptyVault());
  const [selectedServerId, setSelectedServerId] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal("");
  const [serverName, setServerName] = createSignal("");
  const [form, setForm] = createSignal<AccountForm>(emptyForm);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [isFormOpen, setIsFormOpen] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [newProfession, setNewProfession] = createSignal("");
  const [currentMasterPassword, setCurrentMasterPassword] = createSignal("");
  const [nextMasterPassword, setNextMasterPassword] = createSignal("");
  const [confirmNextMasterPassword, setConfirmNextMasterPassword] = createSignal("");
  const [visiblePasswords, setVisiblePasswords] = createSignal(new Set<string>());
  const [visibleUsernames, setVisibleUsernames] = createSignal(new Set<string>());
  const [showPasswordColumn, setShowPasswordColumn] = createSignal(false);
  const [showUsernameColumn, setShowUsernameColumn] = createSignal(false);
  const [pendingDelete, setPendingDelete] = createSignal<PendingDelete>(null);
  const [importDialog, setImportDialog] = createSignal<ImportDialogState>(null);
  const [isImporting, setIsImporting] = createSignal(false);
  const [isSavingVault, setIsSavingVault] = createSignal(false);
  const [isReordering, setIsReordering] = createSignal(false);
  const [pendingRecreate, setPendingRecreate] = createSignal(false);
  const [error, setError] = createSignal("");

  const passwordImportDialog = createMemo(() => {
    const dialog = importDialog();
    return dialog?.stage === "password" ? dialog : undefined;
  });

  const modeImportDialog = createMemo(() => {
    const dialog = importDialog();
    return dialog?.stage === "mode" ? dialog : undefined;
  });

  createEffect(() => {
    void (async () => {
      try {
        setAuthMode((await hasVault()) ? "unlock" : "setup");
      } catch {
        setError("");
        setAuthMode("corrupted");
      }
    })();
  });

  onMount(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void initWindowToggleShortcut().catch((initError) => {
      toast.warning(initError instanceof Error ? initError.message : "全局快捷键注册失败，可在配置中更换组合键");
    });
    void initLaunchAtStartup().catch(() => {
      if (readLaunchAtStartupPreference()) {
        toast.warning("开机启动设置未能同步，可在配置中重新开启");
      }
    });
  });

  createEffect(() => {
    if (authMode() === "loading") {
      return;
    }

    void (async () => {
      if (isTauriRuntime() && (await isAutostartSession())) {
        return;
      }

      // 等 Solid 绘制完成后再显示窗口，避免白屏或启动占位一闪而过
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void revealMainWindow();
        });
      });
    })();
  });

  const sortedServers = createMemo(() =>
    [...vault().servers].sort((left, right) => left.sortOrder - right.sortOrder),
  );

  const activeServer = createMemo(() =>
    sortedServers().find((server) => server.id === selectedServerId()) ?? sortedServers()[0] ?? null,
  );

  const filteredAccounts = createMemo(() => {
    const active = activeServer();
    if (!active) {
      return [];
    }

    const needle = query().trim().toLowerCase();
    return vault()
      .accounts.filter((account) => account.serverId === active.id)
      .filter((account) => {
        if (!needle) {
          return true;
        }
        return [account.characterName, account.username, account.profession, account.note]
          .some((value) => value.toLowerCase().includes(needle));
      });
  });

  const deleteDialogTitle = createMemo(() => {
    const target = pendingDelete();
    if (!target) {
      return "";
    }
    return target.type === "server" ? "删除分组" : "删除账号";
  });

  const deleteDialogDescription = createMemo(() => {
    const target = pendingDelete();
    if (!target) {
      return "";
    }
    if (target.type === "server") {
      return `确定删除分组「${target.server.name}」？该分组下所有账号也会被删除。`;
    }
    return `确定删除角色「${target.account.characterName}」的账号记录？`;
  });

  createEffect(() => {
    const active = activeServer();
    if (active && !selectedServerId()) {
      setSelectedServerId(active.id);
    }
  });

  createEffect(() => {
    const active = activeServer();
    if (active && !editingId() && form().serverId !== active.id) {
      setForm({ ...form(), serverId: active.id });
    }
  });

  async function persist(nextVault: VaultData, showError = true) {
    setIsSavingVault(true);
    try {
      await saveVault(nextVault, masterPassword());
      setVault(nextVault);
    } catch (saveError) {
      if (showError) {
        toast.error(saveError instanceof Error ? saveError.message : "保存失败");
      }
      throw saveError;
    } finally {
      setIsSavingVault(false);
    }
  }

  function isWriteBlocked() {
    if (isSavingVault() || isReordering() || isImporting()) {
      toast.info("正在保存，请稍候");
      return true;
    }

    return false;
  }

  async function restoreFromCorruptedBackup() {
    if (isImporting()) {
      return;
    }

    const backupPassword = masterPassword();
    if (backupPassword.length < 1) {
      setError("请先输入备份主密码。");
      return;
    }

    try {
      setIsImporting(true);
      setError("");
      const raw = await readBackupFile();
      if (!raw) {
        return;
      }

      const data = await restoreVaultFromBackup(raw, backupPassword, backupPassword);
      setVault(data);
      setAuthMode("ready");
      const nextSelectedId = resolveSelectedServerId(data.servers, readLastSelectedServerId());
      setSelectedServerId(nextSelectedId);
      if (nextSelectedId) {
        writeLastSelectedServerId(nextSelectedId);
      }
      toast.success("已从备份恢复", { description: "请使用备份主密码解锁保险库。" });
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "恢复失败。");
    } finally {
      setIsImporting(false);
    }
  }

  async function confirmRecreateVault() {
    try {
      await deleteVaultStorage();
      setMasterPassword("");
      setConfirmPassword("");
      setError("");
      setPendingRecreate(false);
      setAuthMode("setup");
      toast.info("请设置新的主密码以创建保险库");
    } catch (recreateError) {
      setPendingRecreate(false);
      setError(recreateError instanceof Error ? recreateError.message : "无法删除损坏的保险库。");
    }
  }

  async function handleAuth(event: Event) {
    event.preventDefault();
    setError("");

    if (masterPassword().length < 1) {
      setError("主密码至少需要 1 位。");
      return;
    }

    if (authMode() === "setup" && masterPassword() !== confirmPassword()) {
      setError("两次输入的主密码不一致。");
      return;
    }

    try {
      const data = await unlockVault(masterPassword());
      setVault(data);
      setAuthMode("ready");
      const nextSelectedId = resolveSelectedServerId(data.servers, readLastSelectedServerId());
      setSelectedServerId(nextSelectedId);
      if (nextSelectedId) {
        writeLastSelectedServerId(nextSelectedId);
      }
      toast.success(authMode() === "setup" ? "保险库已创建" : "已解锁");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "解锁失败。");
    }
  }

  async function addServer(event: Event) {
    event.preventDefault();
    if (isWriteBlocked()) {
      return;
    }

    const name = serverName().trim();
    if (!name) {
      toast.error("请输入分组名称");
      return;
    }
    if (vault().servers.some((server) => server.name.trim() === name)) {
      toast.error("同名分组已存在");
      return;
    }

    const nextServer = createServer(name, vault().servers.length);
    await persist({
      ...vault(),
      servers: [...vault().servers, nextServer],
    });
    setSelectedServerId(nextServer.id);
    writeLastSelectedServerId(nextServer.id);
    setForm({ ...form(), serverId: nextServer.id });
    setServerName("");
    setError("");
    toast.success("分组已添加");
  }

  async function confirmDeleteServer(server: ServerGroup) {
    if (isWriteBlocked()) {
      return;
    }

    const nextServers = vault().servers.filter((item) => item.id !== server.id);
    await persist({
      ...vault(),
      servers: nextServers,
      accounts: vault().accounts.filter((account) => account.serverId !== server.id),
    });
    const nextSelectedId = resolveSelectedServerId(nextServers, selectedServerId());
    setSelectedServerId(nextSelectedId);
    if (nextSelectedId) {
      writeLastSelectedServerId(nextSelectedId);
    }
    setPendingDelete(null);
    toast.success("分组已删除");
  }

  async function submitAccount(event: Event) {
    event.preventDefault();
    if (isWriteBlocked()) {
      return;
    }

    const payload = form();
    if (
      !payload.serverId ||
      !payload.characterName.trim() ||
      !payload.username.trim() ||
      !payload.password
    ) {
      toast.error("分组、角色名、账号和密码为必填");
      return;
    }

    const currentEditingId = editingId();
    const conflict = findDuplicateAccount(vault().accounts, payload, currentEditingId);
    if (conflict === "characterName") {
      toast.error("该分组下已存在相同角色名");
      return;
    }
    if (conflict === "username") {
      toast.error("该分组下已存在相同账号");
      return;
    }

    const nextAccounts = currentEditingId
      ? vault().accounts.map((account) =>
          account.id === currentEditingId ? updateAccount(account, payload) : account,
        )
      : [...vault().accounts, createAccount(payload)];

    await persist({ ...vault(), accounts: nextAccounts });
    setForm({ ...emptyForm, serverId: payload.serverId });
    setEditingId(null);
    setIsFormOpen(false);
    setError("");
    toast.success(currentEditingId ? "账号已更新" : "账号已新增");
  }

  function startCreateAccount() {
    setEditingId(null);
    setForm({ ...emptyForm, serverId: activeServer()?.id ?? "" });
    setIsFormOpen(true);
  }

  async function startQuickAddAccount() {
    if (isWriteBlocked()) {
      return;
    }

    try {
      const parsed = parseShareText(await readClipboardText());
      if (!parsed) {
        toast.error("剪贴板内容无法识别，请先确保复制了分享格式的账号信息");
        return;
      }

      setEditingId(null);
      setForm({
        serverId: activeServer()?.id ?? "",
        characterName: parsed.characterName,
        username: parsed.username,
        password: parsed.password,
        profession: parsed.profession,
        note: "",
      });
      setIsFormOpen(true);

      if (parsed.profession && !vault().professions.includes(parsed.profession)) {
        toast.info("职业尚未配置", { description: `请先在配置中添加「${parsed.profession}」或手动选择` });
      } else {
        toast.success("已从剪贴板填充账号信息");
      }
    } catch (clipboardError) {
      toast.error(clipboardError instanceof Error ? clipboardError.message : "读取剪贴板失败");
    }
  }

  function startEdit(account: AccountEntry) {
    setEditingId(account.id);
    setForm({
      serverId: account.serverId,
      characterName: account.characterName,
      username: account.username,
      password: account.password,
      profession: account.profession,
      note: account.note,
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingId(null);
    setForm({ ...emptyForm, serverId: activeServer()?.id ?? "" });
    setIsFormOpen(false);
  }

  async function confirmDeleteAccount(account: AccountEntry) {
    if (isWriteBlocked()) {
      return;
    }

    await persist({
      ...vault(),
      accounts: vault().accounts.filter((item) => item.id !== account.id),
    });
    setPendingDelete(null);
    toast.success("账号已删除");
  }

  async function reorderServer(draggedId: string, targetId: string, placement: "before" | "after") {
    if (isSavingVault() || isReordering() || draggedId === targetId) {
      return;
    }

    const nextServers = reorderServers(vault().servers, draggedId, targetId, placement);
    if (!nextServers) {
      return;
    }

    try {
      setIsReordering(true);
      await persist({ ...vault(), servers: nextServers }, false);
      toast.success("分组顺序已更新");
    } catch (reorderError) {
      toast.error(reorderError instanceof Error ? reorderError.message : "分组排序保存失败");
    } finally {
      setIsReordering(false);
    }
  }

  async function reorderAccount(draggedId: string, targetId: string, placement: "before" | "after") {
    if (isSavingVault() || isReordering() || query().trim() || draggedId === targetId) {
      return;
    }

    const accounts = vault().accounts;
    const draggedAccount = accounts.find((account) => account.id === draggedId);
    const targetAccount = accounts.find((account) => account.id === targetId);
    if (!draggedAccount || !targetAccount || draggedAccount.serverId !== targetAccount.serverId) {
      return;
    }

    const serverAccounts = accounts.filter((account) => account.serverId === draggedAccount.serverId);
    const withoutDragged = serverAccounts.filter((account) => account.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((account) => account.id === targetId);
    if (targetIndex === -1) {
      return;
    }

    const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    const nextServerAccounts = [
      ...withoutDragged.slice(0, insertIndex),
      draggedAccount,
      ...withoutDragged.slice(insertIndex),
    ];
    if (nextServerAccounts.every((account, index) => account.id === serverAccounts[index]?.id)) {
      return;
    }

    let serverAccountIndex = 0;
    const nextAccounts = accounts.map((account) => {
      if (account.serverId !== draggedAccount.serverId) {
        return account;
      }

      const nextAccount = nextServerAccounts[serverAccountIndex];
      serverAccountIndex += 1;
      return nextAccount;
    });

    try {
      setIsReordering(true);
      await persist({ ...vault(), accounts: nextAccounts }, false);
      toast.success("账号顺序已更新");
    } catch (reorderError) {
      toast.error(reorderError instanceof Error ? reorderError.message : "账号排序保存失败");
    } finally {
      setIsReordering(false);
    }
  }

  function confirmPendingDelete() {
    const target = pendingDelete();
    if (!target) {
      return;
    }
    if (target.type === "server") {
      void confirmDeleteServer(target.server);
      return;
    }
    void confirmDeleteAccount(target.account);
  }

  function togglePassword(accountId: string) {
    setVisiblePasswords((current) => {
      const next = new Set(current);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  }

  function toggleUsername(accountId: string) {
    setVisibleUsernames((current) => {
      const next = new Set(current);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  }

  function toggleAllPasswords() {
    setVisiblePasswords((current) => {
      const next = new Set(current);
      for (const account of filteredAccounts()) {
        next.delete(account.id);
      }
      return next;
    });
    setShowPasswordColumn(!showPasswordColumn());
  }

  function toggleAllUsernames() {
    setVisibleUsernames((current) => {
      const next = new Set(current);
      for (const account of filteredAccounts()) {
        next.delete(account.id);
      }
      return next;
    });
    setShowUsernameColumn(!showUsernameColumn());
  }

  async function copyValue(value: string, message: string) {
    await copyText(value);
    toast.success(message);
  }

  async function exportBackup() {
    if (isWriteBlocked()) {
      return;
    }

    try {
      const backup = await exportVaultBackup(vault(), masterPassword());
      toast.success(await saveBackupFile(backup));
    } catch (backupError) {
      toast.error(backupError instanceof Error ? backupError.message : "导出失败");
    }
  }

  async function importBackup() {
    if (importDialog() || isImporting()) {
      toast.info("请先完成当前导入操作");
      return;
    }

    try {
      setIsImporting(true);
      const raw = await readBackupFile();
      if (!raw) {
        return;
      }

      try {
        const { data } = await parseVaultBackup(raw, masterPassword());
        setImportDialog({ stage: "mode", data });
      } catch (importError) {
        const message = importError instanceof Error ? importError.message : "导入失败";
        if (message === BACKUP_INVALID_FORMAT_MESSAGE) {
          toast.error(message);
          return;
        }

        setImportDialog({
          stage: "password",
          raw,
          backupPassword: "",
          error: "备份主密码与当前保险库不一致，请输入导出备份时使用的主密码。",
        });
      }
    } catch (readError) {
      toast.error(readError instanceof Error ? readError.message : "导入失败");
    } finally {
      setIsImporting(false);
    }
  }

  async function confirmImportBackupPassword() {
    const dialog = importDialog();
    if (!dialog || dialog.stage !== "password" || isImporting()) {
      return;
    }

    if (dialog.backupPassword.length < 1) {
      setImportDialog({ ...dialog, error: "请输入备份主密码。" });
      return;
    }

    try {
      setIsImporting(true);
      const data = await openVaultBackup(dialog.raw, dialog.backupPassword);
      setImportDialog({ stage: "mode", data });
    } catch {
      setImportDialog({ ...dialog, error: BACKUP_WRONG_PASSWORD_MESSAGE });
    } finally {
      setIsImporting(false);
    }
  }

  async function mergePendingImport() {
    const dialog = importDialog();
    if (!dialog || dialog.stage !== "mode") {
      return;
    }
    if (isImporting()) {
      return;
    }
    if (isWriteBlocked()) {
      return;
    }

    try {
      setIsImporting(true);
      const { vault: nextVault, summary } = mergeVaultData(vault(), dialog.data);
      await persist(nextVault, false);
      const selectedId = selectedServerId();
      const nextSelectedId = resolveSelectedServerId(nextVault.servers, selectedId);
      setSelectedServerId(nextSelectedId);
      if (nextSelectedId) {
        writeLastSelectedServerId(nextSelectedId);
      }
      setImportDialog(null);
      toast.success("备份已合并导入", { description: formatVaultMergeSummary(summary) });
    } catch (mergeError) {
      toast.error(mergeError instanceof Error ? mergeError.message : "合并导入失败");
    } finally {
      setIsImporting(false);
    }
  }

  async function replaceWithPendingImport() {
    const dialog = importDialog();
    if (!dialog || dialog.stage !== "mode") {
      return;
    }
    if (isImporting()) {
      return;
    }
    if (isWriteBlocked()) {
      return;
    }

    try {
      setIsImporting(true);
      setIsSavingVault(true);
      await saveVault(dialog.data, masterPassword());
      const selectedId = selectedServerId();
      const nextSelectedId = resolveSelectedServerId(dialog.data.servers, selectedId);
      setVault(dialog.data);
      setSelectedServerId(nextSelectedId);
      if (nextSelectedId) {
        writeLastSelectedServerId(nextSelectedId);
      }
      setEditingId(null);
      setForm({ ...emptyForm, serverId: nextSelectedId ?? "" });
      setIsFormOpen(false);
      setPendingDelete(null);
      setImportDialog(null);
      toast.success("已覆盖恢复备份");
    } catch (replaceError) {
      toast.error(replaceError instanceof Error ? replaceError.message : "覆盖恢复失败");
    } finally {
      setIsSavingVault(false);
      setIsImporting(false);
    }
  }

  async function addProfession(event: Event) {
    event.preventDefault();
    if (isWriteBlocked()) {
      return;
    }

    const profession = newProfession().trim();
    if (!profession) {
      return;
    }
    if (vault().professions.includes(profession)) {
      toast.error("该职业已存在");
      return;
    }
    await persist({ ...vault(), professions: [...vault().professions, profession] });
    setNewProfession("");
    setError("");
    toast.success("职业已添加");
  }

  async function deleteProfession(profession: string) {
    if (isWriteBlocked()) {
      return;
    }

    await persist({
      ...vault(),
      professions: vault().professions.filter((item) => item !== profession),
    });
    toast.success("职业已删除", { description: "已有账号记录不会被改动" });
  }

  async function renameServer(serverId: string, name: string) {
    if (isWriteBlocked()) {
      return;
    }

    const nextName = name.trim();
    if (!nextName) {
      toast.error("分组名称不能为空");
      return;
    }

    const currentServer = vault().servers.find((server) => server.id === serverId);
    if (!currentServer || currentServer.name === nextName) {
      return;
    }
    if (vault().servers.some((server) => server.id !== serverId && server.name.trim() === nextName)) {
      toast.error("同名分组已存在");
      return;
    }

    await persist({
      ...vault(),
      servers: vault().servers.map((server) =>
        server.id === serverId ? { ...server, name: nextName, updatedAt: new Date().toISOString() } : server,
      ),
    });
    toast.success("分组已更新");
  }

  async function resetMasterPassword(event: Event) {
    event.preventDefault();
    if (isWriteBlocked()) {
      return;
    }

    const currentPassword = currentMasterPassword();
    const nextPassword = nextMasterPassword();

    if (currentPassword !== masterPassword()) {
      toast.error("当前主密码不正确");
      return;
    }
    if (nextPassword.length < 1) {
      toast.error("新主密码至少需要 1 位");
      return;
    }
    if (nextPassword !== confirmNextMasterPassword()) {
      toast.error("两次输入的新主密码不一致");
      return;
    }

    try {
      setIsSavingVault(true);
      await saveVault(vault(), nextPassword);
      setMasterPassword(nextPassword);
      setCurrentMasterPassword("");
      setNextMasterPassword("");
      setConfirmNextMasterPassword("");
      toast.success("主密码已重置");
    } catch (resetError) {
      toast.error(resetError instanceof Error ? resetError.message : "主密码重置失败");
    } finally {
      setIsSavingVault(false);
    }
  }

  function lockApp() {
    if (isWriteBlocked()) {
      return;
    }
    if (importDialog()) {
      toast.info("请先完成或取消当前导入操作");
      return;
    }

    setVault(createEmptyVault());
    setMasterPassword("");
    setConfirmPassword("");
    setCurrentMasterPassword("");
    setNextMasterPassword("");
    setConfirmNextMasterPassword("");
    setSelectedServerId(null);
    setImportDialog(null);
    setIsImporting(false);
    setAuthMode("unlock");
    toast.info("应用已锁定");
  }

  return (
    <>
      <Toaster position="top-center" richColors duration={2600} visibleToasts={2} gap={6} offset={8} />
      <Switch>
        <Match when={authMode() === "loading"}>
          <AuthView
            mode="loading"
            masterPassword={masterPassword()}
            confirmPassword={confirmPassword()}
            error={error()}
            onMasterPasswordInput={setMasterPassword}
            onConfirmPasswordInput={setConfirmPassword}
            onSubmit={handleAuth}
          />
        </Match>

        <Match when={authMode() === "setup" || authMode() === "unlock"}>
          <AuthView
            mode={authMode() === "setup" ? "setup" : "unlock"}
            masterPassword={masterPassword()}
            confirmPassword={confirmPassword()}
            error={error()}
            onMasterPasswordInput={setMasterPassword}
            onConfirmPasswordInput={setConfirmPassword}
            onSubmit={handleAuth}
          />
        </Match>

        <Match when={authMode() === "corrupted"}>
          <AuthView
            mode="corrupted"
            error={error()}
            masterPassword={masterPassword()}
            isBusy={isImporting()}
            onMasterPasswordInput={setMasterPassword}
            onRestoreFromBackup={() => {
              void restoreFromCorruptedBackup();
            }}
            onRecreateVault={() => setPendingRecreate(true)}
          />
        </Match>

      <Match when={authMode() === "ready"}>
        <div class="app-shell">
          <main class="content">
            <TopBar
              servers={sortedServers()}
              selectedServerId={selectedServerId() ?? ""}
              serverName={serverName()}
              showSettings={showSettings()}
              onServerChange={(serverId) => {
                setSelectedServerId(serverId);
                writeLastSelectedServerId(serverId);
                setForm({ ...form(), serverId });
              }}
              onServerNameInput={setServerName}
              onAddServer={addServer}
              onDeleteServer={() => {
                const active = activeServer();
                if (active) {
                  setPendingDelete({ type: "server", server: active });
                }
              }}
              onToggleSettings={() => setShowSettings(!showSettings())}
              onImport={importBackup}
              onExport={exportBackup}
              onLock={lockApp}
            />

            <div class="summary-line">
              <div class="search-box">
                <Search size={13} />
                <input
                  value={query()}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                  placeholder="搜索：角色名/账号/职业/备注"
                />
              </div>
              <div class="summary-actions">
                <button
                  class="ghost-button compact"
                  type="button"
                  onClick={() => {
                    void startQuickAddAccount();
                  }}
                  title="从剪贴板读取账号信息快速添加
（点击已存在账号右侧分享按钮，再点这个按钮试试）"
                >
                  <ClipboardPaste size={13} />
                  快捷添加
                </button>
                <button class="primary-button compact" type="button" onClick={startCreateAccount}>
                  <Plus size={13} />
                  添加账号
                </button>
              </div>
            </div>

            <AccountList
              accounts={filteredAccounts()}
              hasServer={activeServer() !== null}
              visiblePasswords={visiblePasswords()}
              visibleUsernames={visibleUsernames()}
              allPasswordsVisible={showPasswordColumn()}
              allUsernamesVisible={showUsernameColumn()}
              isReorderEnabled={!query().trim() && !isSavingVault() && !isReordering() && !isImporting()}
              onTogglePassword={togglePassword}
              onToggleUsername={toggleUsername}
              onToggleAllPasswords={toggleAllPasswords}
              onToggleAllUsernames={toggleAllUsernames}
              onCopyUsername={(account) => copyValue(account.username, "账号已复制")}
              onCopyPassword={(account) => copyValue(account.password, "密码已复制")}
              onShare={(account) => copyValue(buildShareText(account), "分享信息已复制")}
              onEdit={startEdit}
              onDelete={(account) => setPendingDelete({ type: "account", account })}
              onReorder={(draggedId, targetId, placement) => {
                void reorderAccount(draggedId, targetId, placement);
              }}
            />

            <Show when={isFormOpen()}>
              <AccountFormPanel
                form={form()}
                servers={sortedServers()}
                professions={vault().professions}
                isEditing={editingId() !== null}
                onInput={setForm}
                onSubmit={submitAccount}
                onCancel={closeForm}
              />
            </Show>

            <Show when={showSettings()}>
              <SettingsPanel
                servers={sortedServers()}
                professions={vault().professions}
                newProfession={newProfession()}
                currentMasterPassword={currentMasterPassword()}
                nextMasterPassword={nextMasterPassword()}
                confirmNextMasterPassword={confirmNextMasterPassword()}
                onNewProfessionInput={setNewProfession}
                onAddProfession={addProfession}
                onDeleteProfession={deleteProfession}
                onRenameServer={(serverId, name) => {
                  void renameServer(serverId, name);
                }}
                isServerReorderEnabled={!isSavingVault() && !isReordering() && !isImporting()}
                onReorderServer={(draggedId, targetId, placement) => {
                  void reorderServer(draggedId, targetId, placement);
                }}
                onCurrentMasterPasswordInput={setCurrentMasterPassword}
                onNextMasterPasswordInput={setNextMasterPassword}
                onConfirmNextMasterPasswordInput={setConfirmNextMasterPassword}
                onResetMasterPassword={resetMasterPassword}
                onClose={() => setShowSettings(false)}
              />
            </Show>

            <Show when={pendingDelete()}>
              <ConfirmDialog
                title={deleteDialogTitle()}
                description={deleteDialogDescription()}
                onConfirm={confirmPendingDelete}
                onCancel={() => setPendingDelete(null)}
              />
            </Show>

            <Show when={passwordImportDialog()}>
              {(dialog) => (
                <ImportModeDialog
                  stage="password"
                  isBusy={isImporting()}
                  backupPassword={dialog().backupPassword}
                  error={dialog().error}
                  onBackupPasswordInput={(value) => {
                    const current = importDialog();
                    if (current?.stage === "password") {
                      setImportDialog({ ...current, backupPassword: value, error: "" });
                    }
                  }}
                  onConfirmPassword={() => {
                    void confirmImportBackupPassword();
                  }}
                  onCancel={() => {
                    if (!isImporting()) {
                      setImportDialog(null);
                    }
                  }}
                />
              )}
            </Show>

            <Show when={modeImportDialog()}>
              <ImportModeDialog
                stage="mode"
                isBusy={isImporting()}
                onMerge={() => {
                  void mergePendingImport();
                }}
                onReplace={() => {
                  void replaceWithPendingImport();
                }}
                onCancel={() => {
                  if (!isImporting()) {
                    setImportDialog(null);
                  }
                }}
              />
            </Show>
          </main>
        </div>
      </Match>
      </Switch>

      <Show when={pendingRecreate()}>
        <ConfirmDialog
          title="重新创建保险库"
          description="将删除损坏的本地保险库文件，当前数据无法恢复。请确认已备份或不再需要旧数据。"
          confirmText="重新创建"
          onConfirm={() => {
            void confirmRecreateVault();
          }}
          onCancel={() => setPendingRecreate(false)}
        />
      </Show>
    </>
  );
}

export default App;
