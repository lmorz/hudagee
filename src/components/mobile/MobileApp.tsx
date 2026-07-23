import { ClipboardPaste, FolderPlus, Plus, Search, Settings } from "lucide-solid";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { Toaster, toast } from "solid-sonner";
import type { AccountEntry, AccountForm, ServerGroup, VaultData } from "../../types";
import { buildShareText, copyText, parseShareText, readClipboardText } from "../../lib/clipboard";
import {
  readLastSelectedServerId,
  resolveSelectedServerId,
  writeLastSelectedServerId,
} from "../../lib/preferences";
import {
  createAccount,
  createServer,
  findDuplicateAccount,
  updateAccount,
} from "../../lib/utils";
import { saveVault } from "../../lib/vault";
import { ServerSelect } from "../ServerSelect";
import { ConfirmDialog } from "../ConfirmDialog";
import { MobileAccountForm } from "./MobileAccountForm";
import { MobileAccountList } from "./MobileAccountList";
import { MobileSettings } from "./MobileSettings";

type MobileAppProps = {
  vault: VaultData;
  masterPassword: string;
  onVaultChange: (vault: VaultData) => void;
  onMasterPasswordChange: (password: string) => void;
};

type MobilePendingDelete =
  | { type: "server"; item: ServerGroup }
  | { type: "account"; item: AccountEntry }
  | null;

const emptyForm: AccountForm = {
  serverId: "",
  characterName: "",
  username: "",
  password: "",
  profession: "",
  note: "",
};

