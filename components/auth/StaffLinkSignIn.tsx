import { EmailLinkGate } from '@/components/auth/EmailLinkGate';
import { SignInScreen } from '@/components/auth/SignInScreen';
import type { AuthBrand } from '@/components/auth/AuthShell';

/**
 * Signed out on a venue's staff link: the venue's sign-in, or, when an invite's
 * sign-in link (send-bar-invite) brought them here, a tap to use it. Once
 * signed in, the staff link shows the invite.
 */
export function StaffLinkSignIn({ slug, brand }: { slug: string; brand: AuthBrand }) {
  return (
    <EmailLinkGate
      cleanPath={`/v/${slug}`}
      ready={false}
      retryHref="/auth/login"
      retryLabel="Sign in"
      waitingTitle={`Join ${brand.name}`}
      waitingSubtitle="Tap continue to sign in and see your invite."
      noLink={<SignInScreen brand={brand} subtitle={`Drinks, menus and training for the ${brand.name} team.`} />}
    >
      {null}
    </EmailLinkGate>
  );
}
