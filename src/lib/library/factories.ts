import { newDegree, newId } from "@/lib/resume/factories";
import type { LibraryItemData, LibraryKind } from "./schema";

/** Blank fields for a new library item of `kind`. */
export function emptyLibraryItem(kind: LibraryKind): LibraryItemData {
  switch (kind) {
    case "experience":
    case "project":
      return { kind, fields: { title: "", org: "", location: "", dates: { start: null, end: null } } };
    case "publication":
      return { kind, fields: { title: "", authors: "", venue: "", date: null } };
    case "education":
      return { kind, fields: { school: "", location: "", degrees: [newDegree()] } };
    case "skills":
      return { kind, fields: { category: "", items: [] } };
    case "summary":
      return { kind, fields: { text: "" } };
  }
}

/** A variant typed in the editor. */
export const newVariant = (text = "", label: string | null = null) => ({
  id: newId(),
  text,
  label,
});

export const newLibraryBullet = (text = "") => ({ id: newId(), tags: [] as string[], variants: [newVariant(text)] });
