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
        <Bullets
          items={[
            'Your account, email address, name and profile photo.',
            'Your drafts, personal menus, favourites and venue memberships.',
            'Any venue where you are the only member, with everything in it.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="What stays">
        <P>
          Drinks, ingredients and menus you created in a shared venue stay with that venue, without your name. If you are
          the only admin of a venue with other members, make someone else an admin first. Copies can remain in our
          providers&apos; backups for a limited time before they are overwritten.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
