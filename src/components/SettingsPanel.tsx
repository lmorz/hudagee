import { KeyRound, Plus, Save, X } from "lucide-solid";
import { createEffect, createSignal, For } from "solid-js";
import type { ServerGroup } from "../types";

type SettingsPanelProps = {
  servers: ServerGroup[];
  professions: string[];
  newProfession: string;
  currentMasterPassword: string;
  nextMasterPassword: string;
  confirmNextMasterPassword: string;
  onNewProfessionInput: (value: string) => void;
  onAddProfession: (event: Event) => void;
  onDeleteProfession: (profession: string) => void;
  onRenameServer: (serverId: string, name: string) => void;
  onCurrentMasterPasswordInput: (value: string) => void;
  onNextMasterPasswordInput: (value: string) => void;
  onConfirmNextMasterPasswordInput: (value: string) => void;
  onResetMasterPassword: (event: Event) => void;
  onClose: () => void;
};

export function SettingsPanel(props: SettingsPanelProps) {
  const [serverNameDrafts, setServerNameDrafts] = createSignal<Record<string, string>>({});
  const serverNameDraft = (server: ServerGroup) => serverNameDrafts()[server.id] ?? server.name;

  createEffect(() => {
    setServerNameDrafts(Object.fromEntries(props.servers.map((server) => [server.id, server.name])));
  });

  return (
    <div class="dialog-backdrop" onClick={props.onClose}>
      <section class="dialog-panel settings-dialog" onClick={(event) => event.stopPropagation()}>
        <div class="panel-title">
          <div class="panel-heading">
            <strong>配置</strong>
            <span>职业与安全设置</span>
          </div>
          <button class="ghost-button compact" type="button" onClick={props.onClose}>
            关闭
          </button>
        </div>

        <div class="settings-sections">
          <section class="settings-section">
            <div class="settings-section-head">
              <strong>区服配置</strong>
              <span>编辑已有区服名称</span>
            </div>

            <div class="settings-list">
              <For each={props.servers} fallback={<span class="muted">暂无区服</span>}>
                {(server) => (
                  <form
                    class="settings-list-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      props.onRenameServer(server.id, serverNameDraft(server));
                    }}
                  >
                    <input
                      value={serverNameDraft(server)}
                      onInput={(event) =>
                        setServerNameDrafts({
                          ...serverNameDrafts(),
                          [server.id]: event.currentTarget.value,
                        })
                      }
                      placeholder="区服名称"
                    />
                    <button class="ghost-button compact" type="submit">
                      <Save size={12} />
                      保存
                    </button>
                  </form>
                )}
              </For>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-head">
              <strong>职业配置</strong>
              <span>用于账号表单中的职业选项</span>
            </div>

            <form class="inline-form" onSubmit={props.onAddProfession}>
              <input
                value={props.newProfession}
                onInput={(event) => props.onNewProfessionInput(event.currentTarget.value)}
                placeholder="新增职业"
              />
              <button class="icon-button compact" type="submit" title="新增职业">
                <Plus size={12} />
              </button>
            </form>

            <div class="tag-list">
              <For each={props.professions} fallback={<span class="muted">暂无职业</span>}>
                {(profession) => (
                  <span class="tag">
                    {profession}
                    <button type="button" onClick={() => props.onDeleteProfession(profession)} title="删除职业">
                      <X size={11} />
                    </button>
                  </span>
                )}
              </For>
            </div>
          </section>

          <section class="settings-section">
            <div class="settings-section-head">
              <strong>重置主密码</strong>
              <span>使用新密码重新加密当前保险库</span>
            </div>

            <form class="settings-form" onSubmit={props.onResetMasterPassword}>
              <div class="form-grid">
                <label>
                  当前主密码
                  <input
                    type="password"
                    value={props.currentMasterPassword}
                    onInput={(event) => props.onCurrentMasterPasswordInput(event.currentTarget.value)}
                    placeholder="当前主密码"
                  />
                </label>
                <label>
                  新主密码
                  <input
                    type="password"
                    value={props.nextMasterPassword}
                    onInput={(event) => props.onNextMasterPasswordInput(event.currentTarget.value)}
                    placeholder="至少 1 位"
                  />
                </label>
                <label>
                  确认新主密码
                  <input
                    type="password"
                    value={props.confirmNextMasterPassword}
                    onInput={(event) => props.onConfirmNextMasterPasswordInput(event.currentTarget.value)}
                    placeholder="再次输入"
                  />
                </label>
              </div>

              <div class="settings-actions">
                <button class="primary-button compact" type="submit">
                  <KeyRound size={12} />
                  重置主密码
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </div>
  );
}
