import Locked from "@/components/Locked";

export default function VendorPage() {
  return (
    <Locked
      phase="Phase 3 · Transaction layer"
      title="Vendor Dashboard"
      body="Inventory, orders, and payouts arrive with the marketplace. The best preparation today is presence: vendors active in the Vendor Showcase will be first onboarded when this opens."
      prep={{ label: "Post in Vendor Showcase", href: "/community" }}
    />
  );
}
