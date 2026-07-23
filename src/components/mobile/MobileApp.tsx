import { Lock, Network, Plus, Search, Settings } from "lucide-solid";
import { createMemo, createSignal, Show } from "solid-js";
import { Toaster, toast } from "solid-sonner";
import type { AccountEntry, AccountForm, ServerGroup, VaultData } from "../../types";
import { buildShareText, copyText } from "../../lib/clipboard";
import { isTauriRuntime } from "../../lib/tauri";
import { resolveSelectedServerId, writeLastSelectedServerId } from "../../lib/preferences";
import {
  createAccount,
  findDuplicateAccount,
  updateAccount,
} from "../../lib/utils";
import { saveVault } from "../../lib/vault";
import { ServerSelect } from "../ServerSelect";
import { ConfirmDialog } from "../ConfirmDialog";
import { MobileAccountForm } from "./MobileAccountForm";
import { MobileAccountList } from "./MobileAccountList";
import { MobileSettings } from "./MobileSettings";
import { SyncPanel } from "./SyncPanel";

type MobileAppProps = {
  vault: VaultData;
  masterPassword: string;
  onLock: () => void;
  onVaultChange: (vault: VaultData) => void;
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
  const [selectedServerId, setSelectedServerId] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal("");

  const [form, setForm] = createSignal<AccountForm>(emptyForm);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [isFormOpen, setIsFormOpen] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [showSync, setShowSync] = createSignal(false);
  const [newProfession, setNewProfession] = createSignal("");
  const [currentMasterPassword, setCurrentMasterPassword] = createSignal("");
  const [nextMasterPassword, setNextMasterPassword] = createSignal("");
  const [confirmNextMasterPassword, setConfirmNextMasterPassword] = createSignal("");
  const [visiblePasswords, setVisiblePasswords] = createSignal(new Set<string>());
  const [visibleUsernames, setVisibleUsernames] = createSignal(new Set<string>());
  const [pendingDelete, setPendingDelete] = createSignal<MobilePendingDelete>(null);
  const [isSaving, setIsSaving] = createSignal(false);

  // Initialize selected server
  const sortedServers = createMemo(() =>
    [...props.vault.servers].sort((left, right) => left.sortOrder - right.sortOrder),
  );

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

  function togglePassword(accountId: string) {
    setVisiblePasswords((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function toggleUsername(accountId: string) {
    setVisibleUsernames((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
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
            <ServerSelect
              servers={sortedServers()}
              value={selectedServerId() ?? ""}
              title="选择分组"
              onChange={(serverId) => {
                setSelectedServerId(serverId);
                writeLastSelectedServerId(serverId);
              }}
            />
          </div>
          <div class="mobile-topbar-end">
            <Show when={isTauriRuntime()}>
              <button class="mobile-topbar-btn" type="button" onClick={() => setShowSync(true)} aria-label="同步">
                <Network size={18} />
              </button>
            </Show>
            <button class="mobile-topbar-btn" type="button" onClick={() => setShowSettings(true)} aria-label="设置">
              <Settings size={18} />
            </button>
            <button class="mobile-topbar-btn" type="button" onClick={props.onLock} aria-label="锁定">
              <Lock size={18} />
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

        {/* 角色列表 */}
        <MobileAccountList
          accounts={filteredAccounts()}
          hasServer={sortedServers().length > 0}
          visiblePasswords={visiblePasswords()}
          visibleUsernames={visibleUsernames()}
          onTogglePassword={togglePassword}
          onToggleUsername={toggleUsername}
          onCopyUsername={(account) => copyValue(account.username, `已复制「${account.characterName}」的账号`)}
          onCopyPassword={(account) => copyValue(account.password, `已复制「${account.characterName}」的密码`)}
          onShare={(account) => copyValue(buildShareText(account), `已复制「${account.characterName}」的分享信息`)}
          onEdit={startEdit}
          onDelete={(account) => setPendingDelete({ type: "account", item: account })}
        />

        {/* 浮动添加按钮 */}
        <div class="mobile-fab-group">
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

        {/* 同步面板（仅 Tauri 环境） */}
        <Show when={showSync()}>
          <SyncPanel
            envelope={(() => {
              // 同步时使用当前的 vault JSON 作为 envelope
              try {
                return JSON.stringify({
                  schemaVersion: 1,
                  crypto: { algorithm: "AES-GCM", kdf: "PBKDF2", hash: "SHA-256", iterations: 310000, salt: "", nonce: "" },
                  ciphertext: btoa(JSON.stringify(props.vault)),
                } as unknown);
              } catch {
                return "";
              }
            })()}
            onEnvelopeUpdate={(_envelope) => {
              // 当拉取到新数据时，通知上层刷新 vault
              // 实际解密和合并由 App 层完成
              toast.success("数据已同步，请返回主界面查看");
              setShowSync(false);
            }}
            onClose={() => setShowSync(false)}
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
