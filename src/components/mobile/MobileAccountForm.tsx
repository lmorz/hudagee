import { For, Show } from "solid-js";
import { ArrowLeft } from "lucide-solid";
import type { AccountForm, ServerGroup } from "../../types";
import { ServerSelect } from "../ServerSelect";

type MobileAccountFormProps = {
  form: AccountForm;
  servers: ServerGroup[];
  professions: string[];
  isEditing: boolean;
  onInput: (form: AccountForm) => void;
  onSubmit: (event: Event) => void;
  onCancel: () => void;
};

export function MobileAccountForm(props: MobileAccountFormProps) {
  return (
    <div class="mobile-fullscreen-form">
      <div class="mobile-form-header">
        <button class="mobile-icon-btn" type="button" onClick={props.onCancel} aria-label="返回">
          <ArrowLeft size={22} />
        </button>
        <h2>{props.isEditing ? "编辑账号" : "添加账号"}</h2>
        <div style="width: 32px" />
      </div>

      <form class="mobile-form-body" onSubmit={props.onSubmit}>
        <div class="mobile-form-fields">
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
              placeholder="输入角色名"
            />
          </label>
          <label>
            账号
            <input
              value={props.form.username}
              onInput={(event) => props.onInput({ ...props.form, username: event.currentTarget.value })}
              placeholder="输入账号"
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={props.form.password}
              onInput={(event) => props.onInput({ ...props.form, password: event.currentTarget.value })}
              placeholder="输入密码"
            />
          </label>
          <label>
            备注
            <textarea
              value={props.form.note}
              onInput={(event) => props.onInput({ ...props.form, note: event.currentTarget.value })}
              placeholder="备注（可选）"
              rows={3}
            />
          </label>
        </div>

        <button class="mobile-btn-primary mobile-btn-full" type="submit">
          {props.isEditing ? "保存" : "添加"}
        </button>
      </form>
    </div>
  );
}
