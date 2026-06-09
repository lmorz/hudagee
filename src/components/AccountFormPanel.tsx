import { For } from "solid-js";
import type { AccountForm, ServerGroup } from "../types";

type AccountFormPanelProps = {
  form: AccountForm;
  servers: ServerGroup[];
  professions: string[];
  isEditing: boolean;
  onInput: (form: AccountForm) => void;
  onSubmit: (event: Event) => void;
  onCancel: () => void;
};

export function AccountFormPanel(props: AccountFormPanelProps) {
  return (
    <div class="dialog-backdrop" onClick={props.onCancel}>
      <form
        class="dialog-panel account-form-panel"
        onSubmit={props.onSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <div class="panel-title">
          <strong>{props.isEditing ? "编辑账号" : "添加账号"}</strong>
          <button class="ghost-button compact" type="button" onClick={props.onCancel}>
            关闭
          </button>
        </div>

        <div class="form-grid">
          <label>
            区服
            <select
              value={props.form.serverId}
              onChange={(event) => props.onInput({ ...props.form, serverId: event.currentTarget.value })}
            >
              <option value="" disabled>
                选择区服
              </option>
              <For each={props.servers}>
                {(server) => <option value={server.id}>{server.name}</option>}
              </For>
            </select>
          </label>
          <label>
            职业
            <select
              value={props.form.profession}
              onChange={(event) => props.onInput({ ...props.form, profession: event.currentTarget.value })}
            >
              <option value="">未选择</option>
              <For each={props.professions}>
                {(profession) => <option value={profession}>{profession}</option>}
              </For>
            </select>
          </label>
          <label>
            角色名
            <input
              value={props.form.characterName}
              onInput={(event) => props.onInput({ ...props.form, characterName: event.currentTarget.value })}
              placeholder="角色名"
            />
          </label>
          <label>
            账号
            <input
              value={props.form.username}
              onInput={(event) => props.onInput({ ...props.form, username: event.currentTarget.value })}
              placeholder="账号"
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={props.form.password}
              onInput={(event) => props.onInput({ ...props.form, password: event.currentTarget.value })}
              placeholder="密码"
            />
          </label>
        </div>

        <label>
          备注
          <textarea
            value={props.form.note}
            onInput={(event) => props.onInput({ ...props.form, note: event.currentTarget.value })}
            placeholder="备注"
            rows={2}
          />
        </label>

        <button class="primary-button compact" type="submit">
          {props.isEditing ? "保存" : "添加"}
        </button>
      </form>
    </div>
  );
}
