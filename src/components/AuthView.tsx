import { ShieldCheck } from "lucide-solid";
import { Show } from "solid-js";

type AuthViewProps = {
  mode: "loading" | "setup" | "unlock";
  masterPassword: string;
  confirmPassword: string;
  error: string;
  onMasterPasswordInput: (value: string) => void;
  onConfirmPasswordInput: (value: string) => void;
  onSubmit: (event: Event) => void;
};

export function AuthView(props: AuthViewProps) {
  if (props.mode === "loading") {
    return (
      <div class="auth-shell">
        <div class="auth-card">正在加载本地保险库...</div>
      </div>
    );
  }

  return (
    <div class="auth-shell">
      <form class="auth-card" onSubmit={props.onSubmit}>
        <div class="brand-mark">
          <ShieldCheck size={26} />
        </div>
        <p class="eyebrow">HuDaGee</p>
        <h1>{props.mode === "setup" ? "创建保险库" : "解锁保险库"}</h1>
        <p class="muted">数据只保存在本机，主密码忘记后无法找回。</p>
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
              placeholder="再次输入"
            />
          </label>
        </Show>
        <Show when={props.error}>
          <p class="error-text">{props.error}</p>
        </Show>
        <button class="primary-button" type="submit">
          {props.mode === "setup" ? "创建" : "解锁"}
        </button>
      </form>
    </div>
  );
}
