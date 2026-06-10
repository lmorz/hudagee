import { Download, FileUp, Lock, Plus, Settings, Trash2 } from "lucide-solid";
import type { ServerGroup } from "../types";
import { ServerSelect } from "./ServerSelect";

type TopBarProps = {
  servers: ServerGroup[];
  selectedServerId: string;
  serverName: string;
  showSettings: boolean;
  onServerChange: (serverId: string) => void;
  onServerNameInput: (value: string) => void;
  onAddServer: (event: Event) => void;
  onDeleteServer: () => void;
  onToggleSettings: () => void;
  onImport: () => void;
  onExport: () => void;
  onLock: () => void;
};

export function TopBar(props: TopBarProps) {
  return (
    <header class="topbar">
      <div class="server-picker">
        <ServerSelect
          servers={props.servers}
          value={props.selectedServerId}
          title="选择分组"
          onChange={props.onServerChange}
        />
        <button class="icon-button compact" type="button" onClick={props.onDeleteServer} title="删除当前分组">
          <Trash2 size={13} />
        </button>
      </div>

      <form class="server-form" onSubmit={props.onAddServer}>
        <input
          value={props.serverName}
          onInput={(event) => props.onServerNameInput(event.currentTarget.value)}
          placeholder="新分组"
        />
        <button class="icon-button compact" type="submit" title="新增分组">
          <Plus size={13} />
        </button>
      </form>

      <div class="toolbar">
        <button
          class={props.showSettings ? "ghost-button compact active-toggle" : "ghost-button compact"}
          type="button"
          onClick={props.onToggleSettings}
        >
          <Settings size={13} />
          配置
        </button>
        <button class="ghost-button compact" type="button" onClick={props.onImport}>
          <FileUp size={13} />导入
        </button>
        <button class="ghost-button compact" type="button" onClick={props.onExport}>
          <Download size={13} />导出
        </button>
        <button class="ghost-button compact icon-only" type="button" onClick={props.onLock} title="锁定">
          <Lock size={13} />
        </button>
      </div>
    </header>
  );
}
