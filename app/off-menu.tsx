import { Redirect } from 'expo-router';

/** Off menu became the staff list in Library. Old links and bookmarks land there. */
export default function OffMenuRoute() {
  return <Redirect href="/library?show=staff" />;
}
