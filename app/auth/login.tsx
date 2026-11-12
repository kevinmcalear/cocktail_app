import { useState } from 'react';

import { SignInScreen } from '@/components/auth/SignInScreen';
import { Welcome } from '@/components/auth/Welcome';

/** Signed out: Welcome first (canvas Prod-first, 1), then the email and its code. */
export default function Login() {
  const [email, setEmail] = useState(false);
  return email ? <SignInScreen onBack={() => setEmail(false)} /> : <Welcome onEmail={() => setEmail(true)} />;
}
