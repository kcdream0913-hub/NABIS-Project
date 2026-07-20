import Locked from "@/components/Locked";

export default function MarketplacePage() {
  return (
    <Locked
      phase="Phase 3 · Transaction layer"
      title="Marketplace"
      body="Listings, checkout, and payments open once the community and utility layers are established. Trust first, transactions second — that ordering is the product."
      prep={{ label: "Showcase your business now", href: "/community" }}
    />
  );
}