export function MobileApp(props: MobileAppProps) {
  const [selectedServerId, setSelectedServerId] = createSignal<string | null>(readLastSelectedServerId());
  const [query, setQuery] = createSignal("");

  const [form, setForm] = createSignal<AccountForm>(emptyForm);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [isFormOpen, setIsFormOpen] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [showAddGroup, setShowAddGroup] = createSignal(false);
  const [newGroupName, setNewGroupName] = createSignal("");
  const [newProfession, setNewProfession] = createSignal("");
  const [currentMasterPassword, setCurrentMasterPassword] = createSignal("");
  const [nextMasterPassword, setNextMasterPassword] = createSignal("");
  const [confirmNextMasterPassword, setConfirmNextMasterPassword] = createSignal("");
  const [pendingDelete, setPendingDelete] = createSignal<MobilePendingDelete>(null);
  const [isSaving, setIsSaving] = createSignal(false);

  const sortedServers = createMemo(() =>
    [...props.vault.servers].sort((left, right) => left.sortOrder - right.sortOrder),
  );

  createEffect(() => {
    const next = resolveSelectedServerId(sortedServers(), selectedServerId() ?? readLastSelectedServerId());
    if (next !== selectedServerId()) {
      setSelectedServerId(next);
      if (next) {
        writeLastSelectedServerId(next);
      }
    }
  });

  const activeServer = createMemo(() =>
    sortedServers().find((server) => server.id === selectedServerId()) ?? sortedServers()[0] ?? null,
  );

  const filteredAccounts = createMemo(() => {
    const active = activeServer();
    if (!active) return [];

    const needle = query().trim().toLowerCase();
    return props.vault.accounts
      .filter((account) => account.serverId === active.id)
      .filter((account) => {
        if (!needle) return true;
        return [account.characterName, account.username, account.profession, account.note]
          .some((value) => value.toLowerCase().includes(needle));
      });
  });

  async function persist(nextVault: VaultData) {
    setIsSaving(true);
    try {
      await saveVault(nextVault, props.masterPassword);
      props.onVaultChange(nextVault);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败");
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function addGroup(event: Event) {
    event.preventDefault();
    const name = newGroupName().trim();
    if (!name) {
      toast.error("请输入分组名称");
      return;
    }
    if (props.vault.servers.some((s) => s.name.trim() === name)) {
      toast.error("同名分组已存在");
      return;
    }
    const nextServer = createServer(name, props.vault.servers.length);
    await persist({
      ...props.vault,
      servers: [...props.vault.servers, nextServer],
    });
    setSelectedServerId(nextServer.id);
    writeLastSelectedServerId(nextServer.id);
    setNewGroupName("");
    setShowAddGroup(false);
    toast.success("分组已添加");
  }

  async function startQuickAddAccount() {
    if (isSaving()) return;
    try {
      const text = await readClipboardText();
      const parsed = parseShareText(text);
      if (!parsed) {
        toast.error("剪贴板内容无法识别，请先复制分享格式的账号信息");
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
      toast.success("已从剪贴板填充账号信息");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "读取剪贴板失败");
    }
  }

  async function submitAccount(event: Event) {
    event.preventDefault();
    const payload = form();
    if (!payload.serverId || !payload.characterName.trim() || !payload.username.trim() || !payload.password) {
      toast.error("分组、角色名、账号和密码为必填");
      return;
    }

    const currentEditingId = editingId();
    const conflict = findDuplicateAccount(props.vault.accounts, payload, currentEditingId);
    if (conflict === "characterName") {
      toast.error("该分组下已存在相同角色名");
      return;
    }
    if (conflict === "username") {
      toast.error("该分组下已存在相同账号");
      return;
    }

    const nextAccounts = currentEditingId
      ? props.vault.accounts.map((account) =>
          account.id === currentEditingId ? updateAccount(account, payload) : account,
        )
      : [...props.vault.accounts, createAccount(payload)];

    await persist({ ...props.vault, accounts: nextAccounts });
    setForm({ ...emptyForm, serverId: payload.serverId });
    setEditingId(null);
    setIsFormOpen(false);
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

  async function confirmDeleteAccount(account: AccountEntry) {
    if (isSaving()) return;
    await persist({
      ...props.vault,
      accounts: props.vault.accounts.filter((item) => item.id !== account.id),
    });
    setPendingDelete(null);
    toast.success("账号已删除");
  }

  async function confirmDeleteServer(server: ServerGroup) {
    if (isSaving()) return;
    const nextServers = props.vault.servers.filter((item) => item.id !== server.id);
    await persist({
      ...props.vault,
      servers: nextServers,
      accounts: props.vault.accounts.filter((account) => account.serverId !== server.id),
    });
    const nextSelectedId = resolveSelectedServerId(nextServers, selectedServerId());
    setSelectedServerId(nextSelectedId);
    if (nextSelectedId) writeLastSelectedServerId(nextSelectedId);
    setPendingDelete(null);
    toast.success("分组已删除");
  }

  function copyValue(value: string, message: string) {
    void copyText(value);
    toast.success(message);
  }

  function closeForm() {
    setEditingId(null);
    setForm({ ...emptyForm, serverId: activeServer()?.id ?? "" });
    setIsFormOpen(false);
  }

  const deleteDialogTitle = () => {
    const target = pendingDelete();
    if (!target) return "";
    return target.type === "server" ? "删除分组" : "删除账号";
  };

  const deleteDialogDescription = () => {
    const target = pendingDelete();
    if (!target) return "";
    if (target.type === "server") {
      return `确定删除分组「${target.item.name}」？该分组下所有账号也会被删除。`;
    }
    return `确定删除角色「${target.item.characterName}」的账号记录？`;
  };

  return (
    <>
      <Toaster position="top-center" richColors duration={2600} visibleToasts={2} gap={6} offset={8} />
      <div class="mobile-app-shell">
        {/* 顶栏 */}
        <header class="mobile-topbar">
          <div class="mobile-topbar-start">
            <div style="display:flex;gap:4px;align-items:center">
              <ServerSelect
                servers={sortedServers()}
                value={selectedServerId() ?? ""}
                title="选择分组"
                onChange={(serverId) => {
                  setSelectedServerId(serverId);
                  writeLastSelectedServerId(serverId);
                }}
              />
              <button
                class="mobile-topbar-btn"
                type="button"
                onClick={() => setShowAddGroup(!showAddGroup())}
                aria-label="添加分组"
                style="width:32px;height:32px;flex-shrink:0"
              >
                <FolderPlus size={16} />
              </button>
            </div>
          </div>
          <div class="mobile-topbar-end">
            <button class="mobile-topbar-btn" type="button" onClick={() => setShowSettings(true)} aria-label="设置">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* 搜索栏 */}
        <div class="mobile-search-bar">
          <Search size={16} />
          <input
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索角色名/账号"
          />
        </div>

        {/* 添加分组（折叠） */}
        <Show when={showAddGroup()}>
          <form
            class="mobile-search-bar"
            onSubmit={addGroup}
            style="margin-top:0;border-color:rgba(56,189,248,0.3)"
          >
            <input
              value={newGroupName()}
              onInput={(event) => setNewGroupName(event.currentTarget.value)}
              placeholder="输入新分组名称"
              style="border:none;background:transparent;outline:none;flex:1;color:#f8fafc;font-size:15px"
              autofocus
            />
            <button type="submit" style="border:none;background:transparent;color:#60a5fa;font-size:14px;font-weight:600;padding:4px 8px">
              添加
            </button>
          </form>
        </Show>

        {/* 角色列表 */}
        <MobileAccountList
          accounts={filteredAccounts()}
          hasServer={sortedServers().length > 0}
          onShare={(account) => copyValue(buildShareText(account), `已复制「${account.characterName}」的分享信息`)}
          onEdit={startEdit}
          onDelete={(account) => setPendingDelete({ type: "account", item: account })}
        />

        {/* 浮动按钮组 */}
        <div class="mobile-fab-group">
          <button
            class="mobile-fab-secondary"
            type="button"
            onClick={startQuickAddAccount}
            aria-label="从剪贴板快捷添加"
            title="从剪贴板快捷添加"
          >
            <ClipboardPaste size={20} />
          </button>
          <button class="mobile-fab" type="button" onClick={startCreateAccount} aria-label="添加账号">
            <Plus size={24} />
          </button>
        </div>

        {/* 表单弹层 */}
        <Show when={isFormOpen()}>
          <MobileAccountForm
            form={form()}
            servers={sortedServers()}
            professions={props.vault.professions}
            isEditing={editingId() !== null}
            onInput={setForm}
            onSubmit={submitAccount}
            onCancel={closeForm}
          />
        </Show>

        {/* 设置页 */}
        <Show when={showSettings()}>
          <MobileSettings
            servers={sortedServers()}
            professions={props.vault.professions}
            newProfession={newProfession()}
            currentMasterPassword={currentMasterPassword()}
            nextMasterPassword={nextMasterPassword()}
            confirmNextMasterPassword={confirmNextMasterPassword()}
            vault={props.vault}
            masterPassword={props.masterPassword}
            onVaultChange={props.onVaultChange}
            onNewProfessionInput={setNewProfession}
            onAddProfession={async (event) => {
              event.preventDefault();
              const profession = newProfession().trim();
              if (!profession) return;
              if (props.vault.professions.includes(profession)) {
                toast.error("该职业已存在");
                return;
              }
              await persist({ ...props.vault, professions: [...props.vault.professions, profession] });
              setNewProfession("");
              toast.success("职业已添加");
            }}
            onDeleteProfession={async (profession) => {
              await persist({
                ...props.vault,
                professions: props.vault.professions.filter((p) => p !== profession),
              });
              toast.success("职业已删除");
            }}
            onRenameServer={async (serverId, name) => {
              const nextName = name.trim();
              if (!nextName) return;
              const current = props.vault.servers.find((s) => s.id === serverId);
              if (!current || current.name === nextName) return;
              await persist({
                ...props.vault,
                servers: props.vault.servers.map((s) =>
                  s.id === serverId ? { ...s, name: nextName, updatedAt: new Date().toISOString() } : s,
                ),
              });
              toast.success("分组已更新");
            }}
            onCurrentMasterPasswordInput={setCurrentMasterPassword}
            onNextMasterPasswordInput={setNextMasterPassword}
            onConfirmNextMasterPasswordInput={setConfirmNextMasterPassword}
            onResetMasterPassword={async (event) => {
              event.preventDefault();
              if (currentMasterPassword() !== props.masterPassword) {
                toast.error("当前主密码不正确");
                return;
              }
              if (nextMasterPassword().length < 1) {
                toast.error("新主密码至少需要 1 位");
                return;
              }
              if (nextMasterPassword() !== confirmNextMasterPassword()) {
                toast.error("两次输入的新主密码不一致");
                return;
              }
              try {
                setIsSaving(true);
                await saveVault(props.vault, nextMasterPassword());
                props.onMasterPasswordChange(nextMasterPassword());
                setCurrentMasterPassword("");
                setNextMasterPassword("");
                setConfirmNextMasterPassword("");
                toast.success("主密码已重置");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "重置失败");
              } finally {
                setIsSaving(false);
              }
            }}
            onClose={() => setShowSettings(false)}
          />
        </Show>
      </div>

      {/* 删除确认对话框 */}
      <Show when={pendingDelete()}>
        <ConfirmDialog
          title={deleteDialogTitle()}
          description={deleteDialogDescription()}
          onConfirm={() => {
            const target = pendingDelete();
            if (!target) return;
            if (target.type === "server") void confirmDeleteServer(target.item);
            else void confirmDeleteAccount(target.item as AccountEntry);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      </Show>
    </>
  );
}
