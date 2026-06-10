import { createEffect, For } from "solid-js";
import type { ServerGroup } from "../types";

type ServerSelectProps = {
  servers: ServerGroup[];
  value: string;
  onChange: (serverId: string) => void;
  disabled?: boolean;
  title?: string;
};

export function ServerSelect(props: ServerSelectProps) {
  let selectRef: HTMLSelectElement | undefined;

  createEffect(() => {
    const select = selectRef;
    const selectedId = props.value;
    props.servers;

    if (!select || !selectedId) {
      return;
    }

    if (select.value !== selectedId) {
      select.value = selectedId;
    }
  });

  return (
    <select
      ref={selectRef}
      value={props.value}
      disabled={props.disabled}
      title={props.title}
      onChange={(event) => props.onChange(event.currentTarget.value)}
    >
      <option value="" disabled>
        选择分组
      </option>
      <For each={props.servers}>
        {(server) => <option value={server.id}>{server.name}</option>}
      </For>
    </select>
  );
}
