import { ChevronDown, ChevronUp, Edit, Send, Trash2 } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import type { AccountEntry } from "../../types";

type MobileAccountCardProps = {
  account: AccountEntry;
  onShare: (account: AccountEntry) => void;
  onEdit: (account: AccountEntry) => void;
  onDelete: (account: AccountEntry) => void;
};

export function MobileAccountCard(props: MobileAccountCardProps) {
  const [expanded, setExpanded] = createSignal(false);
  const account = () => props.account;

  return (
    <div class="mobile-card" classList={{ "is-expanded": expanded() }}>
      <button
        class="mobile-card-header"
        type="button"
        onClick={() => setExpanded(!expanded())}
        aria-label={expanded() ? "收起详情" : "展开详情"}
      >
        <div class="mobile-card-identity">
          <span class="mobile-profession-tag">{account().profession || "未配置"}</span>
          <strong>{account().characterName}</strong>
        </div>
        <div class="mobile-card-chevron">
          {expanded() ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      <Show when={expanded()}>
        <div class="mobile-card-body">
          <div class="mobile-card-creds">
            <div class="mobile-card-field">
              <span class="mobile-field-label">账号</span>
              <span class="mobile-field-value mono">{account().username}</span>
            </div>
            <div class="mobile-card-field">
              <span class="mobile-field-label">密码</span>
              <span class="mobile-field-value mono">{account().password}</span>
            </div>
          </div>

          <div class="mobile-card-field">
            <span class="mobile-field-label">备注</span>
            <span class="mobile-field-value">{account().note || "无"}</span>
          </div>

          <div class="mobile-card-actions">
            <button
              class="mobile-action-btn"
              type="button"
              onClick={() => props.onShare(account())}
              aria-label="分享"
            >
              <Send size={16} /> 分享
            </button>
            <button
              class="mobile-action-btn"
              type="button"
              onClick={() => props.onEdit(account())}
              aria-label="编辑"
            >
              <Edit size={16} /> 编辑
            </button>
            <button
              class="mobile-action-btn mobile-action-danger"
              type="button"
              onClick={() => props.onDelete(account())}
              aria-label="删除"
            >
              <Trash2 size={16} /> 删除
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
