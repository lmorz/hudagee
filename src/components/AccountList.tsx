import { Eye, EyeOff, Send } from "lucide-solid";
import { For, Show } from "solid-js";
import type { AccountEntry } from "../types";

type AccountListProps = {
  accounts: AccountEntry[];
  hasServer: boolean;
  visiblePasswords: Set<string>;
  visibleUsernames: Set<string>;
  allPasswordsVisible: boolean;
  allUsernamesVisible: boolean;
  onTogglePassword: (accountId: string) => void;
  onToggleUsername: (accountId: string) => void;
  onToggleAllPasswords: () => void;
  onToggleAllUsernames: () => void;
  onCopyUsername: (account: AccountEntry) => void;
  onCopyPassword: (account: AccountEntry) => void;
  onShare: (account: AccountEntry) => void;
  onEdit: (account: AccountEntry) => void;
  onDelete: (account: AccountEntry) => void;
};

export function AccountList(props: AccountListProps) {
  const isUsernameVisible = (account: AccountEntry) =>
    props.allUsernamesVisible || props.visibleUsernames.has(account.id);
  const isPasswordVisible = (account: AccountEntry) =>
    props.allPasswordsVisible || props.visiblePasswords.has(account.id);

  return (
    <section class="account-list">
      <Show when={props.hasServer} fallback={<div class="empty-state">先添加区服</div>}>
        <div class="account-table">
          <div class="account-row table-head">
            <span>角色</span>
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
          <For each={props.accounts} fallback={<div class="empty-state">暂无账号，点击“账号”添加</div>}>
            {(account) => (
              <div class="account-row">
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
