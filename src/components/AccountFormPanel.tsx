import { For, Show } from "solid-js";
import type { AccountForm, ServerGroup } from "../types";
import { ServerSelect } from "./ServerSelect";

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
            分组
            <ServerSelect
              servers={props.servers}
              value={props.form.serverId}
              onChange={(serverId) => props.onInput({ ...props.form, serverId })}
            />
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
              <Show when={props.form.profession && !props.professions.includes(props.form.profession)}>
                <option value={props.form.profession}>{props.form.profession}</option>
              </Show>
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
