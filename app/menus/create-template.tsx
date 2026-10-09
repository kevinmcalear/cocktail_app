import { Redirect } from 'expo-router';

/** Menu templates are now layouts, saved from a menu and picked when starting one. */
export default function CreateTemplateRedirect() {
  return <Redirect href="/menus/all" />;
}
