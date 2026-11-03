import { AddDrinkSheet } from '../AddDrinkSheet';
import { GoLiveSheet } from '../GoLiveSheet';
import { HomeNightSheet } from '../HomeNight';
import { PasteMenuSheet } from '../PasteMenuSheet';
import { SectionSheet } from '../SectionSheet';
import { ShareMenuSheet } from '../ShareMenuSheet';
import type { LayoutEditor } from '../useLayoutEditor';
import { EndsSheet, RowMenuSheet } from './EditSheetsMore';

/** The editor's sheets: a row's menu, add a drink, a section's name and rules, paste a list, the dates (go live, Ends), a home menu's night and Share. */
export function EditSheets({ editor }: { editor: LayoutEditor }) {
  const { sheet } = editor;
  const section = sheet && 'key' in sheet ? editor.section(sheet.key) : null;
  const index = section ? editor.layout.sections.indexOf(section) : -1;
  const close = () => editor.setSheet(null);
  switch (sheet?.kind) {
    case 'paste':
      return (
        <PasteMenuSheet
          into={section}
          library={editor.library}
          already={(section ?? editor.layout.sections[editor.layout.sections.length - 1])?.drinks.map((drink) => drink.id)}
          onClose={close}
          onApply={(groups) => editor.applyPaste(sheet.key, groups)}
        />
      );
    case 'add':
      return (
        <AddDrinkSheet
          section={section}
          barId={editor.menu.barId}
          onClose={close}
          library={editor.library}
          canMake={editor.canMake}
          elsewhere={editor.elsewhere}
          onAdd={(d) => editor.add(sheet.key, d)}
        />
      );
    case 'section':
      return section ? (
        <SectionSheet
          section={section}
          isFirst={index === 0}
          isLast={index === editor.layout.sections.length - 1}
          onClose={close}
          onSave={(rule) => editor.updateSection(section.key, rule)}
          onMove={(by) => editor.moveSection(section.key, by)}
          onPaste={() => editor.setSheet({ kind: 'paste', key: section.key })}
          onRemove={() => editor.removeSection(section.key)}
        />
      ) : null;
    case 'row': {
      const drink = section?.drinks.find((d) => d.id === sheet.drinkId);
      return drink ? <RowMenuSheet editor={editor} sectionKey={sheet.key} drink={drink} onClose={close} /> : null;
    }
    case 'ends':
      return <EndsSheet editor={editor} onClose={close} />;
    case 'share':
      return (
        <ShareMenuSheet
          menu={{ ...editor.menu, name: editor.layout.name, coverUrl: editor.layout.coverUrl, coverPosition: editor.layout.coverPosition, sections: editor.layout.sections.map((s) => ({ ...s, id: s.id ?? s.key })) }}
          onClose={close}
        />
      );
    case 'night':
      return <HomeNightSheet menu={editor.menu} onClose={close} />;
    case 'golive':
      return (
        <GoLiveSheet
          visible
          onClose={close}
          menu={{
            id: editor.menu.id,
            name: editor.layout.name,
            barId: editor.menu.barId,
            plannedStartsAt: editor.menu.plannedStartsAt,
            plannedEndsAt: editor.menu.plannedEndsAt,
            endsAt: editor.menu.endsAt,
            coverUrl: editor.layout.coverUrl,
            coverPosition: editor.layout.coverPosition,
            sections: editor.layout.sections.map((s) => ({ ...s, id: s.id ?? s.key })),
          }}
          others={editor.others}
          onDone={editor.done}
        />
      );
    default:
      return null;
  }
}
