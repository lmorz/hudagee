import { Show } from "solid-js";
import { ShieldCheck } from "lucide-solid";

type MobileAuthViewProps =
  | {
      mode: "loading" | "setup" | "unlock";
      masterPassword: string;
      confirmPassword: string;
      error: string;
      onMasterPasswordInput: (value: string) => void;
      onConfirmPasswordInput: (value: string) => void;
      onSubmit: (event: Event) => void;
    }
  | {
      mode: "corrupted";
      error: string;
      masterPassword: string;
      isBusy: boolean;
      onMasterPasswordInput: (value: string) => void;
      onRestoreFromBackup: () => void;
      onRecreateVault: () => void;
    };

export function MobileAuthView(props: MobileAuthViewProps) {
  if (props.mode === "loading") {
    return (
      <div class="mobile-auth-shell">
        <div class="mobile-auth-card">正在加载本地保险库...</div>
      </div>
    );
  }

  if (props.mode === "corrupted") {
    return (
      <div class="mobile-auth-shell">
        <div class="mobile-auth-card">
          <div class="mobile-brand-mark">
            <ShieldCheck size={28} />
          </div>
          <p class="mobile-eyebrow">HuDaGee</p>
          <h1>保险库无法加载</h1>
          <p class="mobile-muted">
            本地保险库文件已损坏，可从备份恢复，或删除损坏文件后重新创建。
          </p>
          <label>
            备份主密码
            <input
              type="password"
              value={props.masterPassword}
              disabled={props.isBusy}
              onInput={(event) => props.onMasterPasswordInput(event.currentTarget.value)}
              placeholder="输入备份文件的主密码"
            />
          </label>
          <Show when={props.error}>
            <p class="mobile-error">{props.error}</p>
          </Show>
          <div class="mobile-auth-actions">
            <button
              class="mobile-btn-primary"
              type="button"
              disabled={props.isBusy}
              onClick={props.onRestoreFromBackup}
            >
              {props.isBusy ? "处理中..." : "从备份恢复"}
            </button>
            <button
              class="mobile-btn-ghost"
              type="button"
              disabled={props.isBusy}
              onClick={props.onRecreateVault}
            >
              重新创建保险库
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="mobile-auth-shell">
      <form class="mobile-auth-card" onSubmit={props.onSubmit}>
        <div class="mobile-brand-mark">
          <ShieldCheck size={28} />
        </div>
        <p class="mobile-eyebrow">HuDaGee</p>
        <h1>{props.mode === "setup" ? "创建保险库" : "解锁保险库"}</h1>
        <p class="mobile-muted">数据只保存在本机，主密码忘记后无法找回。</p>
        <label>
          主密码
          <input
            type="password"
            value={props.masterPassword}
            onInput={(event) => props.onMasterPasswordInput(event.currentTarget.value)}
            placeholder="至少 1 位"
          />
        </label>
        <Show when={props.mode === "setup"}>
          <label>
            确认主密码
            <input
              type="password"
              value={props.confirmPassword}
              onInput={(event) => props.onConfirmPasswordInput(event.currentTarget.value)}
              placeholder="再次输入主密码"
            />
          </label>
        </Show>
        <Show when={props.error}>
          <p class="mobile-error">{props.error}</p>
        </Show>
        <button class="mobile-btn-primary" type="submit">
          {props.mode === "setup" ? "创建" : "解锁"}
        </button>
      </form>
    </div>
  );
}
