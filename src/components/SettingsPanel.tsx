import { GripVertical, KeyRound, Plus, Save, X } from "lucide-solid";
import { createEffect, createSignal, For, Match, Switch } from "solid-js";
import type { ServerGroup } from "../types";

type SettingsTab = "servers" | "professions" | "security";

const settingsTabs: { id: SettingsTab; label: string }[] = [
  { id: "servers", label: "分组配置" },
  { id: "professions", label: "职业配置" },
  { id: "security", label: "重置主密码" },
];

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
  isServerReorderEnabled: boolean;
  onReorderServer: (draggedId: string, targetId: string, placement: "before" | "after") => void;
  onCurrentMasterPasswordInput: (value: string) => void;
  onNextMasterPasswordInput: (value: string) => void;
  onConfirmNextMasterPasswordInput: (value: string) => void;
  onResetMasterPassword: (event: Event) => void;
  onClose: () => void;
};

export function SettingsPanel(props: SettingsPanelProps) {
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("servers");
  const [serverNameDrafts, setServerNameDrafts] = createSignal<Record<string, string>>({});
  const [draggedId, setDraggedId] = createSignal<string | null>(null);
  const [dropTarget, setDropTarget] = createSignal<{
    serverId: string;
    placement: "before" | "after";
  } | null>(null);
  const [isDragArmed, setIsDragArmed] = createSignal(false);
  const serverNameDraft = (server: ServerGroup) => serverNameDrafts()[server.id] ?? server.name;
  const canReorderServers = () => props.isServerReorderEnabled && props.servers.length > 1;

  createEffect(() => {
    setServerNameDrafts(Object.fromEntries(props.servers.map((server) => [server.id, server.name])));
  });

  function getDropPlacement(event: DragEvent): "before" | "after" {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
  }

  function handleDragStart(event: DragEvent, server: ServerGroup) {
    if (!canReorderServers() || !isDragArmed()) {
      event.preventDefault();
      return;
    }

    setDraggedId(server.id);
    event.dataTransfer?.setData("text/plain", server.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(event: DragEvent, server: ServerGroup) {
    const currentDraggedId = draggedId();
    if (!canReorderServers() || !currentDraggedId || currentDraggedId === server.id) {
      return;
    }

    event.preventDefault();
    const placement = getDropPlacement(event);
    setDropTarget({ serverId: server.id, placement });
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleDrop(event: DragEvent, server: ServerGroup) {
    event.preventDefault();
    const currentDraggedId = draggedId();
    const placement = getDropPlacement(event);
    setDraggedId(null);
    setDropTarget(null);
    setIsDragArmed(false);

    if (!canReorderServers() || !currentDraggedId || currentDraggedId === server.id) {
      return;
    }

    props.onReorderServer(currentDraggedId, server.id, placement);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropTarget(null);
    setIsDragArmed(false);
  }

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

        <div class="settings-tabs-layout">
          <nav class="settings-tabs-nav" aria-label="配置分类">
            <For each={settingsTabs}>
              {(tab) => (
                <button
                  class="settings-tab"
                  classList={{ "is-active": activeTab() === tab.id }}
                  type="button"
                  aria-selected={activeTab() === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </nav>

          <div class="settings-tab-panel">
            <Switch>
              <Match when={activeTab() === "servers"}>
                <p class="settings-tab-desc">编辑分组名称，拖拽左侧手柄调整顺序</p>
                <div class="settings-list">
                  <For each={props.servers} fallback={<span class="muted">暂无分组</span>}>
                    {(server) => (
                      <form
                        classList={{
                          "settings-list-row": true,
                          "is-dragging": draggedId() === server.id,
                          "drop-before":
                            dropTarget()?.serverId === server.id && dropTarget()?.placement === "before",
                          "drop-after":
                            dropTarget()?.serverId === server.id && dropTarget()?.placement === "after",
                        }}
                        draggable={canReorderServers()}
                        onDragStart={(event) => handleDragStart(event, server)}
                        onDragOver={(event) => handleDragOver(event, server)}
                        onDragLeave={() => {
                          if (dropTarget()?.serverId === server.id) {
                            setDropTarget(null);
                          }
                        }}
                        onDrop={(event) => handleDrop(event, server)}
                        onDragEnd={handleDragEnd}
                        onSubmit={(event) => {
                          event.preventDefault();
                          props.onRenameServer(server.id, serverNameDraft(server));
                        }}
                      >
                        <span
                          class="drag-handle"
                          classList={{ "is-disabled": !canReorderServers() }}
                          title={canReorderServers() ? "拖拽调整顺序" : "至少两个分组才可排序"}
                          aria-label="拖拽调整分组顺序"
                          role="button"
                          tabIndex={canReorderServers() ? 0 : -1}
                          onPointerDown={(event) => {
                            if (canReorderServers()) {
                              setIsDragArmed(true);
                              event.currentTarget.setPointerCapture(event.pointerId);
                            }
                          }}
                          onPointerUp={() => setIsDragArmed(false)}
                          onPointerCancel={() => setIsDragArmed(false)}
                          onLostPointerCapture={() => setIsDragArmed(false)}
                        >
                          <GripVertical size={14} />
                        </span>
                        <input
                          value={serverNameDraft(server)}
                          onInput={(event) =>
                            setServerNameDrafts({
                              ...serverNameDrafts(),
                              [server.id]: event.currentTarget.value,
                            })
                          }
                          placeholder="分组名称"
                        />
                        <button class="ghost-button compact" type="submit">
                          <Save size={12} />
                          保存
                        </button>
                      </form>
                    )}
                  </For>
                </div>
              </Match>

              <Match when={activeTab() === "professions"}>
                <p class="settings-tab-desc">用于账号表单中的职业选项</p>
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
              </Match>

              <Match when={activeTab() === "security"}>
                <p class="settings-tab-desc">使用新密码重新加密当前保险库</p>
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
              </Match>
            </Switch>
          </div>
        </div>
      </section>
    </div>
  );
}
