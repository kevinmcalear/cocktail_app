import type { MenuDetail } from '@/types/menus';

import { MenuDeskHead } from '../desk/MenuDesk';
import { MenuPageHead } from './MenuPageHead';
import type { MenuPageModel } from './menuPageModel';
import type { MenuBarTools } from './MenuTopBar';

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
  /** A home menu's … (its Edit is in the sheet). */
  onMore?: () => void;
  /** The phone's bar is pinned over the page's scroll (MenuScreen), so the head draws none. */
  pinned?: boolean;
}

/** The top of the menu page: the phone's (Menu-page) or the desktop's (Menu-desk), with the actions each draws. */
export function MenuScreenHead({ menu, model, desk, cover, home, team, draft, past, gutter, top, onBack, onShare, onEdit, onMore, pinned }: Props) {
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
        onMore={home ? onMore : undefined}
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
      {...menuBarTools({ home, team, draft, past, onShare, onEdit, onMore })}
      pinned={pinned}
      bleed={gutter}
      top={top}
    />
  );
}

/** The bar's one …: Edit (the menu team, on a draft or a menu that's on or coming up) and Share; a home menu's is its own sheet, with Edit in it (Kevin, 3 Nov). */
export function menuBarTools({ home, team, draft, past, onShare, onEdit, onMore }: Pick<Props, 'home' | 'team' | 'draft' | 'past' | 'onShare' | 'onEdit'> & { onMore?: () => void }): MenuBarTools {
  return {
    onShare: home ? null : onShare,
    onEdit: !home && team && (draft || !past) ? onEdit : null,
    onMore: home ? onMore : null,
  };
}
