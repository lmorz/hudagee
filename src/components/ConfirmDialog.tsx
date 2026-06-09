type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <div class="dialog-backdrop" onClick={props.onCancel}>
      <section class="dialog-panel confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div class="panel-title">
          <strong>{props.title}</strong>
        </div>
        <p class="muted">{props.description}</p>
        <div class="confirm-actions">
          <button class="ghost-button compact" type="button" onClick={props.onCancel}>
            取消
          </button>
          <button class="danger-button compact" type="button" onClick={props.onConfirm}>
            {props.confirmText ?? "删除"}
          </button>
        </div>
      </section>
    </div>
  );
}
