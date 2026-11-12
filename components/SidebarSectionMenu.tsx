'use client';

import { useEffect, useState } from 'react';
import type { PageSection } from '@/components/PageSections';

// Une section devient « en cours » quand son haut passe sous cette distance du
// haut de la zone de contenu : ni trop tôt (elle vient d'apparaître en bas), ni
// trop tard (on la lit déjà).
const ACTIVE_OFFSET_PX = 120;

/**
 * Liste des sections de la page, en retrait sous l'entrée de menu active. Un
 * clic fait défiler jusqu'à la section ; la section en cours de lecture est
 * mise en valeur pendant le défilement. Le conteneur qui défile est le
 * <main> du tableau de bord (components/DashboardShell.tsx), pas la fenêtre.
 */
export default function SidebarSectionMenu({
  sections,
  onNavigate,
}: {
  sections: PageSection[];
  onNavigate: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);

  useEffect(() => {
    const scroller = document.querySelector('main');
    if (!scroller || sections.length === 0) return;

    let frame = 0;
    function update() {
      frame = 0;
      const scrollerTop = scroller!.getBoundingClientRect().top;
      let current = sections[0].id;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top - scrollerTop <= ACTIVE_OFFSET_PX) current = section.id;
      }
      // En bas de page, la dernière section peut ne jamais atteindre le seuil.
      const atBottom = scroller!.scrollTop + scroller!.clientHeight >= scroller!.scrollHeight - 4;
      if (atBottom && scroller!.scrollTop > 0) current = sections[sections.length - 1].id;
      setActiveId(current);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  function handleClick(e: React.MouseEvent, id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setActiveId(id);
    onNavigate();
  }

  return (
    <ul aria-label="Sections de la page" className="mb-2 ml-[22px] mt-1 space-y-0.5 border-l border-white/10 pl-3">
      {sections.map((section) => {
        const active = section.id === activeId;
        return (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={(e) => handleClick(e, section.id)}
              aria-current={active ? 'location' : undefined}
              className={`block truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                active
                  ? 'bg-white/10 font-medium text-white'
                  : 'text-brand-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {section.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
