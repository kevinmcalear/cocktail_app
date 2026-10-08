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
            'Crash reports: what went wrong, the screen it happened on, and technical details such as your device model, operating system and app version. Email addresses and search terms are removed before a report is sent.',
            'Usage events: which screens you open and a few actions (signing up, confirming your age, ranking, collecting or creating a drink, sending an invite, claiming a bar, searching). They record that something happened, not what you wrote or searched for.',
            'Crash reports and usage events are linked to your account ID when you are signed in, never to your name or email, and we do not keep the IP address they came from. We do not use them for advertising. You can turn usage events off in Settings → Account → Share usage analytics.',
            'On your device: your session, favourites, study list, recent activity and settings.',
            'Location, only if you use nearby search: your device\'s position, rounded to about 110 metres before it is sent. It is used for that search and is not saved on your account. Your last spot, rounded to about a kilometre, stays on your device so Discover opens there next time; signing out clears it.',
            'Age check: the country you give and whether you meet that country\'s drinking age. Your date of birth is used for the check and is not stored.',
            'What you choose to share publicly: a bar or bartender profile, drinks, and rankings.',
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
            'Sentry: crash reports and diagnostics.',
            'PostHog: usage events (product analytics).',
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
          {BRAND.productName} is for adults of legal drinking age. When you confirm your age we ask for a date of birth
          and a country, compare them with that country&apos;s drinking age, and store only the country, the age that
          applied, and when you confirmed. The date of birth is not kept.
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
