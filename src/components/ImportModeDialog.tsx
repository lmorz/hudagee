type ImportModeDialogProps = {
  isBusy: boolean;
  onMerge: () => void;
  onReplace: () => void;
  onCancel: () => void;
};

export function ImportModeDialog(props: ImportModeDialogProps) {
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
