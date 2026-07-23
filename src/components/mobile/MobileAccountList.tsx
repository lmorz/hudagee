import { For, Show } from "solid-js";
import type { AccountEntry } from "../../types";
import { MobileAccountCard } from "./MobileAccountCard";

type MobileAccountListProps = {
  accounts: AccountEntry[];
  hasServer: boolean;
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
