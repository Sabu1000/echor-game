"use client";

import { useEffect, useId, useRef, useState } from "react";
import { searchSongs } from "@/features/game/catalog";
import type { Song } from "@/features/game/types";
import { SearchIcon } from "./Icons";

interface SongComboboxProps {
  selected: Song | null;
  onSelect: (song: Song | null) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocusSignal?: number;
}

export function SongCombobox({ selected, onSelect, disabled, placeholder = "Search by song title or artist", autoFocusSignal = 0 }: SongComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (autoFocusSignal <= 0) return;
    requestAnimationFrame(() => {
      setQuery("");
      inputRef.current?.focus();
    });
  }, [autoFocusSignal]);

  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      const matches = searchSongs(query);
      setResults(matches);
      setActiveIndex(0);
      setOpen(true);
      setSearching(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, selected]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(song: Song) {
    onSelect(song);
    setQuery(`${song.title} — ${song.artist}`);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (event.key === "ArrowDown" && results.length) setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="combobox" ref={rootRef}>
      <label className="sr-only" htmlFor={`${listId}-input`}>Search the song catalog</label>
      <SearchIcon className="search-leading" />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined}
        autoComplete="off"
        maxLength={100}
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onFocus={() => results.length && setOpen(true)}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (selected) onSelect(null);
          if (value.trim().length < 2) {
            setResults([]);
            setSearching(false);
            setOpen(false);
          } else {
            setSearching(true);
          }
        }}
        onKeyDown={handleKeyDown}
      />
      {searching && <span className="search-spinner" aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{query.length >= 2 && !searching ? `${results.length} songs found` : ""}</span>
      {open && query.trim().length >= 2 && (
        <div className="search-dropdown">
          <div className="search-caption">SONGS &amp; ARTISTS</div>
          <ul id={listId} role="listbox">
            {results.length === 0 && !searching && <li className="search-empty">No songs found</li>}
            {results.map((song, index) => (
              <li
                id={`${listId}-${song.id}`}
                key={song.id}
                role="option"
                aria-selected={index === activeIndex}
                className={index === activeIndex ? "active" : ""}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(song)}
              >
                <span className="result-art" style={{ background: `linear-gradient(135deg, ${song.colors[0]}, ${song.colors[1]})` }} aria-hidden="true">♪</span>
                <span><strong>{song.title}</strong><small>{song.artist} · {song.year}</small></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
