import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space, type, type TypeStyle } from '@/constants/tokens';

import { Button } from '../Button';
import { DrinkImage } from '../DrinkImage';
import { GlassButton } from '../Glass';
import { LockedSection } from '../LockedSection';
import { Segmented } from '../Segmented';
import { SpecRow } from '../SpecRow';
import { Surface } from '../Surface';
import { Tag } from '../Tag';
import { Body, Caption, DsText, Headline, Title } from '../Text';
import { useDs } from '../theme';
import { IMAGES, PENICILLIN } from './samples';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.section, { borderTopColor: ds.c.line }]}>
      <Caption tone="muted" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </Caption>
      {children}
    </View>
  );
}

function Swatch({ name, color }: { name: string; color: string }) {
  const ds = useDs();
  return (
    <View style={styles.swatch}>
      <View style={[styles.chip, { backgroundColor: color, borderColor: ds.c.lineStrong }]} />
      <Caption>{name}</Caption>
      <Caption tone="muted">{color.startsWith('#') ? color : 'alpha'}</Caption>
    </View>
  );
}

const TYPE_SAMPLES: Record<TypeStyle, string> = {
  display: 'Penicillin',
  title: 'Autumn menu',
  headline: 'Bartender notes',
  body: 'Shake hard with ice and strain over a large cube.',
  spec: '22.5 ml',
  caption: 'Shaken · Rocks · Large cube',
};

export function GallerySections() {
  const ds = useDs();
  const [tab, setTab] = useState<'spec' | 'service' | 'family'>('spec');
  return (
    <View>
      <Section title="Colour">
        <View style={styles.wrap}>
          {(['ground', 'surface', 'raised', 'ink', 'muted', 'line', 'paper'] as const).map((k) => (
            <Swatch key={k} name={k} color={ds.c[k]} />
          ))}
          <Swatch name="accent text" color={ds.accentText} />
          <Swatch name="accent fill" color={ds.accentFill.fill} />
        </View>
      </Section>

      <Section title="Type">
        {(Object.keys(TYPE_SAMPLES) as TypeStyle[]).map((v) => (
          <View key={v} style={styles.typeRow}>
            <DsText variant={v} tone={v === 'spec' ? 'accent' : 'ink'} italic={v === 'title'} numberOfLines={1}>
              {TYPE_SAMPLES[v]}
            </DsText>
            <Caption tone="muted">
              {v} · {type[v].fontSize}
            </Caption>
          </View>
        ))}
      </Section>

      <Section title="Buttons">
        <View style={styles.wrap}>
          <Button label="Add to prep list" />
          <Button label="Recipe" variant="secondary" />
          <Button label="Skip" variant="ghost" />
          <Button label="Take photo" icon="camera.fill" size="lg" />
          <Button label="Publish" disabled />
        </View>
      </Section>

      <Section title="Tags and tabs">
        <View style={styles.wrap}>
          <Tag label="Stirred" />
          <Tag label="House-made" tone="accent" />
          <Tag label="Sketch" tone="sketch" />
          <Tag label="Ready" tone="success" />
          <Tag label="Needs photo" tone="warning" />
        </View>
        <Segmented
          accessibilityLabel="Drink sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'spec', label: 'Spec' },
            { value: 'service', label: 'Service' },
            { value: 'family', label: 'Family' },
          ]}
        />
      </Section>

      <Section title="Spec">
        <Title italic>Penicillin</Title>
        {PENICILLIN.map((row) => (
          <SpecRow key={row.ingredient} {...row} />
        ))}
      </Section>

      <Section title="Images">
        <View style={styles.images}>
          <View style={styles.image}>
            <DrinkImage source={IMAGES.photo} accessibilityLabel="House Martini" />
            <Caption tone="muted">Photo</Caption>
          </View>
          <View style={styles.image}>
            <DrinkImage source={IMAGES.sketch} generated accessibilityLabel="Hazy IPA" />
            <Caption tone="muted">Generated</Caption>
          </View>
          <View style={styles.image}>
            <DrinkImage glass="Rocks" accessibilityLabel="Night Garden Sour" />
            <Caption tone="muted">No image yet</Caption>
          </View>
        </View>
      </Section>

      <Section title="Glass over content">
        <View>
          <DrinkImage source={IMAGES.photo} accessibilityLabel="House Martini" aspectRatio={4 / 3} />
          <View style={styles.overlay}>
            <GlassButton accessibilityLabel="Back" icon="chevron.left" />
            <View style={styles.overlayRight}>
              <GlassButton accessibilityLabel="Favourite" icon="heart" />
              <GlassButton accessibilityLabel="Service mode" label="Service mode" />
            </View>
          </View>
        </View>
      </Section>

      <Section title="Locked sections">
        <LockedSection title="Spec" unlocked opensAt="Bartender">
          <Body tone="muted">Visible to bartenders and up.</Body>
        </LockedSection>
        <LockedSection title="Honey-ginger syrup" unlocked={false} opensAt="Maker">
          <Body>Never rendered while locked.</Body>
        </LockedSection>
      </Section>

      <Section title="Surface">
        <Surface>
          <Headline>Takeover Friday</Headline>
          <Body tone="muted">Pale Moth × Little Rye. Prep starts today.</Body>
        </Surface>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: space.xl, gap: space.md },
  sectionTitle: { letterSpacing: 1.2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  swatch: { width: 96, gap: 2 },
  chip: { height: 44, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, marginBottom: space.xs },
  typeRow: { gap: 2 },
  images: { flexDirection: 'row', gap: space.md },
  image: { flex: 1, gap: space.xs },
  overlay: { position: 'absolute', top: space.md, left: space.md, right: space.md, flexDirection: 'row', justifyContent: 'space-between' },
  overlayRight: { flexDirection: 'row', gap: space.sm },
});
