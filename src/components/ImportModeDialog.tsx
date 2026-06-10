import { Show } from "solid-js";

type ImportModeDialogProps =
  | {
      stage: "password";
      isBusy: boolean;
      backupPassword: string;
      error: string;
      onBackupPasswordInput: (value: string) => void;
      onConfirmPassword: () => void;
      onCancel: () => void;
    }
  | {
      stage: "mode";
      isBusy: boolean;
      onMerge: () => void;
      onReplace: () => void;
      onCancel: () => void;
    };

export function ImportModeDialog(props: ImportModeDialogProps) {
  if (props.stage === "password") {
    return (
      <div class="dialog-backdrop" onClick={() => !props.isBusy && props.onCancel()}>
        <section class="dialog-panel confirm-panel" onClick={(event) => event.stopPropagation()}>
          <div class="panel-title">
            <strong>导入备份</strong>
          </div>
          <p class="muted">
            备份主密码与当前保险库不一致，请输入导出备份时使用的主密码。导入后将用当前保险库主密码保存。
          </p>
          <label>
            备份主密码
            <input
              type="password"
              value={props.backupPassword}
              disabled={props.isBusy}
              onInput={(event) => props.onBackupPasswordInput(event.currentTarget.value)}
              placeholder="导出备份时使用的主密码"
            />
          </label>
          <Show when={props.error}>
            <p class="error-text">{props.error}</p>
          </Show>
          <div class="confirm-actions">
            <button class="ghost-button compact" type="button" onClick={props.onCancel} disabled={props.isBusy}>
              取消
            </button>
            <button class="primary-button compact" type="button" onClick={props.onConfirmPassword} disabled={props.isBusy}>
              {props.isBusy ? "处理中" : "继续"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div class="dialog-backdrop" onClick={() => !props.isBusy && props.onCancel()}>
      <section class="dialog-panel confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div class="panel-title">
          <strong>导入备份</strong>
        </div>
        <p class="muted">
          合并导入会把同名分组合并，并跳过重复账号。覆盖恢复会替换当前全部数据，请确认已备份当前保险库。
        </p>
        <div class="confirm-actions">
          <button class="ghost-button compact" type="button" onClick={props.onCancel} disabled={props.isBusy}>
            取消
          </button>
          <button class="danger-button compact" type="button" onClick={props.onReplace} disabled={props.isBusy}>
            {props.isBusy ? "处理中" : "覆盖恢复"}
          </button>
          <button class="primary-button compact" type="button" onClick={props.onMerge} disabled={props.isBusy}>
            {props.isBusy ? "处理中" : "合并导入"}
          </button>
        </div>
      </section>
    </div>
  );
}
