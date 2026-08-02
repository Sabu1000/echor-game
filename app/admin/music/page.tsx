import type { Metadata } from "next";
import AdminMusicLibrary from "@/components/AdminMusicLibrary";

export const metadata: Metadata = { title: "Music Library — ECHOR Admin" };

export default function MusicLibraryPage() {
  return <AdminMusicLibrary />;
}

