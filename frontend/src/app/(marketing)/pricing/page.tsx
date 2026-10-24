import { redirect } from "next/navigation";

// Pricing lives on the home page now; keep the old URL working.
export default function PricingRedirect() {
  redirect("/#pricing");
}
