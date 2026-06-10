import { Eye, EyeOff, GripVertical, Send } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import type { AccountEntry } from "../types";

type AccountListProps = {
  accounts: AccountEntry[];
  hasServer: boolean;
  visiblePasswords: Set<string>;
  visibleUsernames: Set<string>;
  allPasswordsVisible: boolean;
  allUsernamesVisible: boolean;
  isReorderEnabled: boolean;
  onTogglePassword: (accountId: string) => void;
  onToggleUsername: (accountId: string) => void;
  onToggleAllPasswords: () => void;
  onToggleAllUsernames: () => void;
  onCopyUsername: (account: AccountEntry) => void;
  onCopyPassword: (account: AccountEntry) => void;
  onShare: (account: AccountEntry) => void;
  onEdit: (account: AccountEntry) => void;
  onDelete: (account: AccountEntry) => void;
  onReorder: (draggedId: string, targetId: string, placement: "before" | "after") => void;
};

export function AccountList(props: AccountListProps) {
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dropTarget, setDropTarget] = createSignal<{
    accountId: string;
    placement: "before" | "after";
  } | null>(null);
  const [isDragArmed, setIsDragArmed] = createSignal(false);

  const isUsernameVisible = (account: AccountEntry) =>
    props.allUsernamesVisible || props.visibleUsernames.has(account.id);
  const isPasswordVisible = (account: AccountEntry) =>
    props.allPasswordsVisible || props.visiblePasswords.has(account.id);
  const canReorder = () => props.isReorderEnabled && props.accounts.length > 1;

  function handleDragStart(event: DragEvent, account: AccountEntry) {
    if (!canReorder() || !isDragArmed()) {
      event.preventDefault();
      return;
    }

    setDraggedId(account.id);
    event.dataTransfer?.setData("text/plain", account.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(event: DragEvent, account: AccountEntry) {
    const currentDraggedId = draggedId();
    if (!canReorder() || !currentDraggedId || currentDraggedId === account.id) {
      return;
    }

    event.preventDefault();
    const placement = getDropPlacement(event);
    setDropTarget({ accountId: account.id, placement });
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(event: DragEvent, account: AccountEntry) {
    event.preventDefault();
    const currentDraggedId = draggedId();
    const placement = getDropPlacement(event);
    setDraggedId(null);
    setDropTarget(null);
    setIsDragArmed(false);

    if (!canReorder() || !currentDraggedId || currentDraggedId === account.id) {
      return;
    }

    props.onReorder(currentDraggedId, account.id, placement);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTarget(null);
    setIsDragArmed(false);
  }

  function getDropPlacement(event: DragEvent): "before" | "after" {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  return (
    <section class="account-list">
      <Show when={props.hasServer} fallback={<div class="empty-state">先添加分组</div>}>
        <div class="account-table">
          <div class="account-row table-head">
            <span class="drag-column">排序</span>
            <span>角色名</span>
            <span class="head-control">
              账号
              <button type="button" onClick={props.onToggleAllUsernames} title="显示/隐藏全部账号">
                {props.allUsernamesVisible ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </span>
            <span class="head-control">
              密码
              <button type="button" onClick={props.onToggleAllPasswords} title="显示/隐藏全部密码">
                {props.allPasswordsVisible ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
            </span>
            <span>备注</span>
            <span>操作</span>
          </div>
          <For each={props.accounts} fallback={<div class="empty-state">暂无账号，点击「添加账号」</div>}>
            {(account) => (
              <div
                classList={{
                  "account-row": true,
                  "is-dragging": draggedId() === account.id,
                  "drop-before": dropTarget()?.accountId === account.id && dropTarget()?.placement === "before",
                  "drop-after": dropTarget()?.accountId === account.id && dropTarget()?.placement === "after",
                }}
                draggable={canReorder()}
                onDragStart={(event) => handleDragStart(event, account)}
                onDragOver={(event) => handleDragOver(event, account)}
                onDragLeave={() => {
                  if (dropTarget()?.accountId === account.id) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(event) => handleDrop(event, account)}
                onDragEnd={handleDragEnd}
              >
                <span
                  class="drag-handle"
                  classList={{ "is-disabled": !canReorder() }}
                  title={canReorder() ? "拖拽调整顺序" : "搜索时不可排序"}
                  aria-label="拖拽调整账号顺序"
                  role="button"
                  tabIndex={canReorder() ? 0 : -1}
                  onPointerDown={(event) => {
                    if (canReorder()) {
                      setIsDragArmed(true);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }
                  }}
                  onPointerUp={() => setIsDragArmed(false)}
                  onPointerCancel={() => setIsDragArmed(false)}
                  onLostPointerCapture={() => setIsDragArmed(false)}
                >
                  <GripVertical size={14} />
                </span>
                <div class="identity-cell">
                  <strong>{account.characterName}</strong>
                  <span class="profession-tag">{account.profession || "未配置"}</span>
                </div>
                <div class="secret-cell">
                  <button
                    class="cell-copy mono-cell"
                    type="button"
                    onClick={() => props.onCopyUsername(account)}
                    title="点击复制账号"
                  >
                    {isUsernameVisible(account) ? account.username : "••••••"}
                  </button>
                  <button
                    class="secret-toggle"
                    type="button"
                    onClick={() => props.onToggleUsername(account.id)}
                    title={isUsernameVisible(account) ? "隐藏账号" : "显示账号"}
                  >
                    {isUsernameVisible(account) ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
                <div class="secret-cell">
                  <button
                    class="cell-copy mono-cell"
                    type="button"
                    onClick={() => props.onCopyPassword(account)}
                    title="点击复制密码"
                  >
                    {isPasswordVisible(account) ? account.password : "••••••"}
                  </button>
                  <button
                    class="secret-toggle"
                    type="button"
                    onClick={() => props.onTogglePassword(account.id)}
                    title={isPasswordVisible(account) ? "隐藏密码" : "显示密码"}
                  >
                    {isPasswordVisible(account) ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>
                </div>
                <span class="note-cell" title={account.note}>
                  {account.note || "-"}
                </span>
                <div class="row-actions">
                  <button class="icon-button compact" type="button" onClick={() => props.onShare(account)} title="分享">
                    <Send size={12} />
                  </button>
                  <button class="ghost-button compact" type="button" onClick={() => props.onEdit(account)}>
                    编辑
                  </button>
                  <button class="danger-button compact" type="button" onClick={() => props.onDelete(account)}>
                    删除
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
}
