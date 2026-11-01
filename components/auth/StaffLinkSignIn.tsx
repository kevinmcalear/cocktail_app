import { useState } from 'react';

import { EmailLinkGate } from '@/components/auth/EmailLinkGate';
import { SignInScreen } from '@/components/auth/SignInScreen';
import { StaffJoinDoor } from '@/components/auth/StaffJoinDoor';
import type { AuthBrand } from '@/components/auth/AuthShell';

/**
 * Signed out on a venue's staff link: the door (Join <bar>), then the
 * venue's email code; or, when an invite's sign-in link (send-bar-invite)
 * brought them here, a tap to use it. Once signed in, the staff link shows
 * the invite.
 */
export function StaffLinkSignIn({ slug, brand }: { slug: string; brand: AuthBrand }) {
  // null: the door; else which button they took.
  const [way, setWay] = useState<'new' | 'returning' | null>(null);
  return (
    <EmailLinkGate
      cleanPath={`/v/${slug}`}
      ready={false}
      retryHref="/auth/login"
      retryLabel="Sign in"
      waitingTitle={`Join ${brand.name}`}
      waitingSubtitle="Tap continue to sign in and see your invite."
      noLink={
        way ? (
          <SignInScreen
            brand={brand}
            subtitle={way === 'new' ? `Your email, then the code we send. That’s you on ${brand.name}: tonight’s menu, specs and prep.` : `The email you already sign in with. We’ll send a code.`}
            onBack={() => setWay(null)}
          />
        ) : (
          <StaffJoinDoor brand={brand} onContinue={(returning) => setWay(returning ? 'returning' : 'new')} />
        )
      }
    >
      {null}
    </EmailLinkGate>
  );
}
