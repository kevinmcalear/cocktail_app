import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

/** Brand is called Theme now (Kevin, 31 Oct); old links and bookmarks land there. */
export default function VenueBrandRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/settings/bar/${id}/theme` as Href} />;
}
