import type { MenuDetail } from '@/types/menus';

import { MenuDeskHead } from '../desk/MenuDesk';
import { MenuPageHead } from './MenuPageHead';
import type { MenuPageModel } from './menuPageModel';

interface Props {
  menu: MenuDetail;
  model: Pick<MenuPageModel, 'ink' | 'quiet' | 'tag' | 'eyebrow'>;
  /** The wide web, beside a drink (Menu-desk). */
  desk: boolean;
  cover: string | null;
  /** A home menu: Share is its one action. */
  home: boolean;
  team: boolean;
  draft: boolean;
  past: boolean;
  gutter: number;
  top: number;
  onBack: () => void;
  onShare: () => void;
  onEdit: () => void;
}

/** The top of the menu page: the phone's (Menu-page) or the desktop's (Menu-desk), with the actions each draws. */
export function MenuScreenHead({ menu, model, desk, cover, home, team, draft, past, gutter, top, onBack, onShare, onEdit }: Props) {
  const heroIds = menu.sections.flatMap((s) => s.drinks).slice(0, 3).map((d) => d.id);
  if (desk) {
    // The top right: Share, and Edit for the menu team; a home menu's one action is Share.
    const pills = home ? [{ label: 'Share', onPress: onShare, ink: true }] : [{ label: 'Share', onPress: onShare }, ...(team && !past ? [{ label: 'Edit', onPress: onEdit, ink: true }] : [])];
    return (
      <MenuDeskHead
        crumb={menu.barId ? { label: 'Menus', href: '/menus/all' } : { label: 'Drinks', href: '/drinks' }}
        heroIds={heroIds}
        ink={model.ink}
        quiet={model.quiet}
        tag={model.tag}
        eyebrow={model.eyebrow}
        name={menu.name}
        description={menu.description}
        pills={pills}
        bleed={gutter}
      />
    );
  }
  return (
    <MenuPageHead
      heroIds={heroIds}
      coverUrl={cover}
      coverCredit={cover ? menu.coverCredit : null}
      name={menu.name}
      ink={model.ink}
      quiet={model.quiet}
      tag={model.tag}
      eyebrow={model.eyebrow}
      description={menu.description}
      onBack={onBack}
      onShare={home ? null : onShare}
      // Edit is the one action for the menu team; a draft's is Publish and a home menu's Share, so theirs is a glass pencil.
      onEdit={(team && draft) || home ? onEdit : null}
      pill={home ? { label: 'Share', onPress: onShare } : team && !draft && !past ? { label: 'Edit', onPress: onEdit } : null}
      bleed={gutter}
      top={top}
    />
  );
}
