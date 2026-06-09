import { createEffect, createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { Toaster, toast } from "solid-sonner";
import { AccountFormPanel } from "./components/AccountFormPanel";
import { AccountList } from "./components/AccountList";
import { AuthView } from "./components/AuthView";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { TopBar } from "./components/TopBar";
import type { AccountEntry, AccountForm, ServerGroup, VaultData } from "./types";
import { readBackupFile, saveBackupFile } from "./lib/backup";
import { buildShareText, copyText } from "./lib/clipboard";
import {
  createAccount,
  createEmptyVault,
  createServer,
  getServerAccountCount,
  updateAccount,
} from "./lib/utils";
import {
  exportVaultBackup,
  hasVault,
  importVaultBackup,
  saveVault,
  unlockVault,
} from "./lib/vault";

type AuthMode = "loading" | "setup" | "unlock" | "ready";
type PendingDelete =
  | { type: "server"; server: ServerGroup }
  | { type: "account"; account: AccountEntry }
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
  const [error, setError] = createSignal("");

  createEffect(() => {
    void (async () => {
      setAuthMode((await hasVault()) ? "unlock" : "setup");
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
    return target.type === "server" ? "删除区服" : "删除账号";
  });

  const deleteDialogDescription = createMemo(() => {
    const target = pendingDelete();
    if (!target) {
      return "";
    }
    if (target.type === "server") {
      return `确定删除区服「${target.server.name}」？该区服下所有账号也会被删除。`;
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

  async function persist(nextVault: VaultData) {
    setVault(nextVault);
    await saveVault(nextVault, masterPassword());
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
      setSelectedServerId(data.servers[0]?.id ?? null);
      toast.success(authMode() === "setup" ? "保险库已创建" : "已解锁");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "解锁失败。");
    }
  }

  async function addServer(event: Event) {
    event.preventDefault();
    const name = serverName().trim();
    if (!name) {
      toast.error("请输入区服名称");
      return;
    }

    const nextServer = createServer(name, vault().servers.length);
    await persist({
      ...vault(),
      servers: [...vault().servers, nextServer],
    });
    setSelectedServerId(nextServer.id);
    setForm({ ...form(), serverId: nextServer.id });
    setServerName("");
    setError("");
    toast.success("区服已添加");
  }

  async function confirmDeleteServer(server: ServerGroup) {
    const nextServers = vault().servers.filter((item) => item.id !== server.id);
    await persist({
      ...vault(),
      servers: nextServers,
      accounts: vault().accounts.filter((account) => account.serverId !== server.id),
    });
    setSelectedServerId(nextServers[0]?.id ?? null);
    setPendingDelete(null);
    toast.success("区服已删除");
  }

  async function submitAccount(event: Event) {
    event.preventDefault();
    const payload = form();
    if (!payload.serverId || !payload.characterName || !payload.username || !payload.password) {
      toast.error("区服、角色名、账号和密码为必填");
      return;
    }

    const currentEditingId = editingId();
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
    await persist({
      ...vault(),
      accounts: vault().accounts.filter((item) => item.id !== account.id),
    });
    setPendingDelete(null);
    toast.success("账号已删除");
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
    try {
      const backup = await exportVaultBackup(vault(), masterPassword());
      toast.success(await saveBackupFile(backup));
    } catch (backupError) {
      toast.error(backupError instanceof Error ? backupError.message : "导出失败");
    }
  }

  async function importBackup() {
    try {
      const raw = await readBackupFile();
      if (!raw) {
        return;
      }
      const imported = await importVaultBackup(raw, masterPassword());
      setVault(imported);
      setSelectedServerId(imported.servers[0]?.id ?? null);
      toast.success("加密备份已导入");
    } catch (importError) {
      toast.error(importError instanceof Error ? importError.message : "导入失败");
    }
  }

  async function addProfession(event: Event) {
    event.preventDefault();
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
    await persist({
      ...vault(),
      professions: vault().professions.filter((item) => item !== profession),
    });
    toast.success("职业已删除", { description: "已有账号记录不会被改动" });
  }

  async function renameServer(serverId: string, name: string) {
    const nextName = name.trim();
    if (!nextName) {
      toast.error("区服名称不能为空");
      return;
    }

    const currentServer = vault().servers.find((server) => server.id === serverId);
    if (!currentServer || currentServer.name === nextName) {
      return;
    }

    await persist({
      ...vault(),
      servers: vault().servers.map((server) =>
        server.id === serverId ? { ...server, name: nextName, updatedAt: new Date().toISOString() } : server,
      ),
    });
    toast.success("区服已更新");
  }

  async function resetMasterPassword(event: Event) {
    event.preventDefault();
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

    await saveVault(vault(), nextPassword);
    setMasterPassword(nextPassword);
    setCurrentMasterPassword("");
    setNextMasterPassword("");
    setConfirmNextMasterPassword("");
    toast.success("主密码已重置");
  }

  function lockApp() {
    setVault(createEmptyVault());
    setMasterPassword("");
    setConfirmPassword("");
    setCurrentMasterPassword("");
    setNextMasterPassword("");
    setConfirmNextMasterPassword("");
    setSelectedServerId(null);
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

      <Match when={authMode() === "ready"}>
        <div class="app-shell">
          <main class="content">
            <TopBar
              servers={sortedServers()}
              selectedServerId={activeServer()?.id ?? ""}
              query={query()}
              serverName={serverName()}
              showSettings={showSettings()}
              onServerChange={(serverId) => {
                setSelectedServerId(serverId);
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
              onQueryInput={setQuery}
              onAddAccount={startCreateAccount}
              onToggleSettings={() => setShowSettings(!showSettings())}
              onImport={importBackup}
              onExport={exportBackup}
              onLock={lockApp}
            />

            <div class="summary-line">
              <span>{filteredAccounts().length} 条账号</span>
              <span>共 {getServerAccountCount(vault().accounts, activeServer()?.id ?? "")} 条</span>
            </div>

            <AccountList
              accounts={filteredAccounts()}
              hasServer={activeServer() !== null}
              visiblePasswords={visiblePasswords()}
              visibleUsernames={visibleUsernames()}
              allPasswordsVisible={showPasswordColumn()}
              allUsernamesVisible={showUsernameColumn()}
              onTogglePassword={togglePassword}
              onToggleUsername={toggleUsername}
              onToggleAllPasswords={toggleAllPasswords}
              onToggleAllUsernames={toggleAllUsernames}
              onCopyUsername={(account) => copyValue(account.username, "账号已复制")}
              onCopyPassword={(account) => copyValue(account.password, "密码已复制")}
              onShare={(account) => copyValue(buildShareText(account), "分享信息已复制")}
              onEdit={startEdit}
              onDelete={(account) => setPendingDelete({ type: "account", account })}
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
          </main>
        </div>
      </Match>
      </Switch>
    </>
  );
}

export default App;
