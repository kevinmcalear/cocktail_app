import { Redirect } from 'expo-router';

// ponytail: venue management lives on the consolidated Settings screen now
export default function BarManagementRedirect() {
  return <Redirect href="/settings" />;
}
