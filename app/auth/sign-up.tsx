import { Redirect } from 'expo-router';

/** Signing up is signing in now (an emailed code makes the account). Old links land here. */
export default function SignUp() {
  return <Redirect href="/auth/login" />;
}
