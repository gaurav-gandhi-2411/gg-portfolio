"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { site } from "@/content/site";
import { products } from "@/content/products";

interface PaletteItem {
  label: string;
  hint: string;
  action: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const items: PaletteItem[] = useMemo(() => {
    const sections = ["About", "Products", "Research", "Experience", "Contact"].map(
      (name) => ({
        label: name,
        hint: "Section",
        action: () => {
          document
            .getElementById(name.toLowerCase())
            ?.scrollIntoView({ behavior: "smooth" });
        },
      })
    );

    const productItems = products
      .filter((p) => p.liveUrl)
      .map((p) => ({
        label: p.name,
        hint: "Product — open live demo",
        action: () => window.open(p.liveUrl, "_blank", "noopener,noreferrer"),
      }));

    const actions: PaletteItem[] = [
      { label: "Download resume", hint: "Action", action: () => window.open(site.resumeUrl, "_blank") },
      { label: "Email", hint: "Action", action: () => window.open(`mailto:${site.email}`) },
      { label: "GitHub", hint: "Action", action: () => window.open(site.githubUrl, "_blank", "noopener,noreferrer") },
      { label: "LinkedIn", hint: "Action", action: () => window.open(site.linkedinUrl, "_blank", "noopener,noreferrer") },
    ];

    return [...sections, ...productItems, ...actions];
  }, []);

  const filtered = useMemo(
    () => items.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
    [items, query]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selected];
      if (item) {
        item.action();
        onOpenChange(false);
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
      className="fixed inset-auto top-24 left-1/2 w-full max-w-lg -translate-x-1/2 rounded-lg border border-border bg-card p-0 text-card-foreground backdrop:bg-black/60"
      aria-label="Command palette"
    >
      <div className="flex flex-col">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a section, product, or action…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          aria-label="Search"
        />
        <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted-foreground">No matches</li>
          )}
          {filtered.map((item, i) => (
            <li key={item.label}>
              <button
                type="button"
                role="option"
                aria-selected={i === selected}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  item.action();
                  onOpenChange(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                  i === selected
                    ? "bg-accent/15 text-foreground"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <span>{item.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
