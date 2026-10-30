import { Bullets, LegalPage, LegalSection, P, SupportEmail } from '@/components/legal/LegalPage';
import { BRAND } from '@/constants/brand';

/** Public page Google Play links to: how to delete an account without the app. */
export default function DeleteAccountInfo() {
  return (
    <LegalPage title="Delete your account">
      <LegalSection heading="In the app or on the web">
        <P>
          Sign in to {BRAND.productName}, open Settings → Account → Delete account, and confirm. Your account is deleted
          immediately.
        </P>
      </LegalSection>

      <LegalSection heading="By email">
        <P>
          Email <SupportEmail /> from the address you signed up with, with the subject &quot;Delete my account&quot;. We
          will delete it within 30 days and confirm by email.
        </P>
      </LegalSection>

      <LegalSection heading="What is deleted">
        <P>Everything that is yours. It is deleted, not hidden.</P>
        <Bullets
          items={[
            'Your sign-in, email address, name and profile photo.',
            'Your profile, rankings, drafts, saved drinks, personal menus and team memberships.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="What stays">
        <P>
          Drinks, ingredients and menus you created for a bar belong to that bar, so they stay there, without your name. A
          bar where you are the only one on the team goes back to an unclaimed public page, which whoever runs it can claim
          again. If you are the only admin of a bar with other people on its team, make someone else an admin first.
          Copies can remain in our providers&apos; backups for a limited time before they are overwritten.
        </P>
      </LegalSection>

      <LegalSection heading="Coming back">
        <P>You are welcome back any time. Sign up again with the same email address and you start fresh.</P>
      </LegalSection>
    </LegalPage>
  );
}
