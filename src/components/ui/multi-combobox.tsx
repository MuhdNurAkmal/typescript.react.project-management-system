"use client"

import { Combobox } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"
import { cn } from "cn"

export interface ComboItem {
  value: string
  label: string
}

/**
 * Dropdown with search where several items can be picked. The picks show as removable chips inside the field.
 * Keyboard: type to filter, Up/Down to move, Enter to pick, Backspace to remove the last chip.
 */
export function MultiCombobox({
  id,
  items,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "Nothing found.",
}: {
  id: string
  items: ComboItem[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  emptyText?: string
}) {
  const selected = value.map((v) => items.find((i) => i.value === v)).filter((i): i is ComboItem => !!i)

  return (
    <Combobox.Root
      items={items}
      multiple
      value={selected}
      onValueChange={(next: ComboItem[]) => onChange(next.map((i) => i.value))}
      isItemEqualToValue={(a: ComboItem, b: ComboItem) => a.value === b.value}
    >
      <Combobox.InputGroup
        className={cn(
          "flex min-h-10 w-full cursor-text items-center gap-1 rounded-lg border border-input bg-transparent py-1 pr-1 pl-2 text-sm",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        )}
      >
        <Combobox.Chips className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selected.map((item) => (
            <Combobox.Chip
              key={item.value}
              className="flex items-center gap-1 rounded-md bg-primary-soft py-0.5 pr-0.5 pl-2 text-xs font-medium text-accent-foreground outline-none data-highlighted:ring-2 data-highlighted:ring-ring"
              aria-label={item.label}
            >
              <span className="max-w-40 truncate">{item.label}</span>
              <Combobox.ChipRemove
                className="grid size-5 place-items-center rounded text-accent-foreground/70 hover:bg-primary/10 hover:text-accent-foreground"
                aria-label={`Remove ${item.label}`}
              >
                <XIcon className="size-3.5" />
              </Combobox.ChipRemove>
            </Combobox.Chip>
          ))}
          <Combobox.Input
            id={id}
            placeholder={selected.length === 0 ? placeholder : ""}
            className="h-7 min-w-16 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
          />
        </Combobox.Chips>
        <Combobox.Trigger
          aria-label="Show the list"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDownIcon className="size-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="z-[60] outline-none" sideOffset={4}>
          <Combobox.Popup className="max-h-[min(var(--available-height),16rem)] w-(--anchor-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1 text-popover-foreground shadow-lift data-ending-style:opacity-0 data-starting-style:opacity-0 transition-opacity">
            <Combobox.Empty className="px-2 py-2 text-sm text-muted-foreground empty:hidden">{emptyText}</Combobox.Empty>
            <Combobox.List>
              {(item: ComboItem) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md px-2 py-2 text-sm outline-none select-none data-highlighted:bg-muted"
                >
                  <Combobox.ItemIndicator className="col-start-1">
                    <CheckIcon className="size-4 text-primary" />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2 truncate">{item.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
