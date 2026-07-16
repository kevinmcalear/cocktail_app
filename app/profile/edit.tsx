import { Redirect } from 'expo-router';

// ponytail: profile editing lives on the consolidated Settings screen now
export default function EditProfileRedirect() {
  return <Redirect href="/settings" />;
}
