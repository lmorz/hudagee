import { ArrowLeft, Plus, X } from "lucide-solid";
import { For, Show } from "solid-js";
import type { ServerGroup, VaultData } from "../../types";
import { isTauriRuntime } from "../../lib/tauri";
import { AppearanceSettings } from "../AppearanceSettings";
import { SyncPanel } from "../SyncPanel";

type MobileSettingsProps = {
  servers: ServerGroup[];
  professions: string[];
  newProfession: string;
  currentMasterPassword: string;
  nextMasterPassword: string;
  confirmNextMasterPassword: string;
  vault: VaultData;
  masterPassword: string;
  onVaultChange: (vault: VaultData) => void;
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

export function MobileSettings(props: MobileSettingsProps) {
  return (
    <div class="mobile-fullscreen-form">
      <div class="mobile-form-header">
        <button class="mobile-icon-btn" type="button" onClick={props.onClose} aria-label="返回">
          <ArrowLeft size={22} />
        </button>
        <h2>设置</h2>
        <div style="width: 32px" />
      </div>

      <div class="mobile-settings-body">
        <section class="mobile-settings-section">
          <h3 class="mobile-settings-section-title">外观</h3>
          <AppearanceSettings />
        </section>

        <Show when={isTauriRuntime()}>
          <section class="mobile-settings-section">
            <h3 class="mobile-settings-section-title">局域网同步</h3>
            <SyncPanel
              variant="mobile"
              vault={props.vault}
              masterPassword={props.masterPassword}
              onVaultChange={props.onVaultChange}
            />
          </section>
        </Show>

        <section class="mobile-settings-section">
          <h3 class="mobile-settings-section-title">分组配置</h3>
          <div class="mobile-settings-list">
            <For each={props.servers} fallback={<span class="mobile-muted">暂无分组</span>}>
              {(server) => (
                <form
                  class="mobile-settings-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = event.currentTarget.querySelector("input");
                    if (input) {
                      props.onRenameServer(server.id, input.value);
                    }
                  }}
                >
                  <input
                    class="mobile-settings-input"
                    value={server.name}
                    onInput={() => {}}
                    placeholder="分组名称"
                  />
                </form>
              )}
            </For>
          </div>
        </section>

        <section class="mobile-settings-section">
          <h3 class="mobile-settings-section-title">职业配置</h3>
          <form class="mobile-settings-inline-form" onSubmit={props.onAddProfession}>
            <input
              value={props.newProfession}
              onInput={(event) => props.onNewProfessionInput(event.currentTarget.value)}
              placeholder="新职业名称"
            />
            <button class="mobile-icon-btn" type="submit" aria-label="添加职业">
              <Plus size={18} />
            </button>
          </form>
          <div class="mobile-tags">
            <For each={props.professions}>
              {(profession) => (
                <span class="mobile-tag">
                  {profession}
                  <button
                    type="button"
                    onClick={() => props.onDeleteProfession(profession)}
                    aria-label={`删除 ${profession}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
            </For>
          </div>
        </section>

        <section class="mobile-settings-section">
          <h3 class="mobile-settings-section-title">重置主密码</h3>
          <form class="mobile-settings-form" onSubmit={props.onResetMasterPassword}>
            <label>
              当前主密码
              <input
                type="password"
                value={props.currentMasterPassword}
                onInput={(event) => props.onCurrentMasterPasswordInput(event.currentTarget.value)}
                placeholder="输入当前主密码"
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
                placeholder="再次输入新主密码"
              />
            </label>
            <button class="mobile-btn-primary mobile-btn-full" type="submit">
              重置密码
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
