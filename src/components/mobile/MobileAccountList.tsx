import { For, Show } from "solid-js";
import type { AccountEntry } from "../../types";
import { MobileAccountCard } from "./MobileAccountCard";

type MobileAccountListProps = {
  accounts: AccountEntry[];
  hasServer: boolean;
  visiblePasswords: Set<string>;
  visibleUsernames: Set<string>;
  onTogglePassword: (accountId: string) => void;
  onToggleUsername: (accountId: string) => void;
  onCopyUsername: (account: AccountEntry) => void;
  onCopyPassword: (account: AccountEntry) => void;
  onShare: (account: AccountEntry) => void;
  onEdit: (account: AccountEntry) => void;
  onDelete: (account: AccountEntry) => void;
};

export function MobileAccountList(props: MobileAccountListProps) {
  return (
    <div class="mobile-account-list">
      <Show
        when={props.hasServer}
        fallback={<div class="mobile-empty-state">请先添加分组</div>}
      >
        <Show
          when={props.accounts.length > 0}
          fallback={<div class="mobile-empty-state">暂无账号，点击下方按钮添加</div>}
        >
          <For each={props.accounts}>
            {(account) => (
              <MobileAccountCard
                account={account}
                isPasswordVisible={props.visiblePasswords.has(account.id) || props.visiblePasswords.size === 0}
                isUsernameVisible={props.visibleUsernames.has(account.id) || props.visibleUsernames.size === 0}
                onTogglePassword={props.onTogglePassword}
                onToggleUsername={props.onToggleUsername}
                onCopyUsername={props.onCopyUsername}
                onCopyPassword={props.onCopyPassword}
                onShare={props.onShare}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
              />
            )}
          </For>
        </Show>
      </Show>
    </div>
  );
}
