import { Download, FileUp, Lock, Plus, Search, Settings, Trash2 } from "lucide-solid";
import { For, Show } from "solid-js";
import type { ServerGroup } from "../types";

type TopBarProps = {
  servers: ServerGroup[];
  selectedServerId: string;
  query: string;
  serverName: string;
  showSettings: boolean;
  onServerChange: (serverId: string) => void;
  onServerNameInput: (value: string) => void;
  onAddServer: (event: Event) => void;
  onDeleteServer: () => void;
  onQueryInput: (value: string) => void;
  onAddAccount: () => void;
  onToggleSettings: () => void;
  onImport: () => void;
  onExport: () => void;
  onLock: () => void;
};

export function TopBar(props: TopBarProps) {
  return (
    <header class="topbar">
      <div class="server-picker">
        <select
          value={props.selectedServerId}
          onChange={(event) => props.onServerChange(event.currentTarget.value)}
          title="选择区服"
        >
          <option value="" disabled>
            选择区服
          </option>
          <For each={props.servers}>
            {(server) => <option value={server.id}>{server.name}</option>}
          </For>
        </select>
        <button class="icon-button compact" type="button" onClick={props.onDeleteServer} title="删除当前区服">
          <Trash2 size={13} />
        </button>
      </div>

      <form class="server-form" onSubmit={props.onAddServer}>
        <input
          value={props.serverName}
          onInput={(event) => props.onServerNameInput(event.currentTarget.value)}
          placeholder="新区服"
        />
        <button class="icon-button compact" type="submit" title="新增区服">
          <Plus size={13} />
        </button>
      </form>

      <div class="search-box">
        <Search size={13} />
        <input
          value={props.query}
          onInput={(event) => props.onQueryInput(event.currentTarget.value)}
          placeholder="搜索"
        />
      </div>

      <div class="toolbar">
        <button class="primary-button compact" type="button" onClick={props.onAddAccount}>
          <Plus size={13} />
          账号
        </button>
        <button
          class={props.showSettings ? "ghost-button compact active-toggle" : "ghost-button compact"}
          type="button"
          onClick={props.onToggleSettings}
        >
          <Settings size={13} />
          配置
        </button>
        <button class="ghost-button compact icon-only" type="button" onClick={props.onImport} title="导入">
          <FileUp size={13} />
        </button>
        <button class="ghost-button compact icon-only" type="button" onClick={props.onExport} title="导出">
          <Download size={13} />
        </button>
        <button class="ghost-button compact icon-only" type="button" onClick={props.onLock} title="锁定">
          <Lock size={13} />
        </button>
      </div>

      <Show when={!props.servers.length}>
        <span class="top-hint">先添加区服</span>
      </Show>
    </header>
  );
}
