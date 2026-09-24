import { Bullets, LegalPage, LegalSection, P, SupportEmail } from '@/components/legal/LegalPage';
import { BRAND } from '@/constants/brand';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy policy">
      <P>
        {BRAND.productName} helps bars manage drink recipes, menus and staff training. It is operated by {BRAND.operator}{' '}
        (&quot;we&quot;). This policy explains what we collect, why, who we share it with, and the choices you have.
      </P>

      <LegalSection heading="What we collect">
        <Bullets
          items={[
            'Account details: your email address, your password (stored only as a secure hash by our sign-in provider), your first and last name, and a profile photo if you add one.',
            'Content you create: drinks, ingredients, recipes, menus, drafts, photos you upload, and venue names, logos and colours.',
            'Venue membership: which venues you belong to and your role in each.',
            'Diagnostics and usage: crash reports and app usage events (such as which screens are opened), with your device type, operating system and app version. These are linked to your account ID, never your name or email.',
            'On your device: your session, favourites, study list, recent activity and settings.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="How we use it">
        <P>
          To run the service (signing you in and keeping your venue&apos;s content in sync across devices), to keep it
          secure, and to fix problems and improve it. We do not sell personal data, show ads, or track you across other
          companies&apos; apps or websites.
        </P>
      </LegalSection>

      <LegalSection heading="AI features">
        <P>
          When you ask the app to draw a drink illustration or to identify glassware from a photo, we send that
          drink&apos;s name and ingredients, or that photo, to Google&apos;s Gemini API to produce the result. Nothing
          is sent until you use one of these features.
        </P>
      </LegalSection>

      <LegalSection heading="Who we share it with">
        <P>We use these providers to run the service. They process data only to provide their services to us:</P>
        <Bullets
          items={[
            'Supabase: database, sign-in and file storage.',
            'Vercel: website hosting.',
            'Expo: app builds and updates.',
            'Google: the AI features above.',
            'Sentry: crash reports.',
            'PostHog: product analytics.',
          ]}
        />
        <P>
          Members of a venue can see that venue&apos;s content and the other members&apos; email addresses and roles. We
          may disclose information if the law requires it.
        </P>
      </LegalSection>

      <LegalSection heading="Keeping and deleting your data">
        <P>
          We keep your data while your account exists. You can delete your account at any time from Settings → Account →
          Delete account. That permanently deletes your account, profile, drafts, personal menus and venue memberships,
          plus any venue where you are the only member. Drinks and menus you created in a shared venue stay with that
          venue, without your name. Copies can remain in our providers&apos; backups for a limited time before they are
          overwritten.
        </P>
      </LegalSection>

      <LegalSection heading="Your rights">
        <P>
          You can ask us for a copy of your data, to correct it, or to delete it, by emailing <SupportEmail />. Depending
          on where you live, you may also have the right to object to or restrict how we use it, and to complain to your
          data protection authority.
        </P>
      </LegalSection>

      <LegalSection heading="Age">
        <P>
          {BRAND.productName} is for adults of legal drinking age who work in hospitality. It is not directed at anyone
          under 18.
        </P>
      </LegalSection>

      <LegalSection heading="Where data is processed">
        <P>Our providers may process data in the United States and other countries.</P>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <P>
          If we change this policy we will update the date above, and tell you in the app about significant changes.
          Questions: <SupportEmail />.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
