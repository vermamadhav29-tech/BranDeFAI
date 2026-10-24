import { redirect } from "next/navigation";

// Instagram now lives under Social accounts.
export default function InstagramRedirect() {
  redirect("/social-accounts");
}
