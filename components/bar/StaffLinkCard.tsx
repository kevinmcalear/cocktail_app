import * as Burnt from 'burnt';
import { Platform, Share } from 'react-native';
import { Button, Card, Text, XStack, YStack, useTheme } from 'tamagui';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { showMessage } from '@/lib/dialogs';
import { venueStaffUrl } from '@/lib/venueLink';

/**
 * The venue's staff link. Staff open it on their phone, sign in, and add the
 * venue's own app (its name and logo) to their home screen.
 */
export function StaffLinkCard({ slug, venueName }: { slug: string; venueName: string }) {
  const theme = useTheme();
  const url = venueStaffUrl(slug);

  const share = async () => {
    try {
      if (Platform.OS !== 'web') {
        await Share.share({ message: url, url, title: `${venueName} staff app` });
        return;
      }
      await navigator.clipboard.writeText(url);
      Burnt.toast({ title: 'Link copied', preset: 'done', duration: 2 });
    } catch {
      // The browser can refuse clipboard access; show the link to copy by hand.
      showMessage("Couldn't copy the link", url);
    }
  };

  return (
    <Card borderWidth={1} borderColor="$borderColor" padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
      <YStack gap="$3">
        <Text fontSize={14} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
          Staff link
        </Text>
        <Text fontSize={14} color="$color11" lineHeight={20}>
          Send this to your team. They sign in and add {venueName} to their home screen, with your name and logo.
        </Text>
        <XStack
          alignItems="center"
          gap="$2"
          padding="$3"
          borderRadius={8}
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$borderColor"
        >
          <IconSymbol name="link" size={16} color={theme.color11?.get() as string} />
          <Text flex={1} fontSize={14} color="$color" numberOfLines={1} selectable>
            {url}
          </Text>
        </XStack>
        <Button backgroundColor="$color8" onPress={() => void share()} borderRadius={8} height={44}>
          <XStack alignItems="center" gap="$2">
            <IconSymbol
              name={Platform.OS === 'web' ? 'doc.on.doc' : 'square.and.arrow.up'}
              size={16}
              color={theme.backgroundStrong?.get() as string}
            />
            <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
              {Platform.OS === 'web' ? 'Copy link' : 'Share link'}
            </Text>
          </XStack>
        </Button>
      </YStack>
    </Card>
  );
}
