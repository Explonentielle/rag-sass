'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Sous-menu de la barre latérale (docs/roadmap.md item 66) : une page déclare
// ses sections avec <PageSections />, la barre latérale (components/Sidebar.tsx)
// les affiche sous l'entrée de menu active. Les sections sont définies dans la
// page, pas dans la barre : c'est la page qui sait lesquelles existent (un
// assistant interne n'a pas les réglages du widget public, par exemple).

export interface PageSection {
  /** Identifiant de l'élément de la page (attribut `id`) vers lequel défiler. */
  id: string;
  label: string;
}

interface SectionsContextValue {
  sections: PageSection[];
  setSections: (sections: PageSection[]) => void;
}

const SectionsContext = createContext<SectionsContextValue>({ sections: [], setSections: () => {} });

export function SectionsProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] = useState<PageSection[]>([]);
  const value = useMemo(() => ({ sections, setSections }), [sections]);
  return <SectionsContext.Provider value={value}>{children}</SectionsContext.Provider>;
}

export function usePageSections(): PageSection[] {
  return useContext(SectionsContext).sections;
}

/** À rendre en tête d'une page : enregistre ses sections tant que la page est affichée. */
export default function PageSections({ sections }: { sections: PageSection[] }) {
  const { setSections } = useContext(SectionsContext);
  // La liste est recréée à chaque rendu serveur : seule sa valeur compte.
  const signature = sections.map((s) => `${s.id}:${s.label}`).join('|');

  useEffect(() => {
    setSections(sections);
    return () => setSections([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, setSections]);

  return null;
}
