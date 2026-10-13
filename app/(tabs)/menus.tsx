import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { MenusScreen } from '@/components/screens/menus/MenusScreen';
import { WebHead } from '@/components/WebHead';

/** The Menus tab, in venue mode: every menu at the venue. /menus/all is the same list opened over another page. */
export default function MenusTab() {
  return (
    <MountOnFocus>
      <WebHead>
        <title>Menus</title>
      </WebHead>
      <MenusScreen tab />
    </MountOnFocus>
  );
}
